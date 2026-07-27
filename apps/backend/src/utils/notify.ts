import prisma from '../config/prisma';
import { Role, Prisma } from '@prisma/client';
import { sendExpoPush } from './expoPush';
import { sendFcmPush } from './fcmPush';
import { emitToUser } from '../realtime/gateway';
import { SERVER_EVENTS } from '../realtime/events';

const ADMIN_ROLES: Role[] = [Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATIONS_MANAGER];

/**
 * Notification type keys. Clients switch on these to route a tap and to pick
 * an icon/priority, instead of string-matching the human copy -- which is what
 * they had to do before `Notification.type` existed, and which broke every
 * time the copy was reworded.
 */
export const NOTIFY = {
  // Customer
  JOB_SEARCHING: 'JOB_SEARCHING',
  JOB_MECHANIC_FOUND: 'JOB_MECHANIC_FOUND',
  JOB_ACCEPTED: 'JOB_ACCEPTED',
  JOB_EN_ROUTE: 'JOB_EN_ROUTE',
  JOB_ARRIVED: 'JOB_ARRIVED',
  JOB_START_OTP: 'JOB_START_OTP',
  JOB_WORK_STARTED: 'JOB_WORK_STARTED',
  JOB_COMPLETION_OTP: 'JOB_COMPLETION_OTP',
  JOB_COMPLETED: 'JOB_COMPLETED',
  JOB_NO_MECHANIC: 'JOB_NO_MECHANIC',
  JOB_RATING_REMINDER: 'JOB_RATING_REMINDER',
  JOB_APPROVAL_REQUIRED: 'JOB_APPROVAL_REQUIRED',
  PAYMENT_STATUS: 'PAYMENT_STATUS',
  // Mechanic
  OFFER_NEW: 'OFFER_NEW',
  OFFER_LOST: 'OFFER_LOST',
  JOB_ASSIGNED: 'JOB_ASSIGNED',
  JOB_NAVIGATE: 'JOB_NAVIGATE',
  JOB_START_OTP_REQUIRED: 'JOB_START_OTP_REQUIRED',
  JOB_COMPLETION_OTP_REQUIRED: 'JOB_COMPLETION_OTP_REQUIRED',
  JOB_CANCELLED: 'JOB_CANCELLED',
  // Shared
  CHAT_MESSAGE: 'CHAT_MESSAGE',
} as const;

export type NotifyType = (typeof NOTIFY)[keyof typeof NOTIFY];

interface NotifyOptions {
  type?: NotifyType | string;
  /**
   * Skip the persisted Notification row and the pushes, delivering over the
   * live socket only. For high-frequency transient events that would otherwise
   * bury the notification centre.
   */
  socketOnly?: boolean;
  /**
   * Values that must reach the app but must never render in a lock-screen
   * preview -- an OTP code being the entire reason this exists. Merged into
   * the push `data` payload and the socket event, never into title/body.
   */
  secureData?: Record<string, unknown>;
}

/**
 * Fire-and-forget notification across every channel the user has: a persisted
 * Notification row, a live socket event, an Expo push (native apps) and an FCM
 * push (web). Never throws -- a failed delivery must not roll back the status
 * transition that triggered it.
 */
export const notifyUser = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  options: NotifyOptions = {}
) => {
  try {
    const { type, socketOnly, secureData } = options;
    const payloadData = data || {};

    let notificationId: string | null = null;
    if (!socketOnly) {
      const row = await prisma.notification.create({
        data: {
          userId,
          title,
          body,
          type: type ?? null,
          // secureData is deliberately NOT persisted: an OTP code has no
          // business sitting in the notification centre after it is consumed.
          data: Object.keys(payloadData).length ? (payloadData as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
        select: { id: true },
      });
      notificationId = row.id;
    }

    // Socket first: lowest-latency channel, and the one the customer is most
    // likely to be staring at during an active job.
    emitToUser(userId, SERVER_EVENTS.NOTIFICATION, {
      id: notificationId,
      type: type ?? null,
      title,
      body,
      data: { ...payloadData, ...(secureData || {}) },
      createdAt: new Date().toISOString(),
    });

    if (socketOnly) return;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { expoPushToken: true, fcmToken: true },
    });

    const pushData = { ...payloadData, ...(secureData || {}), ...(type ? { type } : {}) };

    // Independent channels -- a user can have a device (Expo) token, a browser
    // (FCM) token, both, or neither. One failing must not block the other;
    // both senders already swallow their own errors.
    if (user?.expoPushToken) {
      await sendExpoPush(user.expoPushToken, title, body, pushData);
    }
    if (user?.fcmToken) {
      await sendFcmPush(user.fcmToken, title, body, pushData);
    }
  } catch (error) {
    console.error('notifyUser error:', error);
  }
};

// Fans out to every admin-role User (ADMIN/SUPER_ADMIN/OPERATIONS_MANAGER) via
// notifyUser -- used for events that need a human's attention rather than any
// single customer/technician (e.g. a dispatch exhausted with no coverage).
export const notifyAdmins = async (
  title: string,
  body: string,
  data?: Record<string, unknown>,
  options: NotifyOptions = {}
) => {
  try {
    const admins = await prisma.user.findMany({ where: { role: { in: ADMIN_ROLES } }, select: { id: true } });
    await Promise.all(admins.map((admin) => notifyUser(admin.id, title, body, data, options)));
  } catch (error) {
    console.error('notifyAdmins error:', error);
  }
};
