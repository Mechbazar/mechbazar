import { Router } from 'express';
console.log('VENDOR ROUTES EVALUATED');
import { 
  getVendors, 
  createVendor, 
  updateVendor, 
  updateVendorStatus,
  loginVendor,
  registerPersonal,
  updateBusinessDetails,
  updateBankDetails,
  addDocument,
  submitForApproval,
  getMyProfile,
  getMyProducts,
  addMyProduct,
  getMyOrders,
  updateOrderStatus,
  getWalletDetails,
  requestPayout,
  getAllSettlements,
  updateSettlementStatus,
  // New endpoints
  getDashboardStats,
  updateMyProduct,
  deleteMyProduct,
  getVendorInventory,
  updateMyProfile,
} from '../controllers/vendor.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

const admins = [Role.ADMIN, Role.SUPER_ADMIN, Role.VENDOR_MANAGER];

// ----------------------------------------------------
// VENDOR PORTAL APIs (Public/Vendor Auth)
// ----------------------------------------------------
router.post('/login', loginVendor);
router.post('/register', registerPersonal);
router.post('/business', authenticate, authorize([Role.VENDOR]), updateBusinessDetails);
router.post('/bank', authenticate, authorize([Role.VENDOR]), updateBankDetails);
router.post('/documents', authenticate, authorize([Role.VENDOR]), addDocument);
router.post('/submit', authenticate, authorize([Role.VENDOR]), submitForApproval);

// Profile
router.get('/profile', authenticate, authorize([Role.VENDOR]), getMyProfile);
router.put('/profile', authenticate, authorize([Role.VENDOR]), updateMyProfile);

// Dashboard
router.get('/dashboard', authenticate, authorize([Role.VENDOR]), getDashboardStats);

// Products
router.get('/products', authenticate, authorize([Role.VENDOR]), getMyProducts);
router.post('/products', authenticate, authorize([Role.VENDOR]), addMyProduct);
router.put('/products/:id', authenticate, authorize([Role.VENDOR]), updateMyProduct);
router.delete('/products/:id', authenticate, authorize([Role.VENDOR]), deleteMyProduct);

// Orders
router.get('/orders', authenticate, authorize([Role.VENDOR]), getMyOrders);
router.patch('/orders/:id/status', authenticate, authorize([Role.VENDOR]), updateOrderStatus);

// Inventory
router.get('/inventory', authenticate, authorize([Role.VENDOR]), getVendorInventory);

// Wallet & Payouts
router.get('/wallet', authenticate, authorize([Role.VENDOR]), getWalletDetails);
router.post('/wallet/withdraw', authenticate, authorize([Role.VENDOR]), requestPayout);

// ----------------------------------------------------
// ADMIN APIs
// ----------------------------------------------------
router.get('/', authenticate, authorize(admins), getVendors);
router.post('/', authenticate, authorize(admins), createVendor);
router.put('/:id', authenticate, authorize(admins), updateVendor);
router.patch('/:id/status', authenticate, authorize(admins), updateVendorStatus);
router.get('/settlements', authenticate, authorize(admins), getAllSettlements);
router.patch('/settlements/:id/status', authenticate, authorize(admins), updateSettlementStatus);

export default router;
