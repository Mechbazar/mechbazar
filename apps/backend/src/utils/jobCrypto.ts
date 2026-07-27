import crypto from 'crypto';
import { env } from '../config/env';

// Reversible encryption for job OTP codes.
//
// Why not a hash: the customer has to READ their own start/completion code in
// the app and say it to the mechanic. A one-way hash makes that impossible, so
// the choice is between plaintext at rest (what the legacy
// ServiceBooking.completionOtp column did) and authenticated encryption. This
// module is the latter. A database dump on its own no longer yields live OTP
// codes; an attacker also needs the key, which lives only in the process
// environment.
//
// AES-256-GCM specifically: it authenticates as well as encrypts, so a
// tampered ciphertext fails to decrypt rather than silently producing a
// different six digits.

const KEY_INFO = Buffer.from('mechbazar:job-otp:v1');

// Derived once at module load. When JOB_OTP_SECRET is absent we fall back to
// HKDF over JWT_SECRET rather than refusing to boot -- the feature must work
// on an existing deployment before ops has provisioned a new secret. The
// domain-separation `info` guarantees this key can never coincide with any
// other use of JWT_SECRET.
const key: Buffer = (() => {
  const source = env.JOB_OTP_SECRET || env.JWT_SECRET;
  return Buffer.from(crypto.hkdfSync('sha256', Buffer.from(source, 'utf8'), Buffer.alloc(0), KEY_INFO, 32));
})();

/**
 * Encrypts a code for storage in JobOtp.codeEnc.
 * Format: base64(iv).base64(authTag).base64(ciphertext)
 */
export function encryptOtpCode(code: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

/**
 * Returns the plaintext code, or null if the payload is malformed, was
 * tampered with, or was encrypted under a different key (e.g. JWT_SECRET was
 * rotated while JOB_OTP_SECRET was unset). Never throws: an undecryptable OTP
 * must degrade to "this code is not valid, request a new one", not to a 500
 * that strands a mechanic standing next to a broken-down car.
 */
export function decryptOtpCode(payload: string): string | null {
  try {
    const [ivB64, tagB64, dataB64] = payload.split('.');
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Cryptographically random 6-digit code, uniformly distributed across
 * 000000-999999. `crypto.randomInt` is used rather than Math.random (which the
 * legacy completion-OTP path used): Math.random is seeded predictably enough
 * that observing a handful of codes can narrow the next one, and this code is
 * the only thing standing between a stranger and "work started on your car".
 */
export function generateOtpCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Constant-time comparison. A plain `===` on a secret leaks its prefix through
 * timing; with a 6-digit code and an attacker able to retry, that matters.
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  // timingSafeEqual throws on length mismatch, which would itself be a timing
  // signal. Compare against a fixed-length digest so every path costs the same.
  const digestA = crypto.createHash('sha256').update(bufA).digest();
  const digestB = crypto.createHash('sha256').update(bufB).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}
