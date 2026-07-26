import jwt from 'jsonwebtoken';

// Single source of truth for the JWT secret. Every controller that signs a
// token must import generateToken from here rather than reading
// process.env.JWT_SECRET (or its own fallback) directly, otherwise tokens
// signed by one controller can fail verification in the shared `authenticate`
// middleware whenever JWT_SECRET is unset in a given environment.
//
// There is deliberately NO fallback value. This used to default to a literal
// 'supersecretkey123' -- a secret published in this repository, so anyone
// reading it could forge a token for any userId and role, including
// SUPER_ADMIN, against any deployment that happened to boot without
// JWT_SECRET set. config/env.ts already fails fast when the variable is
// missing; this throw is the second line of defence for any entry point that
// imports this module without going through env.ts first (scripts, seeds,
// tests).
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET is not set. Refusing to sign or verify tokens with a default secret. ' +
      'Set JWT_SECRET in apps/backend/.env (see .env.example).'
  );
}

export const generateToken = (userId: string, role: string, extra?: Record<string, unknown>, expiresIn: string = '7d') => {
  return jwt.sign({ userId, role, ...extra }, JWT_SECRET, {
    expiresIn,
    algorithm: 'HS256',
  } as jwt.SignOptions);
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
};
