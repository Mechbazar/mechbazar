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
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'token (string) is required' });
      return;
    }
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { expoPushToken: token },
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error registering push token:', error);
    res.status(500).json({ error: 'Failed to register push token' });
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
