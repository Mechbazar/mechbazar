import { Router } from 'express';
import { getPaymentConfig, verifyRazorpayPayment, handleRazorpayWebhook, reconcileOrderPayment } from '../controllers/payment.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { Role } from '@prisma/client';

// Keep in sync with ADMIN_ORDER_ROLES in order.controller.ts -- anyone who
// can see the Orders dashboard should also be able to trigger a recheck.
const admins = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.OPERATIONS_MANAGER,
  Role.INVENTORY_MANAGER,
  Role.VENDOR_MANAGER,
  Role.FINANCE_MANAGER,
  Role.CUSTOMER_SUPPORT,
];

const router = Router();

// Endpoint: GET /api/payments/config
// Description: Public -- tells the client whether online payment is available.
router.get('/config', getPaymentConfig);

// Endpoint: POST /api/payments/razorpay/verify
// Description: Client-side checkout-success acknowledgement (not the source of truth).
router.post('/razorpay/verify', authenticate, verifyRazorpayPayment);

// Endpoint: POST /api/payments/razorpay/webhook
// Description: Razorpay server callback. Body parsing (express.raw) is applied
// per-route in index.ts, ahead of the global express.json() middleware, so the
// raw bytes survive for signature verification.
router.post('/razorpay/webhook', handleRazorpayWebhook);

// Endpoint: POST /api/payments/:orderId/reconcile
// Description: Admin-only manual recheck against Razorpay for one order,
// ahead of the automatic sweep (jobs/sweeper.ts).
router.post('/:orderId/reconcile', authenticate, authorize(admins), reconcileOrderPayment);

export default router;
