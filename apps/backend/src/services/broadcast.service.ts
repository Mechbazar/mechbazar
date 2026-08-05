import { Prisma, Role } from '@prisma/client';
import prisma from '../config/prisma';
import { notifyUser } from '../utils/notify';

// Shared by admin.controller.ts's immediate broadcastNotification and
// jobs/sweeper.ts's scheduled-notification sweep -- one audience-resolution
// path so the two can never drift on what "send to ALL_CUSTOMERS in Pune"
// actually means.

export type BroadcastAudience = 'ALL_CUSTOMERS' | 'ALL_VENDORS' | 'ALL_TECHNICIANS' | 'ALL_RIDERS';

export const AUDIENCE_ROLE: Record<BroadcastAudience, Role> = {
  ALL_CUSTOMERS: Role.CUSTOMER,
  ALL_VENDORS: Role.VENDOR,
  ALL_TECHNICIANS: Role.SERVICE_TECHNICIAN,
  ALL_RIDERS: Role.DELIVERY_PARTNER,
};

export interface BroadcastFilters {
  audience: BroadcastAudience;
  /** Matched against User.city OR any of the user's saved Address.city (case-insensitive). */
  city?: string;
  /** Same matching as city, against state. */
  state?: string;
  /** Matched against User.preferredLanguage (case-insensitive). No language set on an account excludes it -- an unset filter (the common case) skips this check entirely. */
  language?: string;
}

export function isBroadcastAudience(value: unknown): value is BroadcastAudience {
  return typeof value === 'string' && value in AUDIENCE_ROLE;
}

export async function resolveBroadcastRecipients(filters: BroadcastFilters): Promise<{ id: string }[]> {
  const role = AUDIENCE_ROLE[filters.audience];
  const and: Prisma.UserWhereInput[] = [];

  // City/state can live on the User row itself (set for B2B accounts, see
  // User.city/state) or only on one of their saved Addresses (the common
  // case for a regular customer) -- match either so a broadcast targeting a
  // city doesn't silently miss most customers.
  if (filters.city) {
    and.push({
      OR: [
        { city: { equals: filters.city, mode: 'insensitive' } },
        { addresses: { some: { city: { equals: filters.city, mode: 'insensitive' } } } },
      ],
    });
  }
  if (filters.state) {
    and.push({
      OR: [
        { state: { equals: filters.state, mode: 'insensitive' } },
        { addresses: { some: { state: { equals: filters.state, mode: 'insensitive' } } } },
      ],
    });
  }
  if (filters.language) {
    and.push({ preferredLanguage: { equals: filters.language, mode: 'insensitive' } });
  }

  return prisma.user.findMany({
    where: { roles: { has: role }, ...(and.length ? { AND: and } : {}) },
    select: { id: true },
  });
}

// Each recipient still goes through notifyUser individually (not a raw batch
// push) -- every recipient needs their own persisted Notification row,
// preference check, and socket emit, not just a push send. What's bounded
// here is the *fan-out*: an unbounded Promise.all over a large audience would
// fire thousands of concurrent DB writes + Expo/FCM HTTP calls at once,
// which is the actual rate-limit risk, not any single send.
const BROADCAST_FANOUT_CHUNK_SIZE = 50;
const BROADCAST_FANOUT_DELAY_MS = 250;

/** Resolves the audience and fans the message out via notifyUser, chunked. Returns how many recipients it targeted. */
export async function sendBroadcast(title: string, body: string, filters: BroadcastFilters): Promise<number> {
  const recipients = await resolveBroadcastRecipients(filters);
  for (let i = 0; i < recipients.length; i += BROADCAST_FANOUT_CHUNK_SIZE) {
    const chunk = recipients.slice(i, i + BROADCAST_FANOUT_CHUNK_SIZE);
    await Promise.all(chunk.map((r) => notifyUser(r.id, title, body, {}, { type: 'ADMIN_BROADCAST' })));
    if (i + BROADCAST_FANOUT_CHUNK_SIZE < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, BROADCAST_FANOUT_DELAY_MS));
    }
  }
  return recipients.length;
}

/**
 * Picked up by jobs/sweeper.ts. Claims each due row (an atomic conditional
 * update, same pattern as dispatch.service.ts's sweepExpiredAssignments) before
 * sending it, so two overlapping sweep ticks -- or two backend instances,
 * once this runs behind a load balancer -- can never double-send the same
 * scheduled broadcast.
 */
export async function sweepScheduledNotifications(): Promise<{ sent: number; failed: number }> {
  const due = await prisma.scheduledNotification.findMany({
    where: { status: 'PENDING', sendAt: { lte: new Date() } },
  });

  let sent = 0;
  let failed = 0;

  for (const row of due) {
    const claim = await prisma.scheduledNotification.updateMany({
      where: { id: row.id, status: 'PENDING' },
      data: { status: 'SENT', sentAt: new Date() },
    });
    if (claim.count === 0) continue; // another sweep tick/instance already claimed it

    try {
      const filters = row.audience as unknown as BroadcastFilters;
      const count = await sendBroadcast(row.title, row.body, filters);
      await prisma.scheduledNotification.update({ where: { id: row.id }, data: { sentCount: count } });
      sent++;
    } catch (error) {
      await prisma.scheduledNotification.update({
        where: { id: row.id },
        data: { status: 'FAILED', failureReason: error instanceof Error ? error.message : 'Unknown error' },
      });
      failed++;
    }
  }

  return { sent, failed };
}
