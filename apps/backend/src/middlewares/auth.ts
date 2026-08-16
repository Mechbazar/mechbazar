import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import prisma from '../config/prisma';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

// Sessions are a flat 7-day JWT with no refresh/revocation list, so a token
// signed before an account was deleted, banned, or had its role changed would
// otherwise keep working for up to a week. Re-resolving the user against the
// database on each request is what actually revokes it -- one indexed
// primary-key lookup, and the request cannot do anything useful without the
// database anyway.
//
// `role` in the decoded token is the SESSION's role -- which app/identity this
// particular login is acting as (e.g. a customer's phone that also has a
// rider account gets a CUSTOMER-scoped token from apps/mobile and a
// DELIVERY_PARTNER-scoped token from apps/rider, from the same User row). It
// is trusted only after confirming the account still actually holds that
// role in `roles` -- so a role removed from the account (or the whole account
// disabled) still revokes immediately, same guarantee as before, just checked
// against the multi-role set instead of a single column.
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn(`[auth] 401 no token: ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];
  let decoded: { userId: string; role: string };
  try {
    decoded = verifyToken(token) as { userId: string; role: string };
  } catch (error) {
    console.warn(`[auth] 401 invalid/expired token: ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, roles: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      console.warn(`[auth] 401 deleted/missing account ${decoded.userId}: ${req.method} ${req.originalUrl}`);
      return res.status(401).json({ error: 'Unauthorized: Account no longer active' });
    }

    if (!user.roles.includes(decoded.role as any)) {
      console.warn(`[auth] 401 session role no longer held ${decoded.userId} role=${decoded.role}: ${req.method} ${req.originalUrl}`);
      return res.status(401).json({ error: 'Unauthorized: This session\'s role is no longer active on this account' });
    }

    req.user = { userId: user.id, role: decoded.role };
    next();
  } catch (error) {
    console.error('[auth] session lookup failed:', error);
    return res.status(503).json({ error: 'Authentication temporarily unavailable' });
  }
};

// Like `authenticate`, but never rejects -- attaches `req.user` if a valid
// Bearer token is present, otherwise leaves it undefined and continues. For
// routes that are genuinely public (anonymous browsing) but should behave
// differently for a logged-in caller with elevated privileges, e.g. the
// public product list including non-APPROVED products for an admin caller.
export const optionalAuthenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = verifyToken(authHeader.split(' ')[1]) as { userId: string; role: string };
      // Same DB re-resolution as `authenticate` -- otherwise a deleted admin's
      // stale token would still unlock the elevated view on public routes.
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, roles: true, deletedAt: true },
      });
      if (user && !user.deletedAt && user.roles.includes(decoded.role as any)) {
        req.user = { userId: user.id, role: decoded.role };
      }
    } catch {
      // Invalid/expired token, or a transient lookup failure, on an otherwise
      // public route -- treat as anonymous rather than failing the request.
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

// Gates only the "operate as a vendor" endpoints (list/manage products, view
// orders, request payout) -- mirrors requireApprovedRider/requireApprovedTechnician.
// Registration, profile, business/bank details, document upload and
// resubmission stay reachable at any status, otherwise a
// PENDING/UNDER_VERIFICATION/RESUBMISSION_REQUIRED vendor could never finish
// onboarding. Previously this middleware did not exist at all, so any
// authenticated VENDOR-role token -- including one for an account an admin
// has never approved -- could create live, immediately-APPROVED products via
// POST /vendors/products; this closes that gap the same way riders/
// technicians are already gated.
// Must run after `authenticate` and `authorize([Role.VENDOR])`.
export const requireApprovedVendor = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.userId } });
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor profile not found' });
    }
    if (vendor.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Your vendor account is not yet approved.', status: vendor.status });
    }
    next();
  } catch (error) {
    console.error('requireApprovedVendor error:', error);
    return res.status(500).json({ error: 'Failed to verify vendor status' });
  }
};
