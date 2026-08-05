import prisma from '../config/prisma';
import { Role, Prisma } from '@prisma/client';
import { sendExpoPush } from './expoPush';
import { sendFcmPush } from './fcmPush';
import { resolvePushDevices } from './pushDevice';
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

// The boolean columns on NotificationPreference a gateable type can be
// switched off under (see prisma schema's NotificationPreference model).
type PreferenceField =
  | 'offers'
  | 'promotions'
  | 'serviceUpdates'
  | 'payments'
  | 'wallet'
  | 'mechanicUpdates'
  | 'vendorUpdates'
  | 'reminders';

/**
 * Types that always send regardless of NotificationPreference: OTP, payment
 * status, and order/job status per the brief's own "transactional" carve-out
 * ("OTP, payments, order status, security alerts must always remain
 * enabled"), plus account-status changes (a vendor/mechanic/rider must always
 * learn their own account was approved/suspended -- Preferences has no
 * "Account" toggle to opt into anyway) and admin ops pings (a new order/
 * vendor/customer signup an admin silently misses is a real ops gap, not a
 * notification preference). Any type NOT in this set and NOT found in
 * PREFERENCE_FIELD_BY_TYPE below also falls through as transactional --
 * over-delivering an unmapped/future type beats silently dropping it.
 */
const TRANSACTIONAL_TYPES = new Set<string>([
  NOTIFY.JOB_START_OTP,
  NOTIFY.JOB_START_OTP_REQUIRED,
  NOTIFY.JOB_COMPLETION_OTP,
  NOTIFY.JOB_COMPLETION_OTP_REQUIRED,
  NOTIFY.PAYMENT_STATUS,
  NOTIFY.JOB_SEARCHING,
  NOTIFY.JOB_MECHANIC_FOUND,
  NOTIFY.JOB_ACCEPTED,
  NOTIFY.JOB_EN_ROUTE,
  NOTIFY.JOB_ARRIVED,
  NOTIFY.JOB_WORK_STARTED,
  NOTIFY.JOB_COMPLETED,
  NOTIFY.JOB_CANCELLED,
  NOTIFY.JOB_NO_MECHANIC,
  NOTIFY.JOB_APPROVAL_REQUIRED,
  'ORDER_STATUS', // services/orderState.ts
  'TECHNICIAN_STATUS',
  'VENDOR_STATUS',
  'RIDER_STATUS',
  'ADMIN_NEW_ORDER',
  'ADMIN_NEW_CUSTOMER',
  'ADMIN_VENDOR_PENDING',
]);

// The rest of the catalog, mapped to the preference column that gates it.
// 'payments' has no entry -- PAYMENT_STATUS itself is transactional above, so
// nothing currently reads that column; it exists for a future non-critical
// payment notice (e.g. "UPI now supported").
const PREFERENCE_FIELD_BY_TYPE: Record<string, PreferenceField> = {
  [NOTIFY.OFFER_NEW]: 'mechanicUpdates',
  [NOTIFY.OFFER_LOST]: 'mechanicUpdates',
  [NOTIFY.JOB_ASSIGNED]: 'mechanicUpdates',
  [NOTIFY.JOB_NAVIGATE]: 'mechanicUpdates',
  CHAT: 'serviceUpdates',
  [NOTIFY.JOB_RATING_REMINDER]: 'reminders',
  WALLET_CREDIT: 'wallet',
  WALLET_DEBIT: 'wallet',
  ADMIN_BROADCAST: 'promotions',
};

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
  /** Rich notification support -- see Notification.imageUrl/actions in the schema. */
  imageUrl?: string;
  actions?: { label: string; deepLink: string }[];
}

/**
 * Display category for the notification-center filter UI (distinct from
 * PreferenceField above -- this is the brief's 10-category list for browsing,
 * not the 8-category preference-toggle list). Unmapped/null types fall back
 * to SYSTEM, same fail-open reasoning as TRANSACTIONAL_TYPES above.
 */
export type NotificationDisplayCategory =
  | 'ORDERS' | 'SERVICES' | 'PAYMENTS' | 'OFFERS' | 'COUPONS'
  | 'ACCOUNT' | 'MECHANIC_UPDATES' | 'RIDER_UPDATES' | 'VENDOR_UPDATES' | 'SYSTEM';

const DISPLAY_CATEGORY_BY_TYPE: Record<string, NotificationDisplayCategory> = {
  [NOTIFY.JOB_SEARCHING]: 'SERVICES',
  [NOTIFY.JOB_MECHANIC_FOUND]: 'SERVICES',
  [NOTIFY.JOB_ACCEPTED]: 'SERVICES',
  [NOTIFY.JOB_EN_ROUTE]: 'SERVICES',
  [NOTIFY.JOB_ARRIVED]: 'SERVICES',
  [NOTIFY.JOB_START_OTP]: 'SERVICES',
  [NOTIFY.JOB_WORK_STARTED]: 'SERVICES',
  [NOTIFY.JOB_COMPLETION_OTP]: 'SERVICES',
  [NOTIFY.JOB_COMPLETED]: 'SERVICES',
  [NOTIFY.JOB_NO_MECHANIC]: 'SERVICES',
  [NOTIFY.JOB_RATING_REMINDER]: 'SERVICES',
  [NOTIFY.JOB_APPROVAL_REQUIRED]: 'SERVICES',
  [NOTIFY.JOB_CANCELLED]: 'SERVICES',
  [NOTIFY.PAYMENT_STATUS]: 'PAYMENTS',
  WALLET_CREDIT: 'PAYMENTS',
  WALLET_DEBIT: 'PAYMENTS',
  [NOTIFY.OFFER_NEW]: 'MECHANIC_UPDATES',
  [NOTIFY.OFFER_LOST]: 'MECHANIC_UPDATES',
  [NOTIFY.JOB_ASSIGNED]: 'MECHANIC_UPDATES',
  [NOTIFY.JOB_NAVIGATE]: 'MECHANIC_UPDATES',
  CHAT: 'SERVICES',
  ADMIN_BROADCAST: 'SYSTEM',
  TECHNICIAN_STATUS: 'ACCOUNT',
  VENDOR_STATUS: 'ACCOUNT',
  RIDER_STATUS: 'ACCOUNT',
  ADMIN_NEW_ORDER: 'ORDERS',
  ADMIN_NEW_CUSTOMER: 'ACCOUNT',
  ADMIN_VENDOR_PENDING: 'VENDOR_UPDATES',
  ORDER_STATUS: 'ORDERS',
};

export function classifyNotificationDisplayCategory(type: string | null): NotificationDisplayCategory {
  return (type && DISPLAY_CATEGORY_BY_TYPE[type]) || 'SYSTEM';
}

/** Every `type` value that maps to a given display category -- used to build a Prisma `type: { in }` filter. */
export function typesForDisplayCategory(category: NotificationDisplayCategory): string[] {
  return Object.keys(DISPLAY_CATEGORY_BY_TYPE).filter((t) => DISPLAY_CATEGORY_BY_TYPE[t] === category);
}

/** Every type this catalog explicitly classifies -- used to build the SYSTEM category's "everything else" fallback filter. */
export function allClassifiedNotificationTypes(): string[] {
  return Object.keys(DISPLAY_CATEGORY_BY_TYPE);
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
    const { type, socketOnly, secureData, imageUrl, actions } = options;
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
          imageUrl: imageUrl ?? null,
          actions: actions ? (actions as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
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
      imageUrl: imageUrl ?? null,
      actions: actions ?? null,
      createdAt: new Date().toISOString(),
    });

    if (socketOnly) return;

    // Preference gate: only the push step is skipped for an opted-out
    // category -- the Notification row above (and the socket emit) already
    // happened, so notification-centre history stays complete either way.
    if (type && !TRANSACTIONAL_TYPES.has(type)) {
      const field = PREFERENCE_FIELD_BY_TYPE[type];
      if (field) {
        const pref = await prisma.notificationPreference.findUnique({ where: { userId } });
        if (pref && pref[field] === false) return;
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { expoPushToken: true, fcmToken: true },
    });

    const pushData = { ...payloadData, ...(secureData || {}), ...(type ? { type } : {}), ...(imageUrl ? { imageUrl } : {}) };

    // Every device this user has registered -- PushDevice rows if any exist
    // (multi-device), else a single-device fallback to the legacy User
    // columns. See utils/pushDevice.ts. One device failing must not block the
    // others; both senders already swallow their own errors.
    const devices = await resolvePushDevices(userId, { expo: user?.expoPushToken, fcm: user?.fcmToken });
    if (devices.length > 0) {
      const results = await Promise.all(
        devices.map(async (d) => ({
          platform: d.platform,
          ok:
            d.platform === 'FCM'
              ? await sendFcmPush(d.token, title, body, pushData, imageUrl)
              : await sendExpoPush(d.token, title, body, pushData),
        }))
      );

      // Analytics/retry bookkeeping (see admin.controller.ts's
      // getNotificationAnalytics and the delivery-retry sweep in
      // jobs/sweeper.ts). Only meaningful when the row was actually
      // persisted -- socketOnly already returned above.
      if (notificationId) {
        const deliveryStatus: Record<string, 'sent' | 'failed'> = {};
        for (const r of results) {
          const key = r.platform.toLowerCase();
          // A device that already succeeded on this platform wins over a
          // later-failing one of the same platform.
          if (deliveryStatus[key] !== 'sent') deliveryStatus[key] = r.ok ? 'sent' : 'failed';
        }
        const anySent = results.some((r) => r.ok);
        await prisma.notification
          .update({
            where: { id: notificationId },
            data: { deliveryStatus, ...(anySent ? { deliveredAt: new Date() } : {}) },
          })
          .catch((err) => console.error('Failed to record delivery status:', err));
      }
    }
  } catch (error) {
    console.error('notifyUser error:', error);
  }
};

// Bounded so a permanently-dead token (uninstalled app, revoked permission)
// doesn't get retried forever -- one retry is enough to ride out a
// transient Expo/FCM outage, which is the actual failure mode this protects
// against (see jobs/sweeper.ts's delivery-retry sweep).
const MAX_DELIVERY_RETRIES = 1;

/**
 * Re-attempts push delivery for notifications whose last attempt fully
 * failed (deliveredAt still null despite a deliveryStatus having been
 * recorded) and haven't exhausted their retry budget. Picked up by
 * jobs/sweeper.ts. Never throws -- a single row's failure must not stop the
 * rest of the batch.
 */
export async function retryFailedNotificationDeliveries(): Promise<{ retried: number; recovered: number }> {
  const candidates = await prisma.notification.findMany({
    where: { deliveredAt: null, deliveryStatus: { not: Prisma.JsonNull }, retryCount: { lt: MAX_DELIVERY_RETRIES } },
    take: 200,
  });

  let retried = 0;
  let recovered = 0;

  for (const n of candidates) {
    try {
      const user = await prisma.user.findUnique({ where: { id: n.userId }, select: { expoPushToken: true, fcmToken: true } });
      const devices = await resolvePushDevices(n.userId, { expo: user?.expoPushToken, fcm: user?.fcmToken });
      if (devices.length === 0) {
        // Nothing left to retry against -- bump the counter so this row
        // stops being picked up on every future tick.
        await prisma.notification.update({ where: { id: n.id }, data: { retryCount: { increment: 1 } } });
        continue;
      }

      const pushData = { ...((n.data as Record<string, unknown> | null) || {}), ...(n.type ? { type: n.type } : {}) };
      const results = await Promise.all(
        devices.map(async (d) => ({
          platform: d.platform,
          ok:
            d.platform === 'FCM'
              ? await sendFcmPush(d.token, n.title, n.body, pushData, n.imageUrl ?? undefined)
              : await sendExpoPush(d.token, n.title, n.body, pushData),
        }))
      );
      retried++;

      const deliveryStatus: Record<string, 'sent' | 'failed'> = {};
      for (const r of results) {
        const key = r.platform.toLowerCase();
        if (deliveryStatus[key] !== 'sent') deliveryStatus[key] = r.ok ? 'sent' : 'failed';
      }
      const anySent = results.some((r) => r.ok);
      if (anySent) recovered++;

      await prisma.notification.update({
        where: { id: n.id },
        data: { deliveryStatus, retryCount: { increment: 1 }, ...(anySent ? { deliveredAt: new Date() } : {}) },
      });
    } catch (error) {
      console.error(`retryFailedNotificationDeliveries: failed for notification ${n.id}:`, error);
    }
  }

  return { retried, recovered };
}

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
