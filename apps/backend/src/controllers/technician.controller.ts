import { Request, Response } from 'express';
import { Role, TechnicianStatus } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';
import { verifyOtpAndResolvePhone, OtpVerificationError } from '../utils/otp';
import { generateToken } from '../utils/jwt';
import { notifyUser } from '../utils/notify';
import { sanitizeUser, sanitizeUsers } from '../utils/sanitizeUser';
import prisma from '../config/prisma';

// Every /me endpoint below re-derives the ServiceTechnician row from the JWT's
// userId rather than trusting any id the client might pass in -- mirrors
// rider.controller.ts's getOwnDeliveryPartner.
const getOwnTechnician = (userId: string) =>
  prisma.serviceTechnician.findUnique({ where: { userId } });

// Documents are listed with fileData excluded -- every KYC document's raw
// bytes were previously being fetched on every admin page load; the bytes are
// only needed by the dedicated single-document-file endpoint below.
const DOCUMENT_LIST_SELECT = { id: true, technicianId: true, type: true, status: true, remarks: true, uploadedAt: true, mimeType: true };

export const getTechnicians = async (req: Request, res: Response): Promise<void> => {
  try {
    const technicians = await prisma.user.findMany({
      where: { role: Role.SERVICE_TECHNICIAN },
      include: {
        technicianProfile: {
          include: { documents: { select: DOCUMENT_LIST_SELECT }, bankAccounts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const profileIds = technicians.map((t) => t.technicianProfile?.id).filter((id): id is string => !!id);
    const jobCounts = await prisma.serviceBooking.groupBy({
      by: ['technicianId'],
      where: { technicianId: { in: profileIds }, status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] } },
      _count: { _all: true },
    });
    const jobCountMap = new Map(jobCounts.map((j) => [j.technicianId, j._count._all]));

    const enriched = technicians.map((t) => ({
      ...t,
      technicianProfile: t.technicianProfile
        ? { ...t.technicianProfile, currentJobs: jobCountMap.get(t.technicianProfile.id) || 0 }
        : t.technicianProfile,
    }));

    res.status(200).json(sanitizeUsers(enriched));
  } catch (error) {
    console.error('Error fetching technicians:', error);
    res.status(500).json({ error: 'Failed to fetch technicians' });
  }
};

export const getTechnicianById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id); // User id
    const technician = await prisma.user.findFirst({
      where: { id, role: Role.SERVICE_TECHNICIAN },
      include: {
        technicianProfile: {
          include: { documents: { select: DOCUMENT_LIST_SELECT }, bankAccounts: true },
        },
      },
    });
    if (!technician) {
      res.status(404).json({ error: 'Technician not found' });
      return;
    }
    res.status(200).json(sanitizeUser(technician));
  } catch (error) {
    console.error('Error fetching technician:', error);
    res.status(500).json({ error: 'Failed to fetch technician' });
  }
};

export const createTechnician = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, phone, email, city, state, specializations, skills, experienceYears } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      res.status(400).json({ error: 'User with this phone number already exists' });
      return;
    }

    // Admin-created technicians are vetted outside the app, so (unlike the
    // in-app self-registration flow below, which starts at PENDING) they go
    // straight to APPROVED -- mirrors rider.controller.ts's createRider.
    const technician = await prisma.user.create({
      data: {
        name,
        phone,
        email: email || null,
        city,
        state,
        role: Role.SERVICE_TECHNICIAN,
        technicianProfile: {
          create: {
            specializations: Array.isArray(specializations) ? specializations : ['CAR', 'BIKE'],
            skills: Array.isArray(skills) ? skills : [],
            experienceYears: experienceYears ?? null,
            isActive: true,
            isOnline: false,
            status: TechnicianStatus.APPROVED,
            reviewedAt: new Date(),
          },
        },
      },
      include: { technicianProfile: true },
    });

    res.status(201).json(technician);
  } catch (error) {
    console.error('Error creating technician:', error);
    if (error && typeof error === 'object' && 'code' in error && (error as any).code === 'P2002') {
      const target = (error as any)?.meta?.target;
      const duplicateField = Array.isArray(target) ? target.join(', ') : 'unique field';
      res.status(400).json({ error: `Duplicate value for ${duplicateField}` });
      return;
    }
    res.status(500).json({ error: 'Failed to create technician' });
  }
};

export const updateTechnician = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { name, phone, email, city, state, specializations, skills, experienceYears, isActive, isOnline } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      res.status(404).json({ error: 'Technician not found' });
      return;
    }

    const technician = await prisma.user.update({
      where: { id },
      data: {
        name,
        phone,
        email: email || null,
        city,
        state,
        technicianProfile: {
          update: {
            ...(specializations !== undefined && { specializations }),
            ...(skills !== undefined && { skills }),
            ...(experienceYears !== undefined && { experienceYears }),
            ...(isActive !== undefined && { isActive }),
            ...(isOnline !== undefined && { isOnline }),
          },
        },
      },
      include: { technicianProfile: true },
    });

    res.status(200).json(sanitizeUser(technician));
  } catch (error) {
    console.error('Error updating technician:', error);
    if (error && typeof error === 'object' && 'code' in error && (error as any).code === 'P2002') {
      const target = (error as any)?.meta?.target;
      const duplicateField = Array.isArray(target) ? target.join(', ') : 'unique field';
      res.status(400).json({ error: `Duplicate value for ${duplicateField}` });
      return;
    }
    res.status(500).json({ error: 'Failed to update technician' });
  }
};

// ============ Admin: KYC verification ============

const TECHNICIAN_STATUS_VALUES = new Set(Object.values(TechnicianStatus));

export const updateTechnicianVerificationStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id); // ServiceTechnician id
    const { status, remarks } = req.body;

    if (!TECHNICIAN_STATUS_VALUES.has(status)) {
      res.status(400).json({ error: 'Invalid technician status' });
      return;
    }

    const technician = await prisma.serviceTechnician.findUnique({ where: { id }, include: { user: true } });
    if (!technician) {
      res.status(404).json({ error: 'Technician not found' });
      return;
    }

    const updated = await prisma.serviceTechnician.update({
      where: { id },
      data: {
        status,
        remarks: remarks || null,
        reviewedAt: new Date(),
        ...(status === TechnicianStatus.APPROVED && { isActive: true }),
        ...((status === TechnicianStatus.REJECTED || status === TechnicianStatus.BLOCKED) && { isActive: false }),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'TECHNICIAN_STATUS_CHANGE',
        entity: 'ServiceTechnician',
        entityId: id,
        details: `${technician.status} -> ${status}${remarks ? ` (${remarks})` : ''}`,
      },
    });

    notifyUser(
      technician.userId,
      'Application update',
      remarks
        ? `Your technician application status is now ${status}: ${remarks}`
        : `Your technician application status is now ${status}.`,
      { type: 'TECHNICIAN_STATUS', status }
    );

    res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating technician verification status:', error);
    res.status(500).json({ error: 'Failed to update technician status' });
  }
};

export const updateTechnicianDocumentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id); // ServiceTechnician id
    const documentId = String(req.params.documentId);
    const { status, remarks } = req.body;

    if (!['PENDING', 'VERIFIED', 'REJECTED'].includes(status)) {
      res.status(400).json({ error: 'Invalid document status' });
      return;
    }

    const document = await prisma.technicianDocument.findUnique({ where: { id: documentId } });
    if (!document || document.technicianId !== id) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const updated = await prisma.technicianDocument.update({
      where: { id: documentId },
      data: { status, remarks: remarks || null },
    });

    const technician = await prisma.serviceTechnician.findUnique({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'TECHNICIAN_DOCUMENT_STATUS_CHANGE',
        entity: 'TechnicianDocument',
        entityId: documentId,
        details: `${document.type}: ${document.status} -> ${status}${remarks ? ` (${remarks})` : ''}`,
      },
    });

    if (technician) {
      notifyUser(
        technician.userId,
        'Document review update',
        `Your ${document.type.replace(/_/g, ' ')} document was marked ${status}${remarks ? `: ${remarks}` : '.'}`,
        { type: 'TECHNICIAN_DOCUMENT_STATUS', documentId, status }
      );
    }

    res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating technician document status:', error);
    res.status(500).json({ error: 'Failed to update document status' });
  }
};

// ============ Technician self-registration (public + SERVICE_TECHNICIAN, no approval gate) ============
// Mirrors rider.controller.ts's registration flow: phone+OTP creates a PENDING
// account, then the wizard fills in KYC details and documents before
// submitting for admin review. None of these endpoints require an APPROVED
// status -- that gate only applies to actually *operating* as a technician
// (see requireApprovedTechnician in middlewares/auth.ts).

const REQUIRED_DOCUMENT_TYPES = ['AADHAAR', 'SELFIE'];

export const registerTechnician = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otp, name, email } = req.body;
    if (!phone || !otp || !name) {
      res.status(400).json({ error: 'phone, otp and name are required' });
      return;
    }

    let verifiedPhone: string;
    try {
      verifiedPhone = await verifyOtpAndResolvePhone(phone, otp);
    } catch (err) {
      res.status(401).json({ error: err instanceof OtpVerificationError ? err.message : 'Invalid or expired OTP token' });
      return;
    }

    const existingUser = await prisma.user.findFirst({ where: { OR: [{ phone: verifiedPhone }, { phone }] } });
    if (existingUser) {
      res.status(400).json({ error: 'Phone number already registered' });
      return;
    }

    const technician = await prisma.user.create({
      data: {
        name,
        phone: verifiedPhone,
        email: email || null,
        role: Role.SERVICE_TECHNICIAN,
        technicianProfile: {
          create: {
            specializations: [],
            status: TechnicianStatus.PENDING,
          },
        },
      },
      include: { technicianProfile: true },
    });

    const token = generateToken(technician.id, technician.role);
    res.status(201).json({ user: sanitizeUser(technician), technicianProfile: technician.technicianProfile, token });
  } catch (error) {
    console.error('Error registering technician:', error);
    res.status(500).json({ error: 'Failed to register' });
  }
};

export const updateMyRegistration = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const technician = await getOwnTechnician(req.user!.userId);
    if (!technician) {
      res.status(404).json({ error: 'Technician profile not found' });
      return;
    }

    const {
      addressLine, city, state, pincode, aadhaarNumber,
      specializations, skills, experienceYears,
      emergencyContactName, emergencyContactPhone,
    } = req.body;

    const updated = await prisma.serviceTechnician.update({
      where: { id: technician.id },
      data: {
        ...(addressLine !== undefined && { addressLine }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(pincode !== undefined && { pincode }),
        ...(aadhaarNumber !== undefined && { aadhaarNumber }),
        ...(specializations !== undefined && { specializations }),
        ...(skills !== undefined && { skills }),
        ...(experienceYears !== undefined && { experienceYears }),
        ...(emergencyContactName !== undefined && { emergencyContactName }),
        ...(emergencyContactPhone !== undefined && { emergencyContactPhone }),
      },
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating technician registration:', error);
    res.status(500).json({ error: 'Failed to update registration details' });
  }
};

export const uploadMyDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type } = req.body;
    if (!type) {
      res.status(400).json({ error: 'Document type is required' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const technician = await getOwnTechnician(req.user!.userId);
    if (!technician) {
      res.status(404).json({ error: 'Technician profile not found' });
      return;
    }

    const document = await prisma.technicianDocument.create({
      data: {
        technicianId: technician.id,
        type,
        filePath: req.file.originalname,
        fileData: req.file.buffer,
        mimeType: req.file.mimetype,
      },
    });

    res.status(201).json({ ...document, filePath: undefined, fileData: undefined });
  } catch (error) {
    console.error('Error uploading technician document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
};

export const submitMyApplication = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const technician = await prisma.serviceTechnician.findUnique({
      where: { userId: req.user!.userId },
      include: { user: true, documents: { select: DOCUMENT_LIST_SELECT }, bankAccounts: true },
    });
    if (!technician) {
      res.status(404).json({ error: 'Technician profile not found' });
      return;
    }

    if (technician.status === TechnicianStatus.APPROVED) {
      res.status(400).json({ error: 'This account is already approved.' });
      return;
    }

    const missing: string[] = [];
    if (!technician.user.name) missing.push('name');
    if (!technician.addressLine || !technician.city || !technician.pincode) missing.push('address');
    if (!technician.aadhaarNumber) missing.push('Aadhaar number');
    if (!technician.specializations || technician.specializations.length === 0) missing.push('vehicle specialization (CAR/BIKE)');
    if (!technician.skills || technician.skills.length === 0) missing.push('at least one skill');
    if (technician.bankAccounts.length === 0) missing.push('bank account details');

    const uploadedTypes = new Set(technician.documents.map((d) => d.type));
    for (const required of REQUIRED_DOCUMENT_TYPES) {
      if (!uploadedTypes.has(required)) missing.push(`document: ${required}`);
    }

    if (missing.length > 0) {
      res.status(400).json({ error: 'Application is incomplete', missing });
      return;
    }

    const updated = await prisma.serviceTechnician.update({
      where: { id: technician.id },
      data: { status: TechnicianStatus.UNDER_VERIFICATION, submittedAt: new Date() },
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error('Error submitting technician application:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
};

// Authenticated access only -- the owning technician or an admin. This is the
// *only* way to fetch a KYC document's bytes back out (mirrors
// rider.controller.ts's getRiderDocumentFile).
const ADMIN_TECHNICIAN_ROLES = new Set<Role>([
  Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATIONS_MANAGER,
  Role.VENDOR_MANAGER, Role.CUSTOMER_SUPPORT,
]);

export const getTechnicianDocumentFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const technicianId = String(req.params.technicianId);
    const documentId = String(req.params.documentId);
    const document = await prisma.technicianDocument.findUnique({ where: { id: documentId } });
    if (!document || document.technicianId !== technicianId) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const { userId, role } = req.user!;
    const isAdmin = ADMIN_TECHNICIAN_ROLES.has(role as Role);
    const isOwner = !isAdmin && (await getOwnTechnician(userId))?.id === technicianId;
    if (!isAdmin && !isOwner) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (!document.fileData) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.send(document.fileData);
  } catch (error) {
    console.error('Error fetching technician document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
};

export const getMyTechnicianProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const technician = await prisma.serviceTechnician.findUnique({
      where: { userId: req.user!.userId },
      include: { user: true, documents: { select: DOCUMENT_LIST_SELECT }, bankAccounts: true },
    });
    if (!technician) {
      res.status(404).json({ error: 'Technician profile not found' });
      return;
    }
    res.status(200).json({ ...technician, user: technician.user ? sanitizeUser(technician.user) : technician.user });
  } catch (error) {
    console.error('Error fetching own technician profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

// Technicians may only flip isOnline (Available/Offline). isActive is an
// admin-controlled enable/disable flag and is intentionally not exposed here.
export const updateMyAvailability = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isOnline } = req.body;
    if (typeof isOnline !== 'boolean') {
      res.status(400).json({ error: 'isOnline (boolean) is required' });
      return;
    }
    const technician = await getOwnTechnician(req.user!.userId);
    if (!technician) {
      res.status(404).json({ error: 'Technician profile not found' });
      return;
    }
    const updated = await prisma.serviceTechnician.update({
      where: { id: technician.id },
      data: { isOnline },
    });
    res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({ error: 'Failed to update availability' });
  }
};

export const updateMyLocation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { lat, lng } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      res.status(400).json({ error: 'lat and lng (numbers) are required' });
      return;
    }
    const technician = await getOwnTechnician(req.user!.userId);
    if (!technician) {
      res.status(404).json({ error: 'Technician profile not found' });
      return;
    }
    const updated = await prisma.serviceTechnician.update({
      where: { id: technician.id },
      data: { currentLat: lat, currentLng: lng },
    });
    res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
};

export const registerMyPushToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'token (string) is required' });
      return;
    }
    const technician = await getOwnTechnician(req.user!.userId);
    if (!technician) {
      res.status(404).json({ error: 'Technician profile not found' });
      return;
    }
    await prisma.serviceTechnician.update({
      where: { id: technician.id },
      data: { expoPushToken: token },
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error registering push token:', error);
    res.status(500).json({ error: 'Failed to register push token' });
  }
};

export const getMyBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const technician = await getOwnTechnician(req.user!.userId);
    if (!technician) {
      res.status(404).json({ error: 'Technician profile not found' });
      return;
    }
    const bookings = await prisma.serviceBooking.findMany({
      where: { technicianId: technician.id },
      include: {
        category: true,
        package: true,
        address: true,
        payment: true,
        user: true,
        userVehicle: { include: { vehicle: { include: { manufacturer: true, model: true, fuelType: true } } } },
        timeSlot: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    const sanitized = bookings.map((b) => ({ ...b, user: b.user ? sanitizeUser(b.user) : b.user }));
    res.status(200).json(sanitized);
  } catch (error) {
    console.error('Error fetching own bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
};

// ============ Technician wallet & payouts (SERVICE_TECHNICIAN only) ============
// Mirrors rider.controller.ts's wallet flow -- walletBalance is credited
// automatically on booking completion (see service.controller.ts's
// updateMyBookingStatus).

export const getMyEarnings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const technician = await prisma.serviceTechnician.findUnique({
      where: { userId: req.user!.userId },
      include: {
        bankAccounts: true,
        settlements: { orderBy: { date: 'desc' } },
      },
    });
    if (!technician) {
      res.status(404).json({ error: 'Technician profile not found' });
      return;
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalEarnedResult, todayEarnedResult] = await Promise.all([
      prisma.serviceBooking.aggregate({
        where: { technicianId: technician.id, status: 'COMPLETED' },
        _sum: { finalAmount: true },
      }),
      prisma.serviceBooking.aggregate({
        where: { technicianId: technician.id, status: 'COMPLETED', updatedAt: { gte: startOfToday } },
        _sum: { finalAmount: true },
      }),
    ]);

    res.status(200).json({
      walletBalance: technician.walletBalance,
      totalEarned: totalEarnedResult._sum.finalAmount || 0,
      todayEarned: todayEarnedResult._sum.finalAmount || 0,
      bankAccounts: technician.bankAccounts,
      settlements: technician.settlements,
    });
  } catch (error) {
    console.error('Error fetching own earnings:', error);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
};

export const addMyBankAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { accountHolderName, bankName, accountNumber, ifscCode } = req.body;
    if (!accountHolderName || !bankName || !accountNumber || !ifscCode) {
      res.status(400).json({ error: 'accountHolderName, bankName, accountNumber and ifscCode are required' });
      return;
    }

    const technician = await getOwnTechnician(req.user!.userId);
    if (!technician) {
      res.status(404).json({ error: 'Technician profile not found' });
      return;
    }

    const bankAccount = await prisma.technicianBankAccount.create({
      data: {
        technicianId: technician.id,
        accountHolderName,
        bankName,
        accountNumber,
        ifscCode,
      },
    });

    res.status(200).json(bankAccount);
  } catch (error) {
    console.error('Error adding technician bank account:', error);
    res.status(500).json({ error: 'Failed to add bank account' });
  }
};

export const requestMyPayout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }

    const technician = await getOwnTechnician(req.user!.userId);
    if (!technician) {
      res.status(404).json({ error: 'Technician profile not found' });
      return;
    }

    const pendingSettlement = await prisma.technicianSettlement.findFirst({
      where: { technicianId: technician.id, status: 'PENDING' },
    });
    if (pendingSettlement) {
      res.status(400).json({ error: 'You already have a pending payout request' });
      return;
    }

    if (technician.walletBalance < amount) {
      res.status(400).json({ error: 'Insufficient balance' });
      return;
    }

    const [updatedTechnician, settlement] = await prisma.$transaction([
      prisma.serviceTechnician.update({
        where: { id: technician.id },
        data: { walletBalance: { decrement: amount } },
      }),
      prisma.technicianSettlement.create({
        data: {
          technicianId: technician.id,
          amount: Number(amount),
          status: 'PENDING',
        },
      }),
    ]);

    res.status(200).json({
      message: 'Payout requested successfully',
      walletBalance: updatedTechnician.walletBalance,
      settlement,
    });
  } catch (error) {
    console.error('Error requesting technician payout:', error);
    res.status(500).json({ error: 'Failed to request payout' });
  }
};

// Admin-facing equivalent of getMyEarnings above, keyed by :id instead of the
// caller's own JWT -- powers the admin Mechanics page's "View Earnings" action.
export const getTechnicianEarnings = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const technician = await prisma.serviceTechnician.findUnique({
      where: { id },
      include: { bankAccounts: true, settlements: { orderBy: { date: 'desc' } } },
    });
    if (!technician) {
      res.status(404).json({ error: 'Technician not found' });
      return;
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalEarnedResult, todayEarnedResult] = await Promise.all([
      prisma.serviceBooking.aggregate({ where: { technicianId: id, status: 'COMPLETED' }, _sum: { finalAmount: true } }),
      prisma.serviceBooking.aggregate({ where: { technicianId: id, status: 'COMPLETED', updatedAt: { gte: startOfToday } }, _sum: { finalAmount: true } }),
    ]);

    res.status(200).json({
      walletBalance: technician.walletBalance,
      totalEarned: totalEarnedResult._sum.finalAmount || 0,
      todayEarned: todayEarnedResult._sum.finalAmount || 0,
      bankAccounts: technician.bankAccounts,
      settlements: technician.settlements,
    });
  } catch (error) {
    console.error('Error fetching technician earnings:', error);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
};

// Mirrors deleteServiceCategory's precedent (service.controller.ts): refuse to
// destroy history, point the admin at Suspend/Block instead.
export const deleteTechnician = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const technician = await prisma.serviceTechnician.findUnique({ where: { id } });
    if (!technician) {
      res.status(404).json({ error: 'Technician not found' });
      return;
    }

    const bookingCount = await prisma.serviceBooking.count({ where: { technicianId: id } });
    if (bookingCount > 0) {
      res.status(400).json({ error: 'Cannot delete a technician with existing bookings. Suspend or block them instead.' });
      return;
    }

    // No onDelete cascade exists in the schema, so any other table referencing
    // this technician's userId (not just the technician-specific tables
    // above) must be cleaned up first, or prisma.user.delete throws an opaque
    // FK-violation 500 -- reachable the moment a technician's user account
    // has ever filed a support ticket, added an address, or triggered an
    // audit log entry.
    await prisma.$transaction([
      prisma.technicianDocument.deleteMany({ where: { technicianId: id } }),
      prisma.technicianBankAccount.deleteMany({ where: { technicianId: id } }),
      prisma.technicianSettlement.deleteMany({ where: { technicianId: id } }),
      prisma.serviceTechnician.delete({ where: { id } }),
      prisma.notification.deleteMany({ where: { userId: technician.userId } }),
      prisma.address.deleteMany({ where: { userId: technician.userId } }),
      prisma.supportTicket.deleteMany({ where: { userId: technician.userId } }),
      prisma.auditLog.deleteMany({ where: { userId: technician.userId } }),
      prisma.stockMovement.deleteMany({ where: { userId: technician.userId } }),
      prisma.user.delete({ where: { id: technician.userId } }),
    ]);

    res.status(200).json({ message: 'Technician deleted' });
  } catch (error) {
    console.error('Error deleting technician:', error);
    res.status(500).json({ error: 'Failed to delete technician' });
  }
};

// ============ Admin: technician payouts ============

export const getAllTechnicianSettlements = async (req: Request, res: Response): Promise<void> => {
  try {
    const settlements = await prisma.technicianSettlement.findMany({
      include: {
        technician: {
          include: { user: true, bankAccounts: true },
        },
      },
      orderBy: { date: 'desc' },
    });
    const sanitized = settlements.map((s) => ({
      ...s,
      technician: s.technician
        ? { ...s.technician, user: s.technician.user ? sanitizeUser(s.technician.user) : s.technician.user }
        : s.technician,
    }));
    res.status(200).json(sanitized);
  } catch (error) {
    console.error('Error fetching technician settlements:', error);
    res.status(500).json({ error: 'Failed to fetch settlements' });
  }
};

export const updateTechnicianSettlementStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { status, transactionId } = req.body;

    const settlement = await prisma.technicianSettlement.findUnique({ where: { id } });
    if (!settlement) {
      res.status(404).json({ error: 'Settlement not found' });
      return;
    }

    if (settlement.status === 'COMPLETED' || settlement.status === 'FAILED') {
      res.status(400).json({ error: 'Settlement is already finalised' });
      return;
    }

    if (status === 'FAILED') {
      const [updatedSettlement] = await prisma.$transaction([
        prisma.technicianSettlement.update({
          where: { id },
          data: { status, transactionId },
        }),
        prisma.serviceTechnician.update({
          where: { id: settlement.technicianId },
          data: { walletBalance: { increment: settlement.amount } },
        }),
      ]);
      res.status(200).json(updatedSettlement);
      return;
    }

    const updatedSettlement = await prisma.technicianSettlement.update({
      where: { id },
      data: { status, transactionId },
    });

    res.status(200).json(updatedSettlement);
  } catch (error) {
    console.error('Error updating technician settlement status:', error);
    res.status(500).json({ error: 'Failed to update settlement status' });
  }
};
