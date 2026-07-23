import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import prisma from '../config/prisma';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn(`[auth] 401 no token: ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token) as { userId: string; role: string };
    req.user = decoded;
    next();
  } catch (error) {
    console.warn(`[auth] 401 invalid/expired token: ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// Like `authenticate`, but never rejects -- attaches `req.user` if a valid
// Bearer token is present, otherwise leaves it undefined and continues. For
// routes that are genuinely public (anonymous browsing) but should behave
// differently for a logged-in caller with elevated privileges, e.g. the
// public product list including non-APPROVED products for an admin caller.
export const optionalAuthenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(authHeader.split(' ')[1]) as { userId: string; role: string };
    } catch {
      // Invalid/expired token on an otherwise-public route -- treat as anonymous.
    }
  }
  next();
};

export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
};

// Gates only the "operate as a rider" endpoints (view/accept deliveries, go
// online, update location, request payout) -- registration, profile,
// document-upload and resubmission stay reachable at any status, otherwise a
// REJECTED/RESUBMISSION_REQUIRED rider could never fix and resubmit anything.
// Must run after `authenticate` and `authorize([Role.DELIVERY_PARTNER])`.
export const requireApprovedRider = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const partner = await prisma.deliveryPartner.findUnique({ where: { userId: req.user!.userId } });
    if (!partner) {
      return res.status(404).json({ error: 'Rider profile not found' });
    }
    if (partner.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Your rider account is not yet approved.', status: partner.status });
    }
    next();
  } catch (error) {
    console.error('requireApprovedRider error:', error);
    return res.status(500).json({ error: 'Failed to verify rider status' });
  }
};

// Gates only the "operate as a technician" endpoints (view/accept bookings, go
// online, update location, request payout) -- mirrors requireApprovedRider.
// Must run after `authenticate` and `authorize([Role.SERVICE_TECHNICIAN])`.
export const requireApprovedTechnician = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const technician = await prisma.serviceTechnician.findUnique({ where: { userId: req.user!.userId } });
    if (!technician) {
      return res.status(404).json({ error: 'Technician profile not found' });
    }
    if (technician.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Your technician account is not yet approved.', status: technician.status });
    }
    next();
  } catch (error) {
    console.error('requireApprovedTechnician error:', error);
    return res.status(500).json({ error: 'Failed to verify technician status' });
  }
};
