import { SettlementStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { notifyUser } from '../utils/notify';

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
