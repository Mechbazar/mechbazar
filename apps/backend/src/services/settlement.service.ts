import { SettlementStatus, SettlementCycle } from '@prisma/client';
import prisma from '../config/prisma';
import { notifyUser } from '../utils/notify';
import { getPlatformCommissionSettings, round2 } from './commission.service';

// VendorSettlement, RiderSettlement, and TechnicianSettlement are three
// otherwise-unrelated payout ledgers (different owning entity, different
// wallet credited back on failure) that all move through the exact same
// PENDING/PROCESSING -> COMPLETED/FAILED state machine. This is the one place
// that state machine is written; vendor.controller.ts, rider.controller.ts,
// and technician.controller.ts each supply only the model-specific bits
// (which delegate, which wallet to credit back).

export class SettlementNotFoundError extends Error {}
export class SettlementAlreadyFinalisedError extends Error {}
export class SettlementChangedConcurrentlyError extends Error {}

type SettlementRow = { id: string; amount: number; status: SettlementStatus };

/** Throws one of the errors above (never returns) if `status` isn't a valid transition target. */
export function assertValidSettlementStatus(status: unknown): asserts status is SettlementStatus {
  if (!Object.values(SettlementStatus).includes(status as SettlementStatus)) {
    throw new RangeError(`Invalid status "${status}". Must be one of ${Object.values(SettlementStatus).join(', ')}.`);
  }
}

interface SettlementDelegate<T extends SettlementRow> {
  updateMany(args: { where: { id: string; status: SettlementStatus }; data: { status: SettlementStatus; transactionId?: string } }): Promise<{ count: number }>;
  findUniqueOrThrow(args: { where: { id: string } }): Promise<T>;
}

/**
 * Runs the shared transition for one settlement row: validates the requested
 * status, atomically claims the transition (re-checked under Postgres's row
 * lock at UPDATE time, not against a stale earlier read -- guards against two
 * concurrent/duplicated requests both crediting the wallet back for the same
 * settlement), and credits the owning wallet back if the transition is to
 * FAILED. `delegate` and `creditBackOnFailure` are the only model-specific
 * pieces each caller supplies; `resolveOwnerUserId` is the same idea for
 * notifications -- this function doesn't know whether it's talking to a
 * Vendor, DeliveryPartner, or ServiceTechnician, so it can't look up their
 * User row itself.
 */
export async function transitionSettlement<T extends SettlementRow>(
  settlement: T,
  status: unknown,
  transactionId: string | undefined,
  delegate: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => SettlementDelegate<T>,
  creditBackOnFailure: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<void>,
  resolveOwnerUserId: () => Promise<string | null>
): Promise<T> {
  assertValidSettlementStatus(status);

  if (settlement.status === 'COMPLETED' || settlement.status === 'FAILED') {
    throw new SettlementAlreadyFinalisedError();
  }

  const updated = await prisma.$transaction(async (tx) => {
    const claim = await delegate(tx).updateMany({
      where: { id: settlement.id, status: settlement.status },
      data: { status, transactionId },
    });
    if (claim.count === 0) {
      throw new SettlementChangedConcurrentlyError();
    }
    if (status === 'FAILED') {
      await creditBackOnFailure(tx);
    }
    return delegate(tx).findUniqueOrThrow({ where: { id: settlement.id } });
  });

  // Fire-and-forget, after commit -- a payout completing or (more
  // importantly) failing and reverting to the wallet was previously silent
  // to the affected vendor/rider/mechanic except by polling their payout
  // history. notifyUser already swallows its own errors, so this can't fail
  // or roll back the transition that already committed above.
  resolveOwnerUserId()
    .then((userId) => {
      if (!userId) return;
      const amountLabel = `₹${settlement.amount.toFixed(2)}`;
      if (status === 'FAILED') {
        notifyUser(userId, 'Payout failed', `Your payout of ${amountLabel} could not be completed and has been credited back to your wallet.`, { settlementId: settlement.id, status });
      } else if (status === 'COMPLETED') {
        notifyUser(userId, 'Payout completed', `Your payout of ${amountLabel} has been completed.`, { settlementId: settlement.id, status });
      } else {
        notifyUser(userId, 'Payout update', `Your payout of ${amountLabel} is now ${String(status).replace(/_/g, ' ').toLowerCase()}.`, { settlementId: settlement.id, status });
      }
    })
    .catch((error) => console.error('transitionSettlement: failed to resolve owner for notification:', error));

  return updated;
}

// =======================
// Scheduled (admin-cycle-driven) settlement generation
// =======================
//
// Existing requestPayout (vendor/rider/technician-initiated) is untouched --
// this is the complementary admin-driven path: each payee has a
// settlementCycle (DAILY/WEEKLY/MONTHLY, default from
// PlatformCommissionSettings.defaultSettlementCycle) and once that long has
// passed since their last generated settlement, a PENDING settlement is
// auto-created for their current wallet balance. Called from the sweeper
// (jobs/sweeper.ts) on the same "fire regularly, tolerate a missed tick"
// pattern as its other maintenance sweeps -- a late settlement is a delay,
// never a correctness problem, so an hourly cadence is more than enough.

const CYCLE_MS: Record<SettlementCycle, number> = {
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
  MONTHLY: 30 * 24 * 60 * 60 * 1000,
};

function isCycleDue(lastGeneratedAt: Date | null, createdAt: Date, cycle: SettlementCycle, now: Date): boolean {
  const windowStart = lastGeneratedAt ?? createdAt;
  return now.getTime() - windowStart.getTime() >= CYCLE_MS[cycle];
}

// Sums the RAZORPAY-paid portion of a payee's net earnings since `sinceDate`
// (via the CommissionRecord ledger, joined back to the order/booking's own
// Payment row) and applies gatewayFeePercent to just that portion -- COD
// orders carry no gateway fee. Returns 0 immediately when the rate is 0 (the
// common case today: Razorpay exists in code but is unconfigured/inert in
// production, so this stays a no-op query until it's actually turned on).
async function computeGatewayFee(
  entity: { vendorId: string } | { technicianId: string },
  sinceDate: Date,
  gatewayFeePercent: number
): Promise<number> {
  if (gatewayFeePercent <= 0) return 0;

  const records =
    'vendorId' in entity
      ? await prisma.commissionRecord.findMany({
          where: { vendorId: entity.vendorId, sourceType: 'PRODUCT_ORDER', createdAt: { gte: sinceDate }, netPayoutAmount: { gt: 0 } },
          select: { netPayoutAmount: true, order: { select: { payment: { select: { method: true, status: true } } } } },
        })
      : await prisma.commissionRecord.findMany({
          where: { technicianId: entity.technicianId, sourceType: 'SERVICE_BOOKING', createdAt: { gte: sinceDate }, netPayoutAmount: { gt: 0 } },
          select: { netPayoutAmount: true, serviceBooking: { select: { payment: { select: { method: true, status: true } } } } },
        });

  const razorpayNet = records.reduce((sum, r: any) => {
    const payment = r.order?.payment ?? r.serviceBooking?.payment;
    return payment?.method === 'RAZORPAY' && payment?.status === 'SUCCESS' ? sum + r.netPayoutAmount : sum;
  }, 0);

  return round2((razorpayNet * gatewayFeePercent) / 100);
}

export type SettlementGenerationSummary = { vendors: number; riders: number; technicians: number };

export async function generateScheduledSettlements(): Promise<SettlementGenerationSummary> {
  const settings = await getPlatformCommissionSettings();
  const now = new Date();
  const summary: SettlementGenerationSummary = { vendors: 0, riders: 0, technicians: 0 };

  const dueVendors = await prisma.vendor.findMany({
    where: { walletBalance: { gt: 0 }, settlements: { none: { status: 'PENDING' } } },
    select: { id: true, walletBalance: true, settlementCycle: true, lastSettlementGeneratedAt: true, createdAt: true },
  });
  for (const vendor of dueVendors) {
    if (!isCycleDue(vendor.lastSettlementGeneratedAt, vendor.createdAt, vendor.settlementCycle, now)) continue;
    const windowStart = vendor.lastSettlementGeneratedAt ?? vendor.createdAt;

    const created = await prisma.$transaction(async (tx) => {
      const claim = await tx.vendor.updateMany({
        where: { id: vendor.id, walletBalance: { gte: vendor.walletBalance } },
        data: { walletBalance: { decrement: vendor.walletBalance }, lastSettlementGeneratedAt: now },
      });
      if (claim.count === 0) return false;
      const gatewayFee = await computeGatewayFee({ vendorId: vendor.id }, windowStart, settings.gatewayFeePercent);
      const amount = round2(Math.max(0, vendor.walletBalance - gatewayFee));
      if (amount > 0) {
        await tx.vendorSettlement.create({ data: { vendorId: vendor.id, amount, status: 'PENDING', type: 'ADMIN_GENERATED' } });
      }
      return true;
    });
    if (created) summary.vendors++;
  }

  const dueRiders = await prisma.deliveryPartner.findMany({
    where: { walletBalance: { gt: 0 }, settlements: { none: { status: 'PENDING' } } },
    select: { id: true, walletBalance: true, settlementCycle: true, lastSettlementGeneratedAt: true, createdAt: true },
  });
  for (const rider of dueRiders) {
    if (!isCycleDue(rider.lastSettlementGeneratedAt, rider.createdAt, rider.settlementCycle, now)) continue;

    const created = await prisma.$transaction(async (tx) => {
      const claim = await tx.deliveryPartner.updateMany({
        where: { id: rider.id, walletBalance: { gte: rider.walletBalance } },
        data: { walletBalance: { decrement: rider.walletBalance }, lastSettlementGeneratedAt: now },
      });
      if (claim.count === 0) return false;
      // No gateway-fee concept for rider payouts -- there is no commission
      // split on delivery fees, only on product/service sale amounts.
      await tx.riderSettlement.create({ data: { deliveryPartnerId: rider.id, amount: rider.walletBalance, status: 'PENDING', type: 'ADMIN_GENERATED' } });
      return true;
    });
    if (created) summary.riders++;
  }

  const dueTechnicians = await prisma.serviceTechnician.findMany({
    where: { walletBalance: { gt: 0 }, settlements: { none: { status: 'PENDING' } } },
    select: { id: true, walletBalance: true, settlementCycle: true, lastSettlementGeneratedAt: true, createdAt: true },
  });
  for (const tech of dueTechnicians) {
    if (!isCycleDue(tech.lastSettlementGeneratedAt, tech.createdAt, tech.settlementCycle, now)) continue;
    const windowStart = tech.lastSettlementGeneratedAt ?? tech.createdAt;

    const created = await prisma.$transaction(async (tx) => {
      const claim = await tx.serviceTechnician.updateMany({
        where: { id: tech.id, walletBalance: { gte: tech.walletBalance } },
        data: { walletBalance: { decrement: tech.walletBalance }, lastSettlementGeneratedAt: now },
      });
      if (claim.count === 0) return false;
      const gatewayFee = await computeGatewayFee({ technicianId: tech.id }, windowStart, settings.gatewayFeePercent);
      const amount = round2(Math.max(0, tech.walletBalance - gatewayFee));
      if (amount > 0) {
        await tx.technicianSettlement.create({ data: { technicianId: tech.id, amount, status: 'PENDING', type: 'ADMIN_GENERATED' } });
      }
      return true;
    });
    if (created) summary.technicians++;
  }

  return summary;
}
