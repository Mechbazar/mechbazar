import { Prisma } from '@prisma/client';

// Payment integration seam.
//
// TEST MODE (current state): no real payment gateway is wired up anywhere in
// this codebase. Every Order/ServiceBooking Payment is created PENDING and
// nothing ever marks it SUCCESS except an explicit admin action -- COD and
// "online" are both fulfilled without an actual charge. This file exists so
// order.controller.ts and service.controller.ts don't each hand-roll the
// same payment-shape/refund logic, and so a real gateway (Razorpay, etc.) has
// exactly one place to plug into later. See the integration notes at the
// bottom of this file.

export type PaymentMethodInput = 'COD' | 'online' | string | undefined | null;

// Normalizes whatever the client sent into the Prisma PaymentMethod enum.
// Anything other than the literal string 'online' is treated as COD -- this
// mirrors the two controllers' previous inline ternary exactly.
export function resolvePaymentMethod(paymentMethod: PaymentMethodInput): 'COD' | 'ONLINE' {
  return paymentMethod === 'online' ? 'ONLINE' : 'COD';
}

// Shape for a nested Prisma `payment: { create: ... }` write on Order/
// ServiceBooking. Every payment starts PENDING: TEST MODE has no gateway to
// confirm a charge synchronously, whether the customer picked COD or online.
export function pendingPaymentCreateInput(paymentMethod: PaymentMethodInput, amount: number) {
  return {
    method: resolvePaymentMethod(paymentMethod),
    status: 'PENDING' as const,
    amount,
  };
}

type RefundablePayment = { id: string; method: string; status: string; amount: number };

// Shared half of the refund path used by both order cancellation and booking
// refunds: credits the paying user's wallet if (and only if) the payment
// actually reached SUCCESS through a non-COD method. COD has nothing to
// refund since no money ever moved through the platform. Returns whether a
// credit happened, so callers can decide independently whether to flip the
// Payment row to REFUNDED and whether to notify the user -- those two
// callers have always had slightly different rules there, so this function
// intentionally does not touch Payment.status itself.
export async function creditWalletForOnlineRefund(
  tx: Prisma.TransactionClient,
  payment: RefundablePayment,
  walletOwnerId: string
): Promise<boolean> {
  const shouldCredit = payment.method !== 'COD' && payment.status === 'SUCCESS';
  if (shouldCredit) {
    await tx.user.update({
      where: { id: walletOwnerId },
      data: { wallet: { increment: payment.amount } },
    });
  }
  return shouldCredit;
}

// ---------------------------------------------------------------------------
// Future gateway integration point
// ---------------------------------------------------------------------------
// When a real provider (Razorpay, etc.) is ready to be wired in:
//   1. Add a `createGatewayOrder(amount, receiptId)` export here that calls
//      the provider's order-create API and returns a client-facing
//      order/session id for the app to open a checkout with.
//   2. Add a `verifyGatewayPayment(payload, signature)` export here that
//      verifies the provider's webhook/callback signature and returns the
//      paid amount, then have that handler flip the matching Payment row to
//      SUCCESS (nothing else does today -- see resolvePaymentMethod above).
//   3. Call these from order.controller.ts / service.controller.ts only when
//      resolvePaymentMethod(...) === 'ONLINE', gated by an env flag (e.g.
//      PAYMENT_PROVIDER=RAZORPAY) so COD keeps working unchanged if the
//      gateway is ever unconfigured or down.
// Until then, ONLINE payments are recorded accurately (so ops can see what
// the customer picked) but are functionally identical to COD: fulfilled
// without a real charge.
