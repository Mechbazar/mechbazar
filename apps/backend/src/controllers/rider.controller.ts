import { Request, Response } from 'express';
import { Role, RiderStatus } from '@prisma/client';
import { transitionSettlement, SettlementAlreadyFinalisedError, SettlementChangedConcurrentlyError } from '../services/settlement.service';
import { reviewDocument, InvalidDocumentStatusError, DocumentNotFoundError } from '../services/documentVerification.service';
import { AuthRequest } from '../middlewares/auth';
import { verifyOtpAndResolvePhone, OtpVerificationError } from '../utils/otp';
import { generateToken } from '../utils/jwt';
import { notifyUser } from '../utils/notify';
import { registerPushDevice, removePushDeviceByToken } from '../utils/pushDevice';
import { sanitizeUser, sanitizeUsers, sanitizeOrders, stripDeliveryOtps } from '../utils/sanitizeUser';
import { recordAuditLog } from '../utils/auditLog';
import prisma from '../config/prisma';

// Every /me endpoint below re-derives the DeliveryPartner row from the JWT's
// userId rather than trusting any id the client might pass in, mirroring the
// vendor self-service pattern (vendor.controller.ts's getMyProducts etc.).
const getOwnDeliveryPartner = (userId: string) =>
  prisma.deliveryPartner.findUnique({ where: { userId } });

// Documents are listed with fileData excluded -- every KYC document's raw
// bytes were previously fetched on every admin/rider page load, even though
// the bytes are only needed by the dedicated single-document-file endpoint.
// Mirrors technician.controller.ts's DOCUMENT_LIST_SELECT.
const DOCUMENT_LIST_SELECT = { id: true, deliveryPartnerId: true, type: true, status: true, remarks: true, uploadedAt: true, mimeType: true };

export const getRiders = async (req: Request, res: Response): Promise<void> => {
  try {
    const riders = await prisma.user.findMany({
      where: {
        roles: { has: Role.DELIVERY_PARTNER }
      },
      include: {
        deliveryProfile: {
          include: {
            documents: { select: DOCUMENT_LIST_SELECT },
            bankAccounts: true,
          }
        },
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.status(200).json(sanitizeUsers(riders));
  } catch (error) {
    console.error('Error fetching riders:', error);
    res.status(500).json({ error: 'Failed to fetch riders' });
  }
};

export const getRiderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id); // User id
    const rider = await prisma.user.findFirst({
      where: { id, roles: { has: Role.DELIVERY_PARTNER } },
      include: {
        deliveryProfile: {
          include: {
            documents: { select: DOCUMENT_LIST_SELECT },
            bankAccounts: true,
          }
        },
      },
    });
    if (!rider) {
      res.status(404).json({ error: 'Rider not found' });
      return;
    }
    res.status(200).json(sanitizeUser(rider));
  } catch (error) {
    console.error('Error fetching rider:', error);
    res.status(500).json({ error: 'Failed to fetch rider' });
  }
};

export const createRider = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, phone, email, city, state, vehicleType, licenseNumber } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { phone } });

    if (existingUser) {
      const existingDeliveryProfile = await prisma.deliveryPartner.findUnique({ where: { userId: existingUser.id } });
      if (existingDeliveryProfile) {
        res.status(400).json({ error: 'This phone number already has a rider account' });
        return;
      }

      // Attach a rider profile to the existing shared identity (it may
      // already be a Customer/Vendor/Mechanic) instead of refusing outright.
      const rider = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: existingUser.name ?? name,
          email: existingUser.email ?? (email || null),
          city: city ?? existingUser.city,
          state: state ?? existingUser.state,
          roles: Array.from(new Set([...existingUser.roles, Role.DELIVERY_PARTNER])),
          deliveryProfile: {
            create: {
              vehicleType,
              licenseNumber,
              isActive: true,
              isOnline: false,
              status: RiderStatus.APPROVED,
              reviewedAt: new Date(),
            },
          },
        },
        include: { deliveryProfile: true },
      });

      res.status(201).json(rider);
      return;
    }

    // Create user and delivery profile. Admin-created riders are vetted
    // outside the app, so (unlike the in-app self-registration flow below,
    // which starts at PENDING) they go straight to APPROVED -- this matches
    // the account's existing "isActive: true" instant-activation behavior.
    const rider = await prisma.user.create({
      data: {
        name,
        phone,
        email: email || null,
        city,
        state,
        role: Role.DELIVERY_PARTNER,
        roles: [Role.CUSTOMER, Role.DELIVERY_PARTNER],
        deliveryProfile: {
          create: {
            vehicleType,
            licenseNumber,
            isActive: true,
            isOnline: false,
            status: RiderStatus.APPROVED,
            reviewedAt: new Date(),
          }
        }
      },
      include: {
        deliveryProfile: true
      }
    });

    res.status(201).json(rider);
  } catch (error) {
    console.error('Error creating rider:', error);
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as any).code === 'P2002'
    ) {
      const target = (error as any)?.meta?.target;
      const duplicateField = Array.isArray(target) ? target.join(', ') : 'unique field';
      res.status(400).json({ error: `Duplicate value for ${duplicateField}` });
      return;
    }
    res.status(500).json({ error: 'Failed to create rider' });
  }
};

export const updateRider = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { name, phone, email, city, state, vehicleType, licenseNumber, isActive, isOnline } = req.body;
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      res.status(404).json({ error: 'Rider not found' });
      return;
    }

    // Update user and delivery profile
    const rider = await prisma.user.update({
      where: { id },
      data: {
        name,
        phone,
        email: email || null,
        city,
        state,
        deliveryProfile: {
          update: {
            vehicleType,
            licenseNumber,
            isActive,
            isOnline
          }
        }
      },
      include: {
        deliveryProfile: true
      }
    });
    
    res.status(200).json(sanitizeUser(rider));
  } catch (error) {
    console.error('Error updating rider:', error);
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as any).code === 'P2002'
    ) {
      const target = (error as any)?.meta?.target;
      const duplicateField = Array.isArray(target) ? target.join(', ') : 'unique field';
      res.status(400).json({ error: `Duplicate value for ${duplicateField}` });
      return;
    }
    res.status(500).json({ error: 'Failed to update rider' });
  }
};

// ============ Admin: KYC verification ============

const RIDER_STATUS_VALUES = new Set(Object.values(RiderStatus));

export const updateRiderVerificationStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id); // DeliveryPartner id
    const { status, remarks } = req.body;

    if (!RIDER_STATUS_VALUES.has(status)) {
      res.status(400).json({ error: 'Invalid rider status' });
      return;
    }

    const partner = await prisma.deliveryPartner.findUnique({ where: { id }, include: { user: true } });
    if (!partner) {
      res.status(404).json({ error: 'Rider not found' });
      return;
    }

    const updated = await prisma.deliveryPartner.update({
      where: { id },
      data: {
        status,
        remarks: remarks || null,
        reviewedAt: new Date(),
        // Approval is what actually lets the rider operate (requireApprovedRider
        // checks `status`, not this flag) -- isActive stays in sync so the
        // existing admin Enable/Disable toggle and rider list reflect reality.
        ...(status === RiderStatus.APPROVED && { isActive: true }),
        ...((status === RiderStatus.REJECTED || status === RiderStatus.BLOCKED) && { isActive: false }),
      },
    });

    recordAuditLog({
      userId: req.user!.userId,
      action: 'RIDER_STATUS_CHANGE',
      entity: 'DeliveryPartner',
      entityId: id,
      details: `${partner.status} -> ${status}${remarks ? ` (${remarks})` : ''}`,
      req,
    });

    notifyUser(
      partner.userId,
      'Application update',
      remarks
        ? `Your rider application status is now ${status}: ${remarks}`
        : `Your rider application status is now ${status}.`,
      { type: 'RIDER_STATUS', status }
    );

    res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating rider verification status:', error);
    res.status(500).json({ error: 'Failed to update rider status' });
  }
};

export const updateRiderDocumentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id); // DeliveryPartner id
    const documentId = String(req.params.documentId);
    const { status, remarks } = req.body;

    const updated = await reviewDocument({
      reviewerUserId: req.user!.userId,
      status,
      remarks,
      loadDocument: async () => {
        const document = await prisma.riderDocument.findUnique({ where: { id: documentId } });
        return document && document.deliveryPartnerId === id ? document : null;
      },
      updateDocument: (status, remarks) =>
        prisma.riderDocument.update({ where: { id: documentId }, data: { status, remarks } }),
      loadOwnerUserId: async () => (await prisma.deliveryPartner.findUnique({ where: { id } }))?.userId ?? null,
      auditAction: 'RIDER_DOCUMENT_STATUS_CHANGE',
      auditEntity: 'RiderDocument',
      notifyType: 'RIDER_DOCUMENT_STATUS',
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
    console.error('Error updating rider document status:', error);
    res.status(500).json({ error: 'Failed to update document status' });
  }
};

// ============ Rider self-registration (public + DELIVERY_PARTNER, no approval gate) ============
// Riders can register only through the Rider App: phone+OTP creates a
// PENDING account, then the wizard fills in KYC details and documents before
// submitting for admin review. None of these endpoints require an APPROVED
// status -- that gate only applies to actually *operating* as a rider (see
// requireApprovedRider in middlewares/auth.ts), otherwise a REJECTED/
// RESUBMISSION_REQUIRED rider could never fix and resubmit anything.

const REQUIRED_DOCUMENT_TYPES = ['AADHAAR', 'DL_FRONT', 'DL_BACK', 'RC', 'SELFIE'];

export const registerRider = async (req: Request, res: Response): Promise<void> => {
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
      const existingDeliveryProfile = await prisma.deliveryPartner.findUnique({ where: { userId: existingUser.id } });
      if (existingDeliveryProfile) {
        res.status(409).json({ error: 'You already have a rider account for this number. Please log in instead.' });
        return;
      }

      // Attach the rider role to the existing shared identity (it may already
      // be a Customer/Vendor/Mechanic) instead of creating a second User row
      // for the same phone. Name/email are only filled in if currently blank.
      const rider = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: existingUser.name ?? name,
          email: existingUser.email ?? (email || null),
          roles: Array.from(new Set([...existingUser.roles, Role.DELIVERY_PARTNER])),
          deliveryProfile: {
            create: {
              vehicleType: 'UNSPECIFIED',
              licenseNumber: 'PENDING',
              status: RiderStatus.PENDING,
            },
          },
        },
        include: { deliveryProfile: true },
      });

      const token = generateToken(rider.id, Role.DELIVERY_PARTNER);
      res.status(201).json({ user: sanitizeUser(rider), deliveryProfile: rider.deliveryProfile, token });
      return;
    }

    const rider = await prisma.user.create({
      data: {
        name,
        phone: verifiedPhone,
        email: email || null,
        role: Role.DELIVERY_PARTNER,
        roles: [Role.CUSTOMER, Role.DELIVERY_PARTNER],
        deliveryProfile: {
          create: {
            // Placeholders -- filled in via PATCH /riders/me/registration during
            // the wizard, mirrors vendor.controller.ts's registerPersonal
            // ("storeName: 'My Store'") placeholder-then-complete pattern.
            vehicleType: 'UNSPECIFIED',
            licenseNumber: 'PENDING',
            status: RiderStatus.PENDING,
          }
        }
      },
      include: { deliveryProfile: true }
    });

    const token = generateToken(rider.id, Role.DELIVERY_PARTNER);
    res.status(201).json({ user: sanitizeUser(rider), deliveryProfile: rider.deliveryProfile, token });
  } catch (error) {
    console.error('Error registering rider:', error);
    res.status(500).json({ error: 'Failed to register' });
  }
};

// ============ Rider login (phone + OTP, own shared identity) ============
// Previously the rider app logged in through the generic /auth/login, which
// mints whatever role the account's legacy `role` column happens to hold --
// wrong once a phone can carry more than one role, and it gave no clear
// error at all when a customer-only phone tried to log into this app (it
// silently succeeded with a CUSTOMER-scoped token, then every /riders/me/*
// call 403'd with a bare "Forbidden"). This resolves by phone, requires a
// rider profile to actually exist, and always mints a DELIVERY_PARTNER-scoped
// session regardless of what other roles this identity also holds.
export const loginRider = async (req: Request, res: Response): Promise<void> => {
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
      include: { deliveryProfile: true },
    });
    if (!user) {
      res.status(401).json({ error: 'No account found for this number. Please register.' });
      return;
    }
    if (!user.deliveryProfile) {
      res.status(403).json({ error: 'This number has no rider account yet. Register in the app first.' });
      return;
    }

    const token = generateToken(user.id, Role.DELIVERY_PARTNER);
    res.status(200).json({ user: sanitizeUser(user), deliveryProfile: user.deliveryProfile, token });
  } catch (error) {
    console.error('Error logging in rider:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

export const updateMyRegistration = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const partner = await getOwnDeliveryPartner(req.user!.userId);
    if (!partner) {
      res.status(404).json({ error: 'Rider profile not found' });
      return;
    }

    const {
      addressLine, city, state, pincode, country, lat, lng, placeId, formattedAddress, aadhaarNumber,
      vehicleType, vehicleModel, vehicleRegistrationNumber, licenseNumber,
      insurancePolicyNumber, insuranceExpiry, pucNumber, pucExpiry,
      upiId, emergencyContactName, emergencyContactPhone,
    } = req.body;

    const updated = await prisma.deliveryPartner.update({
      where: { id: partner.id },
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
        ...(vehicleType !== undefined && { vehicleType }),
        ...(vehicleModel !== undefined && { vehicleModel }),
        ...(vehicleRegistrationNumber !== undefined && { vehicleRegistrationNumber }),
        ...(licenseNumber !== undefined && { licenseNumber }),
        ...(insurancePolicyNumber !== undefined && { insurancePolicyNumber }),
        ...(insuranceExpiry !== undefined && { insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : null }),
        ...(pucNumber !== undefined && { pucNumber }),
        ...(pucExpiry !== undefined && { pucExpiry: pucExpiry ? new Date(pucExpiry) : null }),
        ...(upiId !== undefined && { upiId }),
        ...(emergencyContactName !== undefined && { emergencyContactName }),
        ...(emergencyContactPhone !== undefined && { emergencyContactPhone }),
      },
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating rider registration:', error);
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

    const partner = await getOwnDeliveryPartner(req.user!.userId);
    if (!partner) {
      res.status(404).json({ error: 'Rider profile not found' });
      return;
    }

    const document = await prisma.riderDocument.create({
      data: {
        deliveryPartnerId: partner.id,
        type,
        filePath: req.file.originalname,
        fileData: req.file.buffer,
        mimeType: req.file.mimetype,
      },
    });

    res.status(201).json({ ...document, filePath: undefined, fileData: undefined });
  } catch (error) {
    console.error('Error uploading rider document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
};

export const submitMyApplication = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const partner = await prisma.deliveryPartner.findUnique({
      where: { userId: req.user!.userId },
      include: { user: true, documents: { select: DOCUMENT_LIST_SELECT }, bankAccounts: true },
    });
    if (!partner) {
      res.status(404).json({ error: 'Rider profile not found' });
      return;
    }

    if (partner.status === RiderStatus.APPROVED) {
      res.status(400).json({ error: 'This account is already approved.' });
      return;
    }

    const missing: string[] = [];
    if (!partner.user.name) missing.push('name');
    if (!partner.addressLine || !partner.city || !partner.pincode) missing.push('address');
    if (!partner.aadhaarNumber) missing.push('Aadhaar number');
    if (!partner.vehicleType || partner.vehicleType === 'UNSPECIFIED') missing.push('vehicle type');
    if (!partner.vehicleRegistrationNumber) missing.push('vehicle registration number (RC)');
    if (!partner.licenseNumber || partner.licenseNumber === 'PENDING') missing.push('driving license number');
    if (partner.bankAccounts.length === 0) missing.push('bank account details');

    const uploadedTypes = new Set(partner.documents.map((d) => d.type));
    for (const required of REQUIRED_DOCUMENT_TYPES) {
      if (!uploadedTypes.has(required)) missing.push(`document: ${required}`);
    }

    if (missing.length > 0) {
      res.status(400).json({ error: 'Application is incomplete', missing });
      return;
    }

    const updated = await prisma.deliveryPartner.update({
      where: { id: partner.id },
      data: { status: RiderStatus.UNDER_VERIFICATION, submittedAt: new Date() },
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error('Error submitting rider application:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
};

// Authenticated access only -- the owning rider or an admin. This is the
// *only* way to fetch a KYC document's bytes back out: fileData is stored
// as bytes in Postgres (see RiderDocument.fileData in schema.prisma), never
// on disk, so it's never reachable by a bare URL like /uploads.
const ADMIN_RIDER_ROLES = new Set<Role>([
  Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATIONS_MANAGER,
  Role.VENDOR_MANAGER, Role.CUSTOMER_SUPPORT,
]);

export const getRiderDocumentFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const deliveryPartnerId = String(req.params.deliveryPartnerId);
    const documentId = String(req.params.documentId);
    const document = await prisma.riderDocument.findUnique({ where: { id: documentId } });
    if (!document || document.deliveryPartnerId !== deliveryPartnerId) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const { userId, role } = req.user!;
    const isAdmin = ADMIN_RIDER_ROLES.has(role as Role);
    const isOwner = !isAdmin && (await getOwnDeliveryPartner(userId))?.id === deliveryPartnerId;
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
    console.error('Error fetching rider document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
};

export const getMyRiderProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const partner = await prisma.deliveryPartner.findUnique({
      where: { userId: req.user!.userId },
      include: { user: true, documents: { select: DOCUMENT_LIST_SELECT }, bankAccounts: true },
    });
    if (!partner) {
      res.status(404).json({ error: 'Rider profile not found' });
      return;
    }
    res.status(200).json({ ...partner, user: partner.user ? sanitizeUser(partner.user) : partner.user });
  } catch (error) {
    console.error('Error fetching own rider profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

// Riders may only flip isOnline (Available/Offline). isActive is an
// admin-controlled enable/disable flag and is intentionally not exposed here.
export const updateMyAvailability = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isOnline } = req.body;
    if (typeof isOnline !== 'boolean') {
      res.status(400).json({ error: 'isOnline (boolean) is required' });
      return;
    }
    const partner = await getOwnDeliveryPartner(req.user!.userId);
    if (!partner) {
      res.status(404).json({ error: 'Rider profile not found' });
      return;
    }
    const updated = await prisma.deliveryPartner.update({
      where: { id: partner.id },
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
    const partner = await getOwnDeliveryPartner(req.user!.userId);
    if (!partner) {
      res.status(404).json({ error: 'Rider profile not found' });
      return;
    }
    const updated = await prisma.deliveryPartner.update({
      where: { id: partner.id },
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
    const partner = await getOwnDeliveryPartner(req.user!.userId);
    if (!partner) {
      res.status(404).json({ error: 'Rider profile not found' });
      return;
    }
    await prisma.deliveryPartner.update({
      where: { id: partner.id },
      data: { expoPushToken: token },
    });
    // Also upsert into the multi-device PushDevice store, keyed by the
    // rider's own User.id -- see utils/notify.ts and utils/pushDevice.ts.
    await registerPushDevice(req.user!.userId, token, 'EXPO');
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
    const partner = await getOwnDeliveryPartner(req.user!.userId);
    if (!partner) {
      res.status(404).json({ error: 'Rider profile not found' });
      return;
    }
    await prisma.deliveryPartner.update({
      where: { id: partner.id },
      data: { expoPushToken: null },
    });
    await removePushDeviceByToken(req.user!.userId, partner.expoPushToken);
    res.status(204).send();
  } catch (error) {
    console.error('Error clearing push token:', error);
    res.status(500).json({ error: 'Failed to clear push token' });
  }
};

export const getMyDeliveries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const partner = await getOwnDeliveryPartner(req.user!.userId);
    if (!partner) {
      res.status(404).json({ error: 'Rider profile not found' });
      return;
    }
    const orders = await prisma.order.findMany({
      where: { deliveryPartnerId: partner.id },
      include: {
        items: { include: { product: true } },
        address: true,
        payment: true,
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    // Never let the rider read the code directly off their own delivery list
    // -- it must come from the customer reading it aloud, or the OTP step is
    // pointless.
    res.status(200).json(stripDeliveryOtps(sanitizeOrders(orders)));
  } catch (error) {
    console.error('Error fetching own deliveries:', error);
    res.status(500).json({ error: 'Failed to fetch deliveries' });
  }
};

// ============ Rider wallet & payouts (DELIVERY_PARTNER only) ============
// Mirrors the vendor wallet flow in vendor.controller.ts (getWalletDetails /
// requestPayout / updateBankDetails), with one difference: walletBalance is
// actually credited automatically (see order.controller.ts's
// updateMyDeliveryStatus) rather than only ever being set by a dev script.

export const getMyEarnings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const partner = await prisma.deliveryPartner.findUnique({
      where: { userId: req.user!.userId },
      include: {
        bankAccounts: true,
        settlements: { orderBy: { date: 'desc' } },
      },
    });
    if (!partner) {
      res.status(404).json({ error: 'Rider profile not found' });
      return;
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalEarnedResult, todayEarnedResult] = await Promise.all([
      prisma.order.aggregate({
        where: { deliveryPartnerId: partner.id, status: 'DELIVERED' },
        _sum: { deliveryFee: true },
      }),
      prisma.order.aggregate({
        where: { deliveryPartnerId: partner.id, status: 'DELIVERED', updatedAt: { gte: startOfToday } },
        _sum: { deliveryFee: true },
      }),
    ]);

    res.status(200).json({
      walletBalance: partner.walletBalance,
      totalEarned: totalEarnedResult._sum.deliveryFee || 0,
      todayEarned: todayEarnedResult._sum.deliveryFee || 0,
      bankAccounts: partner.bankAccounts,
      settlements: partner.settlements,
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

    const partner = await getOwnDeliveryPartner(req.user!.userId);
    if (!partner) {
      res.status(404).json({ error: 'Rider profile not found' });
      return;
    }

    const bankAccount = await prisma.riderBankAccount.create({
      data: {
        deliveryPartnerId: partner.id,
        accountHolderName,
        bankName,
        accountNumber,
        ifscCode,
      },
    });

    res.status(200).json(bankAccount);
  } catch (error) {
    console.error('Error adding rider bank account:', error);
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

    const partner = await getOwnDeliveryPartner(req.user!.userId);
    if (!partner) {
      res.status(404).json({ error: 'Rider profile not found' });
      return;
    }

    const pendingSettlement = await prisma.riderSettlement.findFirst({
      where: { deliveryPartnerId: partner.id, status: 'PENDING' },
    });
    if (pendingSettlement) {
      res.status(400).json({ error: 'You already have a pending payout request' });
      return;
    }

    if (partner.walletBalance < amount) {
      res.status(400).json({ error: 'Insufficient balance' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      // Re-check for a pending settlement inside the transaction -- narrows
      // (though on its own doesn't fully close, without a DB-level unique
      // constraint) the window where two concurrent requests both pass the
      // outer check above and both create a PENDING settlement.
      const stillNoPending = await tx.riderSettlement.findFirst({ where: { deliveryPartnerId: partner.id, status: 'PENDING' } });
      if (stillNoPending) {
        throw new Error('DUPLICATE_PENDING_PAYOUT');
      }
      // Guarded decrement -- only succeeds if the balance is still sufficient
      // at write time, re-checked under Postgres's row lock, not against the
      // stale `partner.walletBalance` read above. A plain `decrement` has no
      // floor, so two concurrent payout requests could otherwise both pass
      // the outer balance check and drive walletBalance negative.
      const claim = await tx.deliveryPartner.updateMany({
        where: { id: partner.id, walletBalance: { gte: amount } },
        data: { walletBalance: { decrement: amount } },
      });
      if (claim.count === 0) {
        throw new Error('INSUFFICIENT_BALANCE');
      }
      const updatedPartner = await tx.deliveryPartner.findUniqueOrThrow({ where: { id: partner.id } });
      const settlement = await tx.riderSettlement.create({
        data: { deliveryPartnerId: partner.id, amount: Number(amount), status: 'PENDING' },
      });
      return { updatedPartner, settlement };
    });

    res.status(200).json({
      message: 'Payout requested successfully',
      walletBalance: result.updatedPartner.walletBalance,
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
    console.error('Error requesting rider payout:', error);
    res.status(500).json({ error: 'Failed to request payout' });
  }
};

// ============ Admin: rider payouts ============

export const getAllRiderSettlements = async (req: Request, res: Response): Promise<void> => {
  try {
    const settlements = await prisma.riderSettlement.findMany({
      include: {
        deliveryPartner: {
          include: {
            user: true,
            bankAccounts: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });
    const sanitized = settlements.map((s) => ({
      ...s,
      deliveryPartner: s.deliveryPartner
        ? { ...s.deliveryPartner, user: s.deliveryPartner.user ? sanitizeUser(s.deliveryPartner.user) : s.deliveryPartner.user }
        : s.deliveryPartner,
    }));
    res.status(200).json(sanitized);
  } catch (error) {
    console.error('Error fetching rider settlements:', error);
    res.status(500).json({ error: 'Failed to fetch settlements' });
  }
};

export const updateRiderSettlementStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { status, transactionId } = req.body;

    const settlement = await prisma.riderSettlement.findUnique({ where: { id } });
    if (!settlement) {
      res.status(404).json({ error: 'Settlement not found' });
      return;
    }

    const updatedSettlement = await transitionSettlement(
      settlement,
      status,
      transactionId,
      (tx) => tx.riderSettlement,
      (tx) => tx.deliveryPartner.update({
        where: { id: settlement.deliveryPartnerId },
        data: { walletBalance: { increment: settlement.amount } },
      }).then(() => {}),
      async () => (await prisma.deliveryPartner.findUnique({ where: { id: settlement.deliveryPartnerId }, select: { userId: true } }))?.userId ?? null
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
    if (error.message === 'SETTLEMENT_CHANGED_CONCURRENTLY') {
      res.status(409).json({ error: 'Settlement was already updated by another request. Please refresh and retry.' });
      return;
    }
    console.error('Error updating rider settlement status:', error);
    res.status(500).json({ error: 'Failed to update settlement status' });
  }
};
