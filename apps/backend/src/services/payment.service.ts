import { Prisma, PaymentMethod, PaymentStatus } from '@prisma/client';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { env, isRazorpayConfigured } from '../config/env';
import prisma from '../config/prisma';

// Payment policy: CASH ON DELIVERY, with an online option that only appears
// once Razorpay is actually configured (see config/env.ts, isRazorpayConfigured).
//
// Until RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET are all set, this behaves
// exactly as it always has: there is no gateway, no code path that can charge
// a customer, and every Order/ServiceBooking is settled in cash.
//
// This used to accept a client-supplied `paymentMethod` and record 'ONLINE'
// whenever the request body said so. Nothing ever charged those orders -- they
// were fulfilled exactly like COD -- so the platform could hand a customer a
// record saying their order was paid online when no money had moved. That is a
// misrepresentation under the Consumer Protection (E-Commerce) Rules, 2020 and
// contradicts every published policy page. The client's requested method is
// therefore never trusted on its own: it only takes effect when Razorpay is
// configured, and even then the server (not the client) computes the amount
// actually charged.
//
// If Razorpay is configured: at minimum a server-side order-create call, a
// signature-verified webhook that flips Payment.status to SUCCESS, idempotency
// on that webhook, and refund-to-source all have to work end to end -- see
// createRazorpayOrder/verifyWebhookSignature below and routes/payment.routes.ts.

export type PaymentMethodInput = 'COD' | 'RAZORPAY' | string | undefined | null;

/**
 * Resolves the payment method actually used to create the Payment row.
 * Falls back to COD unless Razorpay is configured, the caller explicitly
 * opts in via `allowOnline` (only order.controller.ts does today -- a
 * Razorpay gateway order is only ever created there, see
 * createRazorpayOrder's one call site), AND the client asked for RAZORPAY.
 * Without `allowOnline`, a caller (e.g. service.controller.ts's booking
 * creation) can never produce a Payment row that claims to be RAZORPAY with
 * no gateway order behind it -- that would leave a booking permanently
 * "PENDING online payment" with no checkout flow able to ever pay it off.
 * The client's vote only matters when there is a real gateway behind it -- it
 * can never make an order appear paid online on its own.
 */
export function resolvePaymentMethod(
  paymentMethod?: PaymentMethodInput,
  options: { allowOnline?: boolean } = {}
): PaymentMethod {
  if (options.allowOnline && isRazorpayConfigured() && paymentMethod === 'RAZORPAY') {
    return 'RAZORPAY';
  }
  return 'COD';
}

// Shape for a nested Prisma `payment: { create: ... }` write on Order/
// ServiceBooking. Payments start PENDING. A COD Payment row stays PENDING for
// its whole life -- cash collection is tracked on Order.codCollected instead,
// checked directly in order.controller.ts's updateMyDeliveryStatus. RAZORPAY
// is the only method whose Payment.status actually moves, to SUCCESS/FAILED,
// done by the webhook handler once the gateway confirms it.
export function pendingPaymentCreateInput(
  paymentMethod: PaymentMethodInput,
  amount: number,
  options: { allowOnline?: boolean } = {}
) {
  return {
    method: resolvePaymentMethod(paymentMethod, options),
    status: 'PENDING' as PaymentStatus,
    amount,
  };
}

let razorpayClient: Razorpay | null = null;
function getRazorpayClient(): Razorpay {
  if (!isRazorpayConfigured()) {
    throw new Error('Razorpay is not configured.');
  }
  if (!razorpayClient) {
    razorpayClient = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  }
  return razorpayClient;
}

/**
 * Creates the gateway-side order that the mobile app's Razorpay checkout SDK
 * opens against. `receipt` is our own Order id, so the gateway order can
 * always be traced back to the Order that requested it. Amount is in rupees
 * here; Razorpay wants paise, so the conversion happens at the one call site.
 */
export async function createRazorpayOrder(amount: number, receipt: string) {
  const client = getRazorpayClient();
  return client.orders.create({
    amount: Math.round(amount * 100),
    currency: 'INR',
    receipt,
  });
}

/**
 * Verifies the HMAC-SHA256 signature Razorpay attaches to a webhook delivery.
 * Uses a timing-safe comparison so response-time doesn't leak how much of the
 * signature matched. Returns false (never throws) on any malformed input so
 * callers can treat "not verified" uniformly as reject-with-401.
 */
export function verifyWebhookSignature(rawBody: Buffer | string, signatureHeader: string | undefined): boolean {
  if (!isRazorpayConfigured() || !signatureHeader) return false;
  try {
    const expected = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const actualBuf = Buffer.from(signatureHeader, 'utf8');
    return expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

/**
 * Verifies the signature Razorpay's client-side checkout handler returns on
 * success (`razorpay_order_id|razorpay_payment_id` signed with the key
 * secret). This is defense-in-depth for the immediate UI response only -- the
 * webhook remains the sole source of truth for flipping Payment.status.
 */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!isRazorpayConfigured()) return false;
  try {
    const expected = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const actualBuf = Buffer.from(signature, 'utf8');
    return expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

type RefundablePayment = { id: string; method: PaymentMethod; status: PaymentStatus; amount: number };

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
// Reconciliation -- the fallback for a webhook that never arrives
// ---------------------------------------------------------------------------
// handleRazorpayWebhook is the source of truth when it fires, but nothing
// guarantees delivery: Razorpay retries a handful of times and gives up,
// and an outage on our side during that window drops the event permanently.
// A Payment left behind in PENDING that way would never resolve on its own --
// the order just sits there forever looking unpaid even though the customer
// was charged. This polls Razorpay directly for exactly those stragglers.

// How long a RAZORPAY payment is allowed to sit PENDING before it's treated
// as a possible missed webhook and polled directly. Short enough to catch a
// dropped webhook within one operational shift; long enough that a payment
// still genuinely in progress (bank/UPI app not yet confirmed) isn't queried
// on top of the checkout flow's own polling.
const STALE_PENDING_MINUTES = 10;

type ReconcileOutcome = { paymentId: string; orderId: string | null; result: 'SUCCESS' | 'FAILED' | 'still-pending' };

/**
 * Finds every RAZORPAY payment old enough to suspect its webhook was missed,
 * and independently asks Razorpay what actually happened to it. Safe to call
 * on a schedule or on demand (e.g. an admin "recheck payment" action) -- each
 * payment is only ever moved out of PENDING once, via the same atomic claim
 * the webhook itself would use, so a webhook arriving mid-poll and this
 * function can never both apply a result to the same row.
 */
export async function reconcileStalePendingPayments(): Promise<ReconcileOutcome[]> {
  if (!isRazorpayConfigured()) return [];

  const cutoff = new Date(Date.now() - STALE_PENDING_MINUTES * 60 * 1000);
  const stalePayments = await prisma.payment.findMany({
    where: {
      method: 'RAZORPAY',
      status: 'PENDING',
      gatewayOrderId: { not: null },
      createdAt: { lt: cutoff },
    },
    select: { id: true, gatewayOrderId: true, orderId: true },
  });

  const outcomes: ReconcileOutcome[] = [];
  for (const payment of stalePayments) {
    outcomes.push(await reconcilePaymentWithGateway(payment.id, payment.gatewayOrderId!, payment.orderId));
  }
  return outcomes;
}

/**
 * Reconciles one payment against Razorpay's records by gateway order id.
 * Shared by the sweep above and the admin-triggered manual recheck
 * (controllers/payment.controller.ts) so both paths apply identical
 * status-mapping and idempotency rules.
 */
export async function reconcilePaymentWithGateway(
  paymentId: string,
  gatewayOrderId: string,
  orderId: string | null = null
): Promise<ReconcileOutcome> {
  const client = getRazorpayClient();
  const { items } = await client.orders.fetchPayments(gatewayOrderId);

  // A customer can retry after a failed attempt, so one gateway order can
  // have several payment attempts against it. A captured attempt always wins,
  // even if an earlier attempt in the list failed first.
  const captured = items.find((p) => p.status === 'captured');
  const latest = captured || items[items.length - 1];

  if (!latest) {
    return { paymentId, orderId, result: 'still-pending' };
  }

  let update: Prisma.PaymentUpdateInput | null = null;
  let result: ReconcileOutcome['result'] = 'still-pending';

  if (latest.status === 'captured') {
    update = { status: 'SUCCESS', gatewayPaymentId: latest.id, transactionId: latest.id };
    result = 'SUCCESS';
  } else if (latest.status === 'failed') {
    update = {
      status: 'FAILED',
      gatewayPaymentId: latest.id,
      failureReason: latest.error_description || 'Payment failed at gateway.',
    };
    result = 'FAILED';
  }

  if (!update) {
    // created/authorized: Razorpay hasn't reached a terminal state yet --
    // nothing to record, try again on the next sweep.
    return { paymentId, orderId, result: 'still-pending' };
  }

  // Atomic claim: only applies if the row is still PENDING at write time. If
  // the webhook lands concurrently with this poll (or already has), that
  // write wins and this one becomes a no-op rather than overwriting it.
  await prisma.payment.updateMany({
    where: { id: paymentId, status: 'PENDING' },
    data: update,
  });

  return { paymentId, orderId, result };
}

// ---------------------------------------------------------------------------
// Current state: Razorpay is fully wired (order-create, signature-verified
// webhook, idempotency, this reconciliation sweep, and wallet refund-to-ledger
// on cancellation) but stays completely dormant -- every order is COD -- until
// RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET are all set. Until then, every
// customer-facing surface (app UI, policy pages, store listings) must continue
// to say Cash on Delivery only.
