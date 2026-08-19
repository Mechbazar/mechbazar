import { Router } from 'express';
import {
  getVendors,
  getTopVendors,
  createVendor,
  updateVendor,
  updateVendorStatus,
  deleteVendor,
  loginVendor,
  registerPersonal,
  updateBusinessDetails,
  updateBankDetails,
  addDocument,
  getVendorDocumentFile,
  submitForApproval,
  getMyProfile,
  getMyProducts,
  addMyProduct,
  getMyOrders,
  updateOrderStatus,
  getWalletDetails,
  requestPayout,
  getSalesChart,
  getAllSettlements,
  updateSettlementStatus,
  getVendorLeaderboard,
  // New endpoints
  getDashboardStats,
  updateMyProduct,
  deleteMyProduct,
  getVendorInventory,
  updateMyProfile,
} from '../controllers/vendor.controller';
import { authenticate, authorize, requireApprovedVendor } from '../middlewares/auth';
import { accountLoginLimiter } from '../middlewares/accountLoginLimiter';
import { vendorUpload } from '../middlewares/vendorUpload';
import { Role } from '@prisma/client';

const router = Router();

const admins = [Role.ADMIN, Role.SUPER_ADMIN, Role.VENDOR_MANAGER];

// MB-AUTH-004: matches the per-account lockout admin login already had --
// this route accepts idToken, email+password, or phone+otp, so key on
// whichever identifier the request actually used.
const vendorLoginLimiter = accountLoginLimiter(['email', 'phone'], 'vendor');

// ----------------------------------------------------
// VENDOR PORTAL APIs (Public/Vendor Auth)
// ----------------------------------------------------
router.get('/top', getTopVendors);
router.post('/login', vendorLoginLimiter, loginVendor);
router.post('/register', registerPersonal);
router.post('/business', authenticate, authorize([Role.VENDOR]), updateBusinessDetails);
router.post('/bank', authenticate, authorize([Role.VENDOR]), updateBankDetails);
router.post('/documents', authenticate, authorize([Role.VENDOR]), vendorUpload.single('file'), addDocument);
// No authorize() here -- matches riders.routes.ts's equivalent file route.
// The owner-or-admin check happens inside getVendorDocumentFile itself,
// since a broader set of admin-side roles (support/ops, not just the
// vendor-management admins list below) legitimately need to view KYC docs.
router.get('/:vendorId/documents/:documentId/file', authenticate, getVendorDocumentFile);
router.post('/submit', authenticate, authorize([Role.VENDOR]), submitForApproval);

// Profile
router.get('/profile', authenticate, authorize([Role.VENDOR]), getMyProfile);
router.put('/profile', authenticate, authorize([Role.VENDOR]), updateMyProfile);

// Dashboard
router.get('/dashboard', authenticate, authorize([Role.VENDOR]), getDashboardStats);
router.get('/dashboard/sales-chart', authenticate, authorize([Role.VENDOR]), getSalesChart);

// Products -- gated to APPROVED vendors only (MB-VENDOR-001: a PENDING
// vendor could otherwise create live, immediately-purchasable products).
router.get('/products', authenticate, authorize([Role.VENDOR]), requireApprovedVendor, getMyProducts);
router.post('/products', authenticate, authorize([Role.VENDOR]), requireApprovedVendor, addMyProduct);
router.put('/products/:id', authenticate, authorize([Role.VENDOR]), requireApprovedVendor, updateMyProduct);
router.delete('/products/:id', authenticate, authorize([Role.VENDOR]), requireApprovedVendor, deleteMyProduct);

// Orders
router.get('/orders', authenticate, authorize([Role.VENDOR]), requireApprovedVendor, getMyOrders);
router.patch('/orders/:id/status', authenticate, authorize([Role.VENDOR]), requireApprovedVendor, updateOrderStatus);

// Inventory
router.get('/inventory', authenticate, authorize([Role.VENDOR]), requireApprovedVendor, getVendorInventory);

// Wallet & Payouts -- balance view stays open (mirrors riders' GET
// /me/earnings), only the actual money-movement action is gated.
router.get('/wallet', authenticate, authorize([Role.VENDOR]), getWalletDetails);
router.post('/wallet/withdraw', authenticate, authorize([Role.VENDOR]), requireApprovedVendor, requestPayout);

// ----------------------------------------------------
// ADMIN APIs
// ----------------------------------------------------
router.get('/', authenticate, authorize(admins), getVendors);
router.post('/', authenticate, authorize(admins), createVendor);
router.put('/:id', authenticate, authorize(admins), updateVendor);
router.patch('/:id/status', authenticate, authorize(admins), updateVendorStatus);
// :id here is the Vendor (profile) id, same convention as the status route
// above -- not the User id PUT /:id uses.
router.delete('/:id', authenticate, authorize(admins), deleteVendor);
router.get('/settlements', authenticate, authorize(admins), getAllSettlements);
router.patch('/settlements/:id/status', authenticate, authorize(admins), updateSettlementStatus);
router.get('/leaderboard', authenticate, authorize(admins), getVendorLeaderboard);

export default router;
