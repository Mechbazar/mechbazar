import { Prisma } from '@prisma/client';

// Payment policy: CASH ON DELIVERY ONLY.
//
// MechBazar has no payment gateway. There is no Razorpay, Stripe, PhonePe,
// Paytm, UPI collect, card, net-banking or wallet integration anywhere in this
// codebase, and no code path that can charge a customer. Every Order and
// ServiceBooking is settled in cash at the door / on service completion.
//
// This used to accept a client-supplied `paymentMethod` and record 'ONLINE'
// whenever the request body said so. Nothing ever charged those orders -- they
// were fulfilled exactly like COD -- so the platform could hand a customer a
// record saying their order was paid online when no money had moved. That is a
// misrepresentation under the Consumer Protection (E-Commerce) Rules, 2020 and
// contradicts every published policy page, so the method is now server-decided
// and the client's value is ignored entirely.

export type PaymentMethodInput = 'COD' | string | undefined | null;

/**
 * Always resolves to COD. The parameter is retained so the two call sites
 * (order.controller.ts, service.controller.ts) don't need to change shape, and
 * so the one place that has to be edited when a gateway is finally integrated
 * stays obvious -- but the client no longer gets a vote.
 */
export function resolvePaymentMethod(_paymentMethod?: PaymentMethodInput): 'COD' {
  return 'COD';
}

// Shape for a nested Prisma `payment: { create: ... }` write on Order/
// ServiceBooking. Payments start PENDING and are marked SUCCESS when the rider
// or technician records cash collected at fulfilment.
export function pendingPaymentCreateInput(paymentMethod: PaymentMethodInput, amount: number) {
  return {
    method: resolvePaymentMethod(paymentMethod),
    status: 'PENDING' as const,
    amount,
  };
}

type RefundablePayment = { id: string; method: string; status: string; amount: number };

/**
 * Refund path for cancellations.
 *
 * Under COD no money reaches the platform before fulfilment, so a cancelled
 * order has nothing to refund and this is a no-op for every order placed
 * today. It still handles the historical case: rows written before the
 * COD-only lock could carry method='ONLINE', and if such a row ever reached
 * SUCCESS the amount is credited to the user's ledger rather than silently
 * dropped. Returns whether a credit happened so callers can decide separately
 * whether to flip Payment.status to REFUNDED and whether to notify the user.
 */
export async function creditWalletForLegacyOnlineRefund(
  tx: Prisma.TransactionClient,
  payment: RefundablePayment,
  walletOwnerId: string
): Promise<boolean> {
  const shouldCredit = payment.method !== 'COD' && payment.status === 'SUCCESS';
  if (shouldCredit) {
    console.warn(
      `[payment] crediting legacy non-COD refund for payment ${payment.id} (method=${payment.method})`
    );
    await tx.user.update({
      where: { id: walletOwnerId },
      data: { wallet: { increment: payment.amount } },
    });
  }
  return shouldCredit;
}

// Kept as an alias so existing imports keep compiling; prefer the explicit
// `creditWalletForLegacyOnlineRefund` name in new code.
export const creditWalletForOnlineRefund = creditWalletForLegacyOnlineRefund;

// ---------------------------------------------------------------------------
// If a payment gateway is ever introduced
// ---------------------------------------------------------------------------
// Do NOT simply re-enable a client-supplied payment method. A gateway needs,
// at minimum: a server-side order-create call, signature-verified webhook
// handling that flips Payment.status to SUCCESS, idempotency on that webhook,
// a reconciliation job, and refund-to-source. Until all of that exists, every
// customer-facing surface (app UI, policy pages, store listings) must continue
// to say Cash on Delivery only.
