import prisma from '../config/prisma';
import { Role } from '@prisma/client';
import { sendExpoPush } from './expoPush';
import { sendFcmPush } from './fcmPush';

const ADMIN_ROLES: Role[] = [Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATIONS_MANAGER];

// Fire-and-forget: send an Expo push if the user has a token registered, and
// always persist a Notification row (the model existed already but nothing
// wrote to it before this). Never throws -- a failed push/notification must
// not block the order-status update that triggered it.
export const notifyUser = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
) => {
  try {
    const [user] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.notification.create({ data: { userId, title, body } }),
    ]);
    // Independent channels -- a user can have a device (Expo) token, a
    // browser (FCM) token, both, or neither. One failing must not block the
    // other; sendExpoPush/sendFcmPush already swallow their own errors.
    if (user?.expoPushToken) {
      await sendExpoPush(user.expoPushToken, title, body, data);
    }
    if (user?.fcmToken) {
      await sendFcmPush(user.fcmToken, title, body, data);
    }
  } catch (error) {
    console.error('notifyUser error:', error);
  }
};

// Fans out to every admin-role User (ADMIN/SUPER_ADMIN/OPERATIONS_MANAGER) via
// notifyUser -- used for events that need a human's attention rather than any
// single customer/technician (e.g. a booking rejected with no replacement
// technician found).
export const notifyAdmins = async (title: string, body: string, data?: Record<string, unknown>) => {
  try {
    const admins = await prisma.user.findMany({ where: { role: { in: ADMIN_ROLES } }, select: { id: true } });
    await Promise.all(admins.map((admin) => notifyUser(admin.id, title, body, data)));
  } catch (error) {
    console.error('notifyAdmins error:', error);
  }
};
