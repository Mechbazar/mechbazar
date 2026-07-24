import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateToken } from '../utils/jwt';
import { AuthRequest } from '../middlewares/auth';
import { verifyOtpAndResolvePhone, OtpVerificationError, generateAndSendOtp } from '../utils/otp';
import { sanitizeUser } from '../utils/sanitizeUser';
import prisma from '../config/prisma';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otp, name, accountType, companyName, contactPerson, gstNumber, businessType, city, state, email, password } = req.body;

    let verifiedPhone = phone;

    // If no OTP but we have a password, we assume it's a direct email/password registration
    if (!otp && password && email) {
      verifiedPhone = phone;
    } else {
      try {
        verifiedPhone = await verifyOtpAndResolvePhone(phone, otp);
      } catch (err) {
        res.status(401).json({ error: err instanceof OtpVerificationError ? err.message : 'Invalid or expired OTP token' });
        return;
      }
    }

    const existingUserByPhone = await prisma.user.findUnique({ where: { phone: verifiedPhone } });
    if (existingUserByPhone) {
      res.status(400).json({ error: 'Phone number already registered' });
      return;
    }

    if (email) {
      const existingUserByEmail = await prisma.user.findUnique({ where: { email } });
      if (existingUserByEmail) {
        res.status(400).json({ error: 'Email already registered' });
        return;
      }
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    const user = await prisma.user.create({
      data: {
        phone: verifiedPhone,
        email: email || null,
        password: hashedPassword,
        name,
        accountType: accountType || 'RETAIL',
        companyName,
        contactPerson,
        gstNumber,
        businessType,
        city,
        state,
        isBusinessVerified: false,
      },
    });

    const token = generateToken(user.id, user.role, { accountType: user.accountType });

    res.status(201).json({ user: sanitizeUser(user), token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otp, email, password } = req.body;

    // Email/Password Login flow
    if (email && password) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.password) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
      const token = generateToken(user.id, user.role, { accountType: user.accountType });
      res.status(200).json({ user: sanitizeUser(user), token });
      return;
    }

    let verifiedPhone = phone;

    // Phone/OTP Login flow
    try {
      verifiedPhone = await verifyOtpAndResolvePhone(phone, otp);
    } catch (err) {
      res.status(401).json({ error: err instanceof OtpVerificationError ? err.message : 'Invalid or expired OTP token' });
      return;
    }

    // Phone numbers aren't stored consistently across creation paths: customer
    // signup stores E.164 (+91...), but admin-created accounts (vendors,
    // riders) store the raw 10-digit number. Try both so neither path breaks.
    const user = await prisma.user.findFirst({ where: { OR: [{ phone: verifiedPhone }, { phone }] } });
    if (!user) {
      res.status(401).json({ error: 'User not found. Please sign up.' });
      return;
    }

    const token = generateToken(user.id, user.role, { accountType: user.accountType });

    res.status(200).json({ user: sanitizeUser(user), token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

export const switchMode = async (req: Request, res: Response): Promise<void> => {
  try {
    // Assuming auth middleware sets req.user
    const userId = (req as any).user?.userId;
    const { accountType, companyName, contactPerson, gstNumber, businessType, city, state } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        accountType: 'BOTH',
        companyName,
        contactPerson,
        gstNumber,
        businessType,
        city,
        state,
      },
    });

    // Re-issue token with new accountType
    const token = generateToken(updatedUser.id, updatedUser.role, { accountType: updatedUser.accountType });

    res.status(200).json({ user: sanitizeUser(updatedUser), token });
  } catch (error) {
    console.error('Switch mode error:', error);
    res.status(500).json({ error: 'Failed to switch mode' });
  }
};

export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    
    const adminRoles: Role[] = [
      Role.ADMIN,
      Role.SUPER_ADMIN,
      Role.OPERATIONS_MANAGER,
      Role.INVENTORY_MANAGER,
      Role.VENDOR_MANAGER,
      Role.FINANCE_MANAGER,
      Role.CUSTOMER_SUPPORT
    ];
    
    if (!user || !adminRoles.includes(user.role as Role)) {
      res.status(401).json({ error: 'Invalid credentials or unauthorized' });
      return;
    }

    if (!user.password) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken(user.id, user.role, { accountType: user.accountType }, '1d');

    res.status(200).json({ user: sanitizeUser(user), token });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

// Any authenticated role can register a push token here (mirrors
// rider.controller.ts's registerMyPushToken, which does the same for
// DeliveryPartner.expoPushToken) -- this one targets User.expoPushToken,
// used today for customer order-status push notifications.
export const registerPushToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token, type } = req.body;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'token (string) is required' });
      return;
    }
    if (type && type !== 'expo' && type !== 'fcm') {
      res.status(400).json({ error: "type must be 'expo' or 'fcm'" });
      return;
    }
    await prisma.user.update({
      where: { id: req.user!.userId },
      // Default 'expo' keeps existing clients (which send only `{ token }`,
      // no `type`) writing to the same column as before. 'fcm' is the new
      // web-push channel (apps/mobile/src/services/webPush.web.ts).
      data: type === 'fcm' ? { fcmToken: token } : { expoPushToken: token },
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error registering push token:', error);
    res.status(500).json({ error: 'Failed to register push token' });
  }
};

// Called on logout -- a push token identifies a device, not a user, so
// on a shared/reset device the next person to log in would otherwise keep
// receiving the previous user's order/refund notifications on their own
// account's row until it happens to be overwritten by a fresh registration.
export const clearPushToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const type = (req.query.type as string | undefined) || req.body?.type;
    if (type && type !== 'expo' && type !== 'fcm') {
      res.status(400).json({ error: "type must be 'expo' or 'fcm'" });
      return;
    }
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: type === 'fcm' ? { fcmToken: null } : { expoPushToken: null },
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error clearing push token:', error);
    res.status(500).json({ error: 'Failed to clear push token' });
  }
};

// Sessions are plain long-lived JWTs (7d customer / 1d admin) with no rotation
// or revocation list -- this endpoint lets an already-authenticated client
// (valid, not-yet-expired token) silently slide its session forward instead of
// being hard-logged-out mid-expiry window. Requires the existing token to still
// verify, so it can't be used to resurrect an expired or tampered session.
export const refreshToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    const token = generateToken(user.id, user.role, { accountType: user.accountType });
    res.status(200).json({ user: sanitizeUser(user), token });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
};

// Self-service password change for an already-authenticated user (Bearer JWT,
// not OTP -- unaffected by the OTP-provider constraint elsewhere in this file).
// Most customers registered via phone/OTP and have no password at all
// (`user.password` is null); for those, skip the current-password check since
// there's nothing to verify against -- they're already proven to own the
// account by holding a valid session token.
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 6) {
      res.status(400).json({ error: 'newPassword must be at least 6 characters' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.password) {
      if (!currentPassword) {
        res.status(400).json({ error: 'currentPassword is required' });
        return;
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
};

export const requestOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.body;
    if (!phone) {
      res.status(400).json({ error: 'phone is required' });
      return;
    }
    const result = await generateAndSendOtp(phone);
    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      // Never echo the OTP in production, even if OTP_PROVIDER is misconfigured
      // as TEST there -- this response field exists purely for local/dev testing
      // without a real SMS provider.
      otp: process.env.NODE_ENV !== 'production' && (process.env.OTP_PROVIDER || 'TEST') === 'TEST' ? result.otp : undefined,
    });
  } catch (error) {
    console.error('Request OTP error:', error);
    res.status(500).json({ error: 'Failed to generate OTP' });
  }
};
