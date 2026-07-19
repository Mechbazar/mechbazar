import admin from '../config/firebase';
import redisClient from '../config/redis';
import crypto from 'crypto';

const isDevOtpBypassAllowed = () => process.env.ALLOW_DEV_OTP_BYPASS === 'true';
const getOtpProvider = () => process.env.OTP_PROVIDER || 'TEST';

export class OtpVerificationError extends Error {}

// Securely hash OTP for storage
const hashOtp = (otp: string): string => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

/**
 * Generates a local 6-digit OTP, stores its hash in Redis with a 5-minute TTL,
 * and logs it clearly to the console for testing.
 */
export const generateAndSendOtp = async (phone: string): Promise<{ otp: string; expiredInSeconds: number }> => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashed = hashOtp(otp);
  const key = `otp:${phone}`;

  // Store in Redis (TTL: 5 minutes = 300 seconds)
  await redisClient.set(key, hashed, {
    EX: 300
  });

  console.log(`
========================================
🔑 LOCAL TESTING OTP GENERATED
📱 Phone: ${phone}
🎟️ OTP Code: ${otp}
⏱️ Expires in: 5 minutes (300s)
========================================
  `);

  return { otp, expiredInSeconds: 300 };
};

/**
 * Shared verification method. Validates OTP via Redis (in TEST mode) or Firebase (in PRODUCTION mode).
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
    const key = `otp:${phone}`;
    const storedHash = await redisClient.get(key);
    
    if (!storedHash) {
      throw new OtpVerificationError('OTP expired or not requested');
    }

    if (hashOtp(otp) !== storedHash) {
      throw new OtpVerificationError('Invalid OTP code');
    }

    // Clean up used OTP
    await redisClient.del(key);
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
