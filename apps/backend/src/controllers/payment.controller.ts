import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/auth';
import { env, isRazorpayConfigured } from '../config/env';
import { verifyWebhookSignature, verifyPaymentSignature, reconcilePaymentWithGateway } from '../services/payment.service';

// Endpoint: GET /api/payments/config
// Description: Tells the client whether "Pay Online" should be offered at
// all. Deliberately server-driven (not a build-time flag) so a single app
// build works before and after Razorpay keys are set -- see config/env.ts.
export const getPaymentConfig = async (_req: Request, res: Response) => {
  res.status(200).json({
    razorpayEnabled: isRazorpayConfigured(),
    razorpayKeyId: isRazorpayConfigured() ? env.RAZORPAY_KEY_ID : undefined,
  });
};

// Endpoint: POST /api/payments/razorpay/verify
// Description: Called by the app immediately after the Razorpay checkout
// sheet reports success, purely to unblock the UI faster. It never itself
// marks a Payment SUCCESS -- only the signature-verified webhook below does
// that, since only Razorpay's server-to-server call is trustworthy enough to
// be the source of truth for "money moved."
export const verifyRazorpayPayment = async (req: AuthRequest, res: Response) => {
  if (!isRazorpayConfigured()) {
    return res.status(503).json({ error: 'Razorpay is not configured.' });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'razorpay_order_id, razorpay_payment_id and razorpay_signature are required.' });
  }

  const validSignature = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!validSignature) {
    return res.status(400).json({ error: 'Invalid payment signature.' });
  }

  const payment = await prisma.payment.findFirst({ where: { gatewayOrderId: razorpay_order_id } });
  if (!payment) {
    return res.status(404).json({ error: 'No payment found for this Razorpay order.' });
  }

  res.status(200).json({ message: 'Signature verified. Awaiting gateway confirmation.', paymentId: payment.id, status: payment.status });
};

// Endpoint: POST /api/payments/razorpay/webhook
// Description: Razorpay's server-to-server callback. Mounted with
// express.raw() (see index.ts) so the exact bytes Razorpay signed are
// available for HMAC verification -- re-serializing a parsed JSON body would
// not reproduce the same bytes and would make every signature check fail.
export const handleRazorpayWebhook = async (req: Request, res: Response) => {
  if (!isRazorpayConfigured()) {
    return res.status(503).json({ error: 'Razorpay is not configured.' });
  }

  const signature = req.headers['x-razorpay-signature'] as string | undefined;
  const rawBody = req.body as Buffer;

  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid webhook signature.' });
  }

  const event = JSON.parse(rawBody.toString('utf8'));
  const eventType: string = event.event;
  const paymentEntity = event.payload?.payment?.entity;

  if (!paymentEntity?.order_id) {
    // Not a payment event we care about (or malformed) -- ack so Razorpay
    // doesn't retry a delivery we're never going to act on.
    return res.status(200).json({ received: true });
  }

  const payment = await prisma.payment.findFirst({ where: { gatewayOrderId: paymentEntity.order_id } });
  if (!payment) {
    return res.status(200).json({ received: true });
  }

  // Idempotent on gatewayPaymentId: a webhook Razorpay redelivers (its own
  // retry policy, or a duplicate) for a payment already recorded is a no-op
  // rather than double-crediting or overwriting a later state with an earlier one.
  if (payment.gatewayPaymentId === paymentEntity.id && payment.status !== 'PENDING') {
    return res.status(200).json({ received: true });
  }

  if (eventType === 'payment.captured') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'SUCCESS', gatewayPaymentId: paymentEntity.id, transactionId: paymentEntity.id },
    });
  } else if (eventType === 'payment.failed') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        gatewayPaymentId: paymentEntity.id,
        failureReason: paymentEntity.error_description || 'Payment failed at gateway.',
      },
    });
  }

  res.status(200).json({ received: true });
};

// Endpoint: POST /api/payments/:orderId/reconcile
// Description: Admin-triggered fallback for ops to check a specific order's
// payment against Razorpay directly, without waiting for the sweep in
// jobs/sweeper.ts (reconcileStalePendingPayments) or a possibly-missed
// webhook. Shares the exact same status-mapping and idempotent-claim logic as
// both of those via reconcilePaymentWithGateway.
export const reconcileOrderPayment = async (req: AuthRequest, res: Response) => {
  if (!isRazorpayConfigured()) {
    return res.status(503).json({ error: 'Razorpay is not configured.' });
  }

  const orderId = String(req.params.orderId);
  const payment = await prisma.payment.findUnique({ where: { orderId } });
  if (!payment) {
    return res.status(404).json({ error: 'No payment found for this order.' });
  }
  if (payment.method !== 'RAZORPAY') {
    return res.status(400).json({ error: 'This order was not paid online.' });
  }
  if (!payment.gatewayOrderId) {
    return res.status(400).json({ error: 'No gateway order was ever created for this payment -- nothing to check.' });
  }
  if (payment.status !== 'PENDING') {
    return res.status(200).json({ message: `Payment already ${payment.status}; nothing to reconcile.`, status: payment.status });
  }

  const outcome = await reconcilePaymentWithGateway(payment.id, payment.gatewayOrderId, orderId);
  const updated = await prisma.payment.findUnique({ where: { id: payment.id } });

  res.status(200).json({
    message:
      outcome.result === 'still-pending'
        ? 'Razorpay has not reached a final outcome for this payment yet.'
        : `Payment reconciled as ${outcome.result}.`,
    status: updated?.status ?? payment.status,
  });
};
