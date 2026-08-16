import rateLimit from 'express-rate-limit';

// Per-account lockout for password/OTP-replay login endpoints, independent of
// the generic /api/auth IP limiter in index.ts -- that one only slows down a
// single attacking IP, so a distributed (multi-IP) guess/stuffing attempt
// against one known account wouldn't be throttled at all without this.
// Extracted from auth.routes.ts's original admin-only adminLoginLimiter
// (MB-AUTH-004) so customer/vendor/rider/technician logins get the same
// protection admin login already had -- keyed on whichever identifier field
// the request actually carries (phone for OTP-based logins, email for
// password-based ones), and only counts failed attempts
// (skipSuccessfulRequests) so a legitimately-logging-in user never trips it.
export const accountLoginLimiter = (identifierFields: string[]) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
      for (const field of identifierFields) {
        const value = req.body?.[field];
        if (typeof value === 'string' && value.trim()) return value.trim().toLowerCase();
      }
      return req.ip || 'unknown';
    },
    message: { error: 'Too many failed login attempts for this account. Please try again in 15 minutes.' },
  });
