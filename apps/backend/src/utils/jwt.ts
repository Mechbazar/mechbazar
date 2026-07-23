import jwt from 'jsonwebtoken';

// Single source of truth for the JWT secret. Every controller that signs a
// token must import generateToken from here rather than reading
// process.env.JWT_SECRET (or its own fallback) directly, otherwise tokens
// signed by one controller can fail verification in the shared `authenticate`
// middleware whenever JWT_SECRET is unset in a given environment.
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

export const generateToken = (userId: string, role: string, extra?: Record<string, unknown>, expiresIn: string = '7d') => {
  return jwt.sign({ userId, role, ...extra }, JWT_SECRET, {
    expiresIn,
    algorithm: 'HS256',
  } as jwt.SignOptions);
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
};
