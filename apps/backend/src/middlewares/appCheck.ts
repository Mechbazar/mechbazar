import { Request, Response, NextFunction } from 'express';
import admin from '../config/firebase';

export interface AppCheckRequest extends Request {
  appCheckVerified?: boolean;
}

// Off by default so this ships with zero effect on live traffic: apps/mobile
// doesn't send the X-Firebase-AppCheck header until its own App Check
// activation (services/appCheck.ts) is in a rolled-out build, and Play
// Integrity / App Attest / reCAPTCHA providers still need registering in the
// Firebase Console for mech-bazar-8fd86 (see
// docs/legal/app-store-submission-checklist.md's App Check note) before any
// token this backend receives could actually verify. Flip once both are true.
const ENFORCE = process.env.ENFORCE_APP_CHECK === 'true';

// Always safe to mount globally: verifies the header if present, otherwise
// just marks the request unverified and continues either way. Never rejects
// by itself -- use requireAppCheck on specific routes for that.
export const verifyAppCheck = async (req: AppCheckRequest, _res: Response, next: NextFunction) => {
  const token = req.header('X-Firebase-AppCheck');
  if (!token) {
    req.appCheckVerified = false;
    return next();
  }
  try {
    await admin.appCheck().verifyToken(token);
    req.appCheckVerified = true;
  } catch (error) {
    req.appCheckVerified = false;
    console.warn(`[appCheck] invalid token: ${req.method} ${req.originalUrl}`);
  }
  next();
};

// Gates a route on a verified App Check token, once ENFORCE_APP_CHECK=true.
// Must run after verifyAppCheck. Only wire this onto routes exclusively
// reachable from an app that actually sends the header -- as of this pass
// that's apps/mobile only (auth register/login/forgot-password, newsletter
// subscribe). Routes shared with apps/admin, apps/vendor, apps/rider or
// apps/mechanic (e.g. geocode, rider/technician registration, admin login)
// are NOT gated here because those apps have no App Check client wired up
// yet -- enforcing there would lock them out the moment ENFORCE_APP_CHECK
// flips on.
export const requireAppCheck = (req: AppCheckRequest, res: Response, next: NextFunction) => {
  if (!ENFORCE || req.appCheckVerified) return next();
  console.warn(`[appCheck] 401 missing/invalid App Check token: ${req.method} ${req.originalUrl}`);
  return res.status(401).json({ error: 'Unauthorized: App Check verification failed' });
};
