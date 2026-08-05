import prisma from '../config/prisma';
import { PushPlatform } from '@prisma/client';

export interface ResolvedPushDevice {
  token: string;
  platform: PushPlatform;
}

/**
 * Every device to push to for a user: their PushDevice rows if any exist, or
 * the caller's legacy single-token column(s) otherwise. Callers pass their own
 * legacy fallback because it lives in different places per role (User.expo
 * PushToken/fcmToken for customers/admins/vendors, ServiceTechnician.expoPush
 * Token for mechanics, DeliveryPartner.expoPushToken for riders) -- see
 * notify.ts's notifyUser and dispatch.service.ts's sendOfferToTechnician for
 * the two current callers.
 */
export async function resolvePushDevices(
  userId: string,
  legacyFallback: { expo?: string | null; fcm?: string | null } = {}
): Promise<ResolvedPushDevice[]> {
  const devices = await prisma.pushDevice.findMany({
    where: { userId },
    select: { token: true, platform: true },
  });
  if (devices.length > 0) return devices;

  const fallback: ResolvedPushDevice[] = [];
  if (legacyFallback.expo) fallback.push({ token: legacyFallback.expo, platform: 'EXPO' });
  if (legacyFallback.fcm) fallback.push({ token: legacyFallback.fcm, platform: 'FCM' });
  return fallback;
}

// The write-side counterpart to notify.ts's PushDevice read path. Every role's
// push-token registration endpoint (auth.controller.ts, rider.controller.ts,
// technician.controller.ts) calls this alongside its own legacy single-token
// column write, so PushDevice becomes the multi-device source of truth without
// requiring every existing caller of the legacy columns to change.
export async function registerPushDevice(userId: string, token: string, platform: PushPlatform): Promise<void> {
  await prisma.pushDevice.upsert({
    where: { userId_token: { userId, token } },
    update: { lastActiveAt: new Date(), platform },
    create: { userId, token, platform },
  });
}

// Removes the PushDevice row for a token a caller is about to null out of its
// own legacy column. Takes the token explicitly (read by the caller just
// before clearing) rather than looking it up itself, since by the time this
// runs the legacy column may already be gone. No-op for an unregistered token.
export async function removePushDeviceByToken(userId: string, token: string | null | undefined): Promise<void> {
  if (!token) return;
  await prisma.pushDevice.deleteMany({ where: { userId, token } });
}
