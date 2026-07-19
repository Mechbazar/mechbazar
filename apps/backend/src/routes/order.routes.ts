import { Router } from 'express';
import { createOrder, getMyOrders, getAllOrders, getOrderById, assignRider, updateAdminOrderStatus, cancelMyOrder } from '../controllers/order.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { Role } from '@prisma/client';

// Keep this in sync with ADMIN_ORDER_ROLES in order.controller.ts so all
// admin-class users who can view orders are also authorized at the route layer.
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

// Endpoint: POST /api/orders
// Description: Place a new order from the cart
router.post('/', authenticate, createOrder);

// Endpoint: GET /api/orders/my-orders
// Description: Fetch orders for the authenticated customer
router.get('/my-orders', authenticate, getMyOrders);

// Endpoint: PATCH /api/orders/:id/cancel
// Description: Customer self-cancel, only while the order hasn't been picked up yet
router.patch('/:id/cancel', authenticate, cancelMyOrder);

// Admin Endpoints
router.get('/all', authenticate, authorize(admins), getAllOrders);
router.put('/:id/assign-rider', authenticate, authorize(admins), assignRider);
router.put('/:id/status', authenticate, authorize(admins), updateAdminOrderStatus);

// Endpoint: GET /api/orders/:id
// Description: Fetch a single order -- ownership/role-scoped inside the controller
// (customer who placed it, its assigned rider, a vendor with items in it, or an admin).
// Registered last so it doesn't shadow the more specific routes above.
router.get('/:id', authenticate, getOrderById);

export default router;
