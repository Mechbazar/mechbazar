import admin from '../config/firebase';
import prisma from '../config/prisma';
import crypto from 'crypto';

const isDevOtpBypassAllowed = () => process.env.ALLOW_DEV_OTP_BYPASS === 'true';
const getOtpProvider = () => process.env.OTP_PROVIDER || 'TEST';

const OTP_TTL_SECONDS = 300;

export class OtpVerificationError extends Error {}

// Securely hash OTP for storage
const hashOtp = (otp: string): string => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

/**
 * Generates a local 6-digit OTP, stores its hash in the PhoneOtp table with a
 * 5-minute expiry, and logs it clearly to the console for testing.
 *
 * Stored in Postgres rather than Redis: production runs on serverless Vercel
 * where no Redis is provisioned, and the database is the only store that is
 * always available.
 */
export const generateAndSendOtp = async (phone: string): Promise<{ otp: string; expiredInSeconds: number }> => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  await prisma.phoneOtp.upsert({
    where: { phone },
    update: { otpHash, expiresAt },
    create: { phone, otpHash, expiresAt },
  });

  console.log(`
========================================
🔑 LOCAL TESTING OTP GENERATED
📱 Phone: ${phone}
🎟️ OTP Code: ${otp}
⏱️ Expires in: 5 minutes (300s)
========================================
  `);

  return { otp, expiredInSeconds: OTP_TTL_SECONDS };
};

/**
 * Shared verification method. Validates OTP via the PhoneOtp table (in TEST
 * mode) or Firebase (in PRODUCTION mode).
 */
export const verifyOtpAndResolvePhone = async (phone: string, otp: string): Promise<string> => {
  const normalizedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

  if (process.env.NODE_ENV === 'test') {
    return normalizedPhone;
  }

  // Developer bypass gate
  if (otp === '123456' && isDevOtpBypassAllowed()) {
    console.log('⚠️ DEVELOPER BYPASS USED FOR OTP ⚠️');
    return normalizedPhone;
  }

  const provider = getOtpProvider();
  if (provider === 'TEST') {
    const record = await prisma.phoneOtp.findUnique({ where: { phone } });

    if (!record || record.expiresAt < new Date()) {
      if (record) {
        await prisma.phoneOtp.delete({ where: { phone } }).catch(() => {});
      }
      throw new OtpVerificationError('OTP expired or not requested');
    }

    if (hashOtp(otp) !== record.otpHash) {
      throw new OtpVerificationError('Invalid OTP code');
    }

    // Clean up used OTP
    await prisma.phoneOtp.delete({ where: { phone } }).catch(() => {});
    return normalizedPhone;
  }

  // Production: Firebase ID token verification
  try {
    const decodedToken = await admin.auth().verifyIdToken(otp);
    const verifiedPhone = decodedToken.phone_number;
    if (!verifiedPhone || !verifiedPhone.includes(phone.replace(/\D/g, ''))) {
      throw new OtpVerificationError('Phone number mismatch with Firebase token');
    }
    return verifiedPhone;
  } catch (err) {
    if (err instanceof OtpVerificationError) throw err;
    console.error('Firebase Token Verification Failed:', err);
    throw new OtpVerificationError('Invalid or expired OTP token');
  }
};
