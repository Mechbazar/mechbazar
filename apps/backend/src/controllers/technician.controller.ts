import { Request, Response } from 'express';
import { Role, TechnicianStatus, AttendanceStatus, MechanicType } from '@prisma/client';
import { transitionSettlement, SettlementAlreadyFinalisedError, SettlementChangedConcurrentlyError } from '../services/settlement.service';
import { reviewDocument, InvalidDocumentStatusError, DocumentNotFoundError } from '../services/documentVerification.service';
import { AuthRequest } from '../middlewares/auth';
import { verifyOtpAndResolvePhone, OtpVerificationError } from '../utils/otp';
import { generateToken } from '../utils/jwt';
import { notifyUser } from '../utils/notify';
import { sanitizeUser, sanitizeUsers } from '../utils/sanitizeUser';
import { recordAuditLog } from '../utils/auditLog';
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
    // Optional status filter -- powers the admin Dashboard's Pending Approvals
    // widget (?status=UNDER_VERIFICATION). Additive: omitted keeps today's full-list behavior.
    const statusFilter = req.query.status ? String(req.query.status) as TechnicianStatus : undefined;

    const technicians = await prisma.user.findMany({
      where: {
        roles: { has: Role.SERVICE_TECHNICIAN },
        ...(statusFilter ? { technicianProfile: { status: statusFilter } } : {}),
      },
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
      where: { id, roles: { has: Role.SERVICE_TECHNICIAN } },
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
      const existingTechnicianProfile = await prisma.serviceTechnician.findUnique({ where: { userId: existingUser.id } });
      if (existingTechnicianProfile) {
        res.status(400).json({ error: 'This phone number already has a technician account' });
        return;
      }

      // Attach a technician profile to the existing shared identity (it may
      // already be a Customer/Vendor/Rider) instead of refusing outright.
      const technician = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: existingUser.name ?? name,
          email: existingUser.email ?? (email || null),
          city: city ?? existingUser.city,
          state: state ?? existingUser.state,
          roles: Array.from(new Set([...existingUser.roles, Role.SERVICE_TECHNICIAN])),
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
        roles: [Role.CUSTOMER, Role.SERVICE_TECHNICIAN],
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
    const {
      name, phone, email, city, state, specializations, skills, experienceYears, isActive, isOnline,
      addressLine, pincode, country, lat, lng, placeId, formattedAddress,
    } = req.body;

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
            // Admin-side KYC address editing (Phase 4 Maps integration) --
            // same fields/conditional-update pattern as the technician's own
            // updateMyRegistration above, just reachable from the admin panel.
            // city/state are also mirrored here (not just onto User above) --
            // the KYC review modal reads technicianProfile.city/.pincode, so
            // leaving them User-only meant the edit form's City field never
            // actually reached what the review modal displays.
            ...(city !== undefined && { city }),
            ...(state !== undefined && { state }),
            ...(addressLine !== undefined && { addressLine }),
            ...(pincode !== undefined && { pincode }),
            ...(country !== undefined && { country }),
            ...(lat !== undefined && { lat }),
            ...(lng !== undefined && { lng }),
            ...(placeId !== undefined && { placeId }),
            ...(formattedAddress !== undefined && { formattedAddress }),
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

    recordAuditLog({
      userId: req.user!.userId,
      action: 'TECHNICIAN_STATUS_CHANGE',
      entity: 'ServiceTechnician',
      entityId: id,
      details: `${technician.status} -> ${status}${remarks ? ` (${remarks})` : ''}`,
      req,
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

    const updated = await reviewDocument({
      reviewerUserId: req.user!.userId,
      status,
      remarks,
      loadDocument: async () => {
        const document = await prisma.technicianDocument.findUnique({ where: { id: documentId } });
        return document && document.technicianId === id ? document : null;
      },
      updateDocument: (status, remarks) =>
        prisma.technicianDocument.update({ where: { id: documentId }, data: { status, remarks } }),
      loadOwnerUserId: async () => (await prisma.serviceTechnician.findUnique({ where: { id } }))?.userId ?? null,
      auditAction: 'TECHNICIAN_DOCUMENT_STATUS_CHANGE',
      auditEntity: 'TechnicianDocument',
      notifyType: 'TECHNICIAN_DOCUMENT_STATUS',
    });

    res.status(200).json(updated);
  } catch (error) {
    if (error instanceof InvalidDocumentStatusError) {
      res.status(400).json({ error: 'Invalid document status' });
      return;
    }
    if (error instanceof DocumentNotFoundError) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
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
      const existingTechnicianProfile = await prisma.serviceTechnician.findUnique({ where: { userId: existingUser.id } });
      if (existingTechnicianProfile) {
        res.status(409).json({ error: 'You already have a technician account for this number. Please log in instead.' });
        return;
      }

      // Attach the technician role to the existing shared identity (it may
      // already be a Customer/Vendor/Rider) instead of creating a second User
      // row for the same phone. Name/email are only filled in if blank.
      const technician = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: existingUser.name ?? name,
          email: existingUser.email ?? (email || null),
          roles: Array.from(new Set([...existingUser.roles, Role.SERVICE_TECHNICIAN])),
          technicianProfile: {
            create: {
              specializations: [],
              status: TechnicianStatus.PENDING,
            },
          },
        },
        include: { technicianProfile: true },
      });

      const token = generateToken(technician.id, Role.SERVICE_TECHNICIAN);
      res.status(201).json({ user: sanitizeUser(technician), technicianProfile: technician.technicianProfile, token });
      return;
    }

    const technician = await prisma.user.create({
      data: {
        name,
        phone: verifiedPhone,
        email: email || null,
        role: Role.SERVICE_TECHNICIAN,
        roles: [Role.CUSTOMER, Role.SERVICE_TECHNICIAN],
        technicianProfile: {
          create: {
            specializations: [],
            status: TechnicianStatus.PENDING,
          },
        },
      },
      include: { technicianProfile: true },
    });

    const token = generateToken(technician.id, Role.SERVICE_TECHNICIAN);
    res.status(201).json({ user: sanitizeUser(technician), technicianProfile: technician.technicianProfile, token });
  } catch (error) {
    console.error('Error registering technician:', error);
    res.status(500).json({ error: 'Failed to register' });
  }
};

// ============ Technician login (phone + OTP, own shared identity) ============
// Mirrors rider.controller.ts's loginRider -- previously the mechanic app
// logged in through the generic /auth/login, which mints whatever role the
// account's legacy `role` column happens to hold. This always mints a
// SERVICE_TECHNICIAN-scoped session, regardless of what other roles the
// underlying identity also holds.
export const loginTechnician = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      res.status(400).json({ error: 'phone and otp are required' });
      return;
    }

    let verifiedPhone: string;
    try {
      verifiedPhone = await verifyOtpAndResolvePhone(phone, otp);
    } catch (err) {
      res.status(401).json({ error: err instanceof OtpVerificationError ? err.message : 'Invalid or expired OTP token' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ phone: verifiedPhone }, { phone }] },
      include: { technicianProfile: true },
    });
    if (!user) {
      res.status(401).json({ error: 'No account found for this number. Please register.' });
      return;
    }
    if (!user.technicianProfile) {
      res.status(403).json({ error: 'This number has no technician account yet. Register in the app first.' });
      return;
    }

    const token = generateToken(user.id, Role.SERVICE_TECHNICIAN);
    res.status(200).json({ user: sanitizeUser(user), technicianProfile: user.technicianProfile, token });
  } catch (error) {
    console.error('Error logging in technician:', error);
    res.status(500).json({ error: 'Failed to login' });
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
      addressLine, city, state, pincode, country, lat, lng, placeId, formattedAddress, aadhaarNumber,
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
        ...(country !== undefined && { country }),
        ...(lat !== undefined && { lat }),
        ...(lng !== undefined && { lng }),
        ...(placeId !== undefined && { placeId }),
        ...(formattedAddress !== undefined && { formattedAddress }),
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

// Called on logout -- see auth.controller.ts's clearPushToken for why this
// matters on a shared/reset device.
export const clearMyPushToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const technician = await getOwnTechnician(req.user!.userId);
    if (!technician) {
      res.status(404).json({ error: 'Technician profile not found' });
      return;
    }
    await prisma.serviceTechnician.update({
      where: { id: technician.id },
      data: { expoPushToken: null },
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error clearing push token:', error);
    res.status(500).json({ error: 'Failed to clear push token' });
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
    // The completion OTP is read aloud by the customer to the technician -- it
    // must never be readable from the technician's own API response (mirrors
    // the single-booking redaction in service.controller.ts's getBooking).
    const sanitized = bookings.map((b) => ({
      ...b,
      user: b.user ? sanitizeUser(b.user) : b.user,
      completionOtp: undefined,
      completionOtpGeneratedAt: undefined,
    }));
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

// Previously a technician could only see their denormalized average rating
// (ServiceTechnician.rating) with no way to read what customers actually
// wrote -- ServiceReview rows existed but nothing exposed them to the
// reviewed technician's own client.
export const getMyReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const technician = await getOwnTechnician(req.user!.userId);
    if (!technician) {
      res.status(404).json({ error: 'Technician profile not found' });
      return;
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 50);

    const [reviews, total] = await Promise.all([
      prisma.serviceReview.findMany({
        where: { technicianId: technician.id },
        include: {
          user: { select: { name: true } },
          booking: { select: { bookingNumber: true, category: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.serviceReview.count({ where: { technicianId: technician.id } }),
    ]);

    res.status(200).json({
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        customerName: r.user?.name || 'Customer',
        bookingNumber: r.booking?.bookingNumber,
        category: r.booking?.category?.name,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      avgRating: technician.rating,
    });
  } catch (error) {
    console.error('Error fetching own reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
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

    const result = await prisma.$transaction(async (tx) => {
      // Re-check for a pending settlement inside the transaction -- narrows
      // (though on its own doesn't fully close, without a DB-level unique
      // constraint) the window where two concurrent requests both pass the
      // outer check above and both create a PENDING settlement.
      const stillNoPending = await tx.technicianSettlement.findFirst({ where: { technicianId: technician.id, status: 'PENDING' } });
      if (stillNoPending) {
        throw new Error('DUPLICATE_PENDING_PAYOUT');
      }
      // Guarded decrement -- only succeeds if the balance is still sufficient
      // at write time, re-checked under Postgres's row lock, not against the
      // stale `technician.walletBalance` read above. A plain `decrement` has
      // no floor, so two concurrent payout requests could otherwise both
      // pass the outer balance check and drive walletBalance negative.
      const claim = await tx.serviceTechnician.updateMany({
        where: { id: technician.id, walletBalance: { gte: amount } },
        data: { walletBalance: { decrement: amount } },
      });
      if (claim.count === 0) {
        throw new Error('INSUFFICIENT_BALANCE');
      }
      const updatedTechnician = await tx.serviceTechnician.findUniqueOrThrow({ where: { id: technician.id } });
      const settlement = await tx.technicianSettlement.create({
        data: { technicianId: technician.id, amount: Number(amount), status: 'PENDING' },
      });
      return { updatedTechnician, settlement };
    });

    res.status(200).json({
      message: 'Payout requested successfully',
      walletBalance: result.updatedTechnician.walletBalance,
      settlement: result.settlement,
    });
  } catch (error: any) {
    if (error.message === 'DUPLICATE_PENDING_PAYOUT') {
      res.status(400).json({ error: 'You already have a pending payout request' });
      return;
    }
    if (error.message === 'INSUFFICIENT_BALANCE') {
      res.status(400).json({ error: 'Insufficient balance' });
      return;
    }
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
    //
    // jobDispatchOffer/jobLocationPing/serviceReview were previously missing
    // here -- the bookingCount guard above only catches technicians who were
    // actually ASSIGNED a booking, not ones who were merely offered one by the
    // old auto-dispatch fan-out and declined/expired/lost it to someone else.
    // Any technician with dispatch-offer history (which is most of them, from
    // before the switch to admin-controlled assignment) hit an opaque FK
    // violation on serviceTechnician.delete with zero bookings on record.
    await prisma.$transaction([
      prisma.technicianDocument.deleteMany({ where: { technicianId: id } }),
      prisma.technicianBankAccount.deleteMany({ where: { technicianId: id } }),
      prisma.technicianSettlement.deleteMany({ where: { technicianId: id } }),
      prisma.jobDispatchOffer.deleteMany({ where: { technicianId: id } }),
      prisma.jobLocationPing.deleteMany({ where: { technicianId: id } }),
      prisma.serviceReview.deleteMany({ where: { technicianId: id } }),
      // Commission & payout system tables -- same FK-cleanup requirement as
      // everything else above (no onDelete cascade in the schema).
      prisma.mechanicPayProfile.deleteMany({ where: { technicianId: id } }),
      prisma.mechanicAttendance.deleteMany({ where: { technicianId: id } }),
      prisma.commissionRecord.deleteMany({ where: { technicianId: id } }),
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

    const updatedSettlement = await transitionSettlement(
      settlement,
      status,
      transactionId,
      (tx) => tx.technicianSettlement,
      // A SALARY settlement was never funded out of walletBalance (see
      // payTechnicianSalary below), so a FAILED SALARY settlement must not
      // credit the wallet -- only WALLET_PAYOUT/ADMIN_GENERATED settlements
      // (which did decrement it) get that reversal.
      (tx) => settlement.type === 'SALARY'
        ? Promise.resolve()
        : tx.serviceTechnician.update({
            where: { id: settlement.technicianId },
            data: { walletBalance: { increment: settlement.amount } },
          }).then(() => {}),
      async () => (await prisma.serviceTechnician.findUnique({ where: { id: settlement.technicianId }, select: { userId: true } }))?.userId ?? null
    );

    res.status(200).json(updatedSettlement);
  } catch (error: any) {
    if (error instanceof RangeError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof SettlementAlreadyFinalisedError) {
      res.status(400).json({ error: 'Settlement is already finalised' });
      return;
    }
    if (error instanceof SettlementChangedConcurrentlyError) {
      res.status(409).json({ error: 'Settlement was already updated by another request. Please refresh and retry.' });
      return;
    }
    console.error('Error updating technician settlement status:', error);
    res.status(500).json({ error: 'Failed to update settlement status' });
  }
};

// ============ Mechanic attendance ============

function normalizeDateOnly(dateInput: string | Date): Date {
  const d = new Date(dateInput);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const checkInMyAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const technician = await getOwnTechnician(req.user!.userId);
    if (!technician) {
      res.status(404).json({ error: 'Technician profile not found' });
      return;
    }

    const today = normalizeDateOnly(new Date());
    const existing = await prisma.mechanicAttendance.findUnique({
      where: { technicianId_date: { technicianId: technician.id, date: today } },
    });
    if (existing?.checkInAt) {
      res.status(400).json({ error: 'Already checked in today' });
      return;
    }

    const attendance = await prisma.mechanicAttendance.upsert({
      where: { technicianId_date: { technicianId: technician.id, date: today } },
      update: { checkInAt: new Date(), status: 'PRESENT' },
      create: { technicianId: technician.id, date: today, checkInAt: new Date(), status: 'PRESENT' },
    });

    res.status(200).json(attendance);
  } catch (error) {
    console.error('Error checking in:', error);
    res.status(500).json({ error: 'Failed to check in' });
  }
};

export const checkOutMyAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const technician = await getOwnTechnician(req.user!.userId);
    if (!technician) {
      res.status(404).json({ error: 'Technician profile not found' });
      return;
    }

    const today = normalizeDateOnly(new Date());
    const existing = await prisma.mechanicAttendance.findUnique({
      where: { technicianId_date: { technicianId: technician.id, date: today } },
    });
    if (!existing || !existing.checkInAt) {
      res.status(400).json({ error: 'You have not checked in today' });
      return;
    }
    if (existing.checkOutAt) {
      res.status(400).json({ error: 'Already checked out today' });
      return;
    }

    const attendance = await prisma.mechanicAttendance.update({
      where: { id: existing.id },
      data: { checkOutAt: new Date() },
    });

    res.status(200).json(attendance);
  } catch (error) {
    console.error('Error checking out:', error);
    res.status(500).json({ error: 'Failed to check out' });
  }
};

export const getMyAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const technician = await getOwnTechnician(req.user!.userId);
    if (!technician) {
      res.status(404).json({ error: 'Technician profile not found' });
      return;
    }

    const { from, to } = req.query;
    const records = await prisma.mechanicAttendance.findMany({
      where: {
        technicianId: technician.id,
        ...((from || to) && {
          date: { ...(from ? { gte: new Date(String(from)) } : {}), ...(to ? { lte: new Date(String(to)) } : {}) },
        }),
      },
      orderBy: { date: 'desc' },
    });
    res.status(200).json(records);
  } catch (error) {
    console.error('Error fetching own attendance:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
};

// ============ Admin: mechanic attendance ============

export const getTechnicianAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const technicianId = String(req.params.id);
    const { from, to } = req.query;
    const records = await prisma.mechanicAttendance.findMany({
      where: {
        technicianId,
        ...((from || to) && {
          date: { ...(from ? { gte: new Date(String(from)) } : {}), ...(to ? { lte: new Date(String(to)) } : {}) },
        }),
      },
      orderBy: { date: 'desc' },
    });
    res.status(200).json(records);
  } catch (error) {
    console.error('Error fetching technician attendance:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
};

// Admin edit/backfill of a single day -- e.g. marking a mechanic on LEAVE or
// correcting a missed check-in, rather than only ever reading what the
// mechanic app itself recorded.
export const upsertTechnicianAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const technicianId = String(req.params.id);
    const date = normalizeDateOnly(String(req.params.date));
    const { status, note } = req.body;

    if (!status || !Object.values(AttendanceStatus).includes(status)) {
      res.status(400).json({ error: `status must be one of ${Object.values(AttendanceStatus).join(', ')}` });
      return;
    }

    const attendance = await prisma.mechanicAttendance.upsert({
      where: { technicianId_date: { technicianId, date } },
      update: { status, note: note ?? undefined },
      create: { technicianId, date, status, note: note ?? undefined },
    });

    recordAuditLog({
      userId: req.user!.userId,
      action: 'UPDATE_MECHANIC_ATTENDANCE',
      entity: 'MechanicAttendance',
      entityId: attendance.id,
      details: `technician=${technicianId} date=${date.toISOString().slice(0, 10)} status=${status}`,
      req,
    });

    res.status(200).json(attendance);
  } catch (error) {
    console.error('Error updating technician attendance:', error);
    res.status(500).json({ error: 'Failed to update attendance' });
  }
};

// ============ Admin: mechanic pay profile & salary ============

export const getTechnicianPayProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const technicianId = String(req.params.id);
    const profile = await prisma.mechanicPayProfile.findUnique({ where: { technicianId } });
    res.status(200).json(profile);
  } catch (error) {
    console.error('Error fetching technician pay profile:', error);
    res.status(500).json({ error: 'Failed to fetch pay profile' });
  }
};

// Super-Admin-only (enforced at the route level) -- this is what decides
// whether a mechanic is paid per-job or by salary, and can set a
// mechanic-specific commission split.
export const updateTechnicianPayProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const technicianId = String(req.params.id);
    const technician = await prisma.serviceTechnician.findUnique({ where: { id: technicianId } });
    if (!technician) {
      res.status(404).json({ error: 'Technician not found' });
      return;
    }

    const { mechanicType, monthlySalary, joiningDate, employmentStatus, performanceBonus, incentiveRules, commissionPercent, bonusRules } = req.body;

    if (mechanicType && !Object.values(MechanicType).includes(mechanicType)) {
      res.status(400).json({ error: `mechanicType must be one of ${Object.values(MechanicType).join(', ')}` });
      return;
    }
    if (commissionPercent != null && (isNaN(Number(commissionPercent)) || commissionPercent < 0 || commissionPercent > 100)) {
      res.status(400).json({ error: 'commissionPercent must be between 0 and 100' });
      return;
    }

    const data: any = {
      ...(mechanicType && { mechanicType }),
      ...(monthlySalary !== undefined && { monthlySalary: monthlySalary === null ? null : Number(monthlySalary) }),
      ...(joiningDate !== undefined && { joiningDate: joiningDate ? new Date(joiningDate) : null }),
      ...(employmentStatus && { employmentStatus }),
      ...(performanceBonus !== undefined && { performanceBonus: Number(performanceBonus) || 0 }),
      ...(incentiveRules !== undefined && { incentiveRules }),
      ...(commissionPercent !== undefined && { commissionPercent: commissionPercent === null ? null : Number(commissionPercent) }),
      ...(bonusRules !== undefined && { bonusRules }),
      updatedByUserId: req.user!.userId,
    };

    const profile = await prisma.mechanicPayProfile.upsert({
      where: { technicianId },
      update: data,
      create: { technicianId, mechanicType: mechanicType || MechanicType.COMMISSION, ...data },
    });

    recordAuditLog({
      userId: req.user!.userId,
      action: 'UPDATE_MECHANIC_PAY_PROFILE',
      entity: 'MechanicPayProfile',
      entityId: profile.id,
      details: JSON.stringify(data),
      req,
    });

    res.status(200).json(profile);
  } catch (error) {
    console.error('Error updating technician pay profile:', error);
    res.status(500).json({ error: 'Failed to update pay profile' });
  }
};

// Super-Admin-only: initiates an out-of-band salary payout for a SALARY/
// HYBRID mechanic. Funded independently of walletBalance -- salary is never
// accrued into the per-job wallet the way COMMISSION/HYBRID job credits are,
// so this creates the settlement directly rather than decrementing a wallet.
export const payTechnicianSalary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const technicianId = String(req.params.id);
    const technician = await prisma.serviceTechnician.findUnique({ where: { id: technicianId } });
    if (!technician) {
      res.status(404).json({ error: 'Technician not found' });
      return;
    }

    const profile = await prisma.mechanicPayProfile.findUnique({ where: { technicianId } });
    if (!profile || profile.mechanicType === MechanicType.COMMISSION) {
      res.status(400).json({ error: 'This mechanic is not on a SALARY or HYBRID pay model.' });
      return;
    }

    const amount = Number(req.body.amount ?? profile.monthlySalary);
    if (!amount || isNaN(amount) || amount <= 0) {
      res.status(400).json({ error: "A positive amount is required (defaults to the profile's monthlySalary)." });
      return;
    }

    const pendingSalary = await prisma.technicianSettlement.findFirst({
      where: { technicianId, status: 'PENDING', type: 'SALARY' },
    });
    if (pendingSalary) {
      res.status(400).json({ error: 'A salary payout is already pending for this mechanic.' });
      return;
    }

    const settlement = await prisma.technicianSettlement.create({
      data: { technicianId, amount, status: 'PENDING', type: 'SALARY' },
    });

    recordAuditLog({
      userId: req.user!.userId,
      action: 'PAY_MECHANIC_SALARY',
      entity: 'TechnicianSettlement',
      entityId: settlement.id,
      details: `technician=${technicianId} amount=${amount}`,
      req,
    });

    notifyUser(
      technician.userId,
      'Salary payout initiated',
      `A salary payout of ₹${amount.toFixed(2)} has been initiated.`,
      { settlementId: settlement.id }
    );

    res.status(201).json(settlement);
  } catch (error) {
    console.error('Error paying technician salary:', error);
    res.status(500).json({ error: 'Failed to initiate salary payout' });
  }
};
