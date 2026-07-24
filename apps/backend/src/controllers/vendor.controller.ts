import { Request, Response } from 'express';
import { Role, VendorStatus, OrderStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import { generateToken } from '../utils/jwt';
import { AuthRequest } from '../middlewares/auth';
import { restoreOrderStock, creditOrderDelivery } from './order.controller';
import { notifyUser } from '../utils/notify';
import { sanitizeUser, sanitizeUsers, sanitizeOrders, stripDeliveryOtp, stripDeliveryOtps } from '../utils/sanitizeUser';
import { recordAuditLog } from '../utils/auditLog';
import prisma from '../config/prisma';

// ----------------------------------------------------
// VENDOR PORTAL APIs (Used by Vendor Frontend)
// ----------------------------------------------------

// Public, customer-facing "Top Vendors" homepage widget. Deliberately
// separate from the admin-only getVendors below, which includes documents
// and bank accounts -- this only ever selects storeName/categories/product
// stats, never anything from the vendor's KYC/banking records.
export const getTopVendors = async (req: Request, res: Response): Promise<void> => {
  try {
    const vendors = await prisma.vendor.findMany({
      where: { status: VendorStatus.APPROVED, isActive: true },
      select: {
        id: true,
        storeName: true,
        categories: true,
        products: { where: { status: 'APPROVED' }, select: { salesCount: true } },
      },
    });

    const ranked = vendors
      .map(v => ({
        id: v.id,
        storeName: v.storeName,
        categories: v.categories,
        productCount: v.products.length,
        salesCount: v.products.reduce((sum, p) => sum + (p.salesCount || 0), 0),
      }))
      .filter(v => v.productCount > 0)
      .sort((a, b) => b.salesCount - a.salesCount || b.productCount - a.productCount)
      .slice(0, 8)
      .map(({ id, storeName, categories, productCount, salesCount }) => ({ id, storeName, categories, productCount, salesCount }));

    res.json(ranked);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch top vendors' });
  }
};

export const loginVendor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { vendorProfile: true } 
    });
    
    if (!user || user.role !== Role.VENDOR) {
      res.status(401).json({ error: 'Invalid credentials or not a vendor' });
      return;
    }

    if (!user.password) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken(user.id, user.role);

    res.status(200).json({ token, user: sanitizeUser(user), vendor: user.vendorProfile });
  } catch (error) {
    console.error('Error logging in vendor:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

export const registerPersonal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, phone, email, password } = req.body;
    
    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      res.status(400).json({ error: 'User with this phone number already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        phone,
        email: email || null,
        password: hashedPassword,
        role: Role.VENDOR,
      }
    });

    const vendor = await prisma.vendor.create({
      data: {
        userId: user.id,
        storeName: 'My Store', // Temporary, updated in business step
        status: VendorStatus.PENDING,
      }
    });

    const token = generateToken(user.id, user.role);

    res.status(201).json({ token, user: sanitizeUser(user), vendor });
  } catch (error) {
    console.error('Error registering vendor:', error);
    res.status(500).json({ error: 'Failed to register vendor' });
  }
};

export const updateBusinessDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { storeName, gstNumber, panNumber, businessType, categories, city, state } = req.body;

    const vendor = await prisma.vendor.update({
      where: { userId },
      data: {
        storeName,
        gstNumber,
        panNumber,
        businessType,
        categories: categories || [],
        user: {
          update: {
            city,
            state
          }
        }
      }
    });

    res.status(200).json(vendor);
  } catch (error) {
    console.error('Error updating business details:', error);
    res.status(500).json({ error: 'Failed to update business details' });
  }
};

export const updateBankDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { accountHolderName, bankName, accountNumber, ifscCode } = req.body;

    const vendor = await prisma.vendor.findUnique({ where: { userId } });
    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' });
      return;
    }

    const bankAccount = await prisma.vendorBankAccount.create({
      data: {
        vendorId: vendor.id,
        accountHolderName,
        bankName,
        accountNumber,
        ifscCode
      }
    });

    res.status(200).json(bankAccount);
  } catch (error) {
    console.error('Error updating bank details:', error);
    res.status(500).json({ error: 'Failed to update bank details' });
  }
};

export const addDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { type, url } = req.body;

    const vendor = await prisma.vendor.findUnique({ where: { userId } });
    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' });
      return;
    }

    const document = await prisma.vendorDocument.create({
      data: {
        vendorId: vendor.id,
        type,
        url
      }
    });

    res.status(200).json(document);
  } catch (error) {
    console.error('Error adding document:', error);
    res.status(500).json({ error: 'Failed to add document' });
  }
};

export const submitForApproval = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;

    const vendor = await prisma.vendor.update({
      where: { userId },
      data: {
        status: VendorStatus.UNDER_VERIFICATION
      }
    });

    res.status(200).json(vendor);
  } catch (error) {
    console.error('Error submitting for approval:', error);
    res.status(500).json({ error: 'Failed to submit for approval' });
  }
};

export const getMyProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;

    const vendor = await prisma.vendor.findUnique({
      where: { userId },
      include: {
        user: true,
        documents: true,
        bankAccounts: true,
      }
    });

    res.status(200).json(vendor ? { ...vendor, user: vendor.user ? sanitizeUser(vendor.user) : vendor.user } : vendor);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

export const getMyProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const vendor = await prisma.vendor.findUnique({ where: { userId } });
    
    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' });
      return;
    }

    const products = await prisma.product.findMany({
      where: { vendorId: vendor.id },
      include: {
        category: true,
        brand: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

export const addMyProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const vendor = await prisma.vendor.findUnique({ where: { userId } });
    
    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' });
      return;
    }

    const { name, description, mrp, price, b2bPrice, lowStockThreshold, stock, categoryId, brandId, oemNumber, partNumber, images } = req.body;

    if (!categoryId || !brandId) {
      res.status(400).json({ error: 'Category and Brand are required fields' });
      return;
    }

    // vehicleType is derived from the chosen category rather than trusted from
    // the client -- categoryId/brandId are already this endpoint's source of
    // truth for classification, and this closes a real bug where a vendor
    // product used to always fall back to the schema default CAR regardless
    // of which category (car or bike) was actually selected.
    const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { vehicleType: true } });
    if (!category) {
      res.status(400).json({ error: 'Category not found' });
      return;
    }

    const newProduct = await prisma.product.create({
      data: {
        vendorId: vendor.id,
        categoryId,
        brandId,
        name,
        description,
        mrp: Number(mrp),
        price: Number(price),
        stock: parseInt(stock, 10),
        oemNumber,
        partNumber,
        images: Array.isArray(images) ? images : [],
        vehicleType: category.vehicleType,
        status: 'APPROVED', // No admin approval required
        b2bPrice: b2bPrice !== undefined && b2bPrice !== '' ? Number(b2bPrice) : null,
        ...(lowStockThreshold !== undefined && lowStockThreshold !== '' && { lowStockThreshold: Number(lowStockThreshold) }),
      }
    });

    // Sync to Warehouse Inventory
    const mainWarehouse = await prisma.warehouse.findUnique({ where: { code: 'MAIN_WH_01' } });
    if (mainWarehouse && Number(stock) > 0) {
      const inventory = await prisma.inventory.create({
        data: {
          productId: newProduct.id,
          warehouseId: mainWarehouse.id,
          availableStock: Number(stock),
          // Seed the warehouse row's own reorder alert from the product-level
          // threshold so the two don't immediately disagree (defaults to the
          // Product's own default of 10 when the vendor didn't set one).
          reorderLevel: newProduct.lowStockThreshold,
        }
      });
      
      await prisma.stockMovement.create({
        data: {
          inventoryId: inventory.id,
          userId,
          action: 'ADJUSTMENT',
          prevQuantity: 0,
          newQuantity: Number(stock),
          quantityDiff: Number(stock),
          reason: 'Initial vendor stock upload'
        }
      });
    }

    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
};

export const getMyOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const vendor = await prisma.vendor.findUnique({ where: { userId } });
    
    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' });
      return;
    }

    // Find all orders that have at least one order item belonging to this vendor
    const orders = await prisma.order.findMany({
      where: {
        items: {
          some: {
            product: {
              vendorId: vendor.id
            }
          }
        }
      },
      include: {
        user: true, // to get customer name
        items: {
          where: {
            product: {
              vendorId: vendor.id
            }
          },
          include: {
            product: true
          }
        },
        address: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(stripDeliveryOtps(sanitizeOrders(orders)));
  } catch (error) {
    console.error('Error fetching vendor orders:', error);
    res.status(500).json({ error: 'Failed to fetch vendor orders' });
  }
};

export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id); // Order ID
    const { status } = req.body;
    const userId = req.user!.userId;

    if (!Object.values(OrderStatus).includes(status)) {
      res.status(400).json({ error: 'Invalid order status' });
      return;
    }

    const vendor = await prisma.vendor.findUnique({ where: { userId } });

    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' });
      return;
    }

    // Ensure the order actually contains items from this vendor before updating.
    // `items` is scoped to this vendor's own products only -- an unscoped
    // include here previously pulled every item in the order regardless of
    // vendor, so restoreOrderStock below would restore stock (and the update
    // would cancel the whole order) for other vendors' items too whenever one
    // vendor acted on their own line item in a shared multi-vendor order.
    const order = await prisma.order.findFirst({
      where: {
        id,
        items: {
          some: {
            product: {
              vendorId: vendor.id
            }
          }
        }
      },
      include: {
        items: {
          where: { product: { vendorId: vendor.id } },
          include: { product: true }
        }
      }
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found or does not belong to vendor' });
      return;
    }

    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.RETURNED) {
      res.status(400).json({ error: `Order is already ${order.status}; this is a terminal state and cannot be changed.` });
      return;
    }
    if (status === OrderStatus.CANCELLED && order.status === OrderStatus.DELIVERED) {
      res.status(400).json({ error: 'A delivered order cannot be cancelled directly -- use RETURNED once the goods are physically returned.' });
      return;
    }
    // Once delivered, the only legitimate forward transition is RETURNED --
    // "un-delivering" doesn't reflect reality, and would let a later call
    // re-trigger creditOrderDelivery below for the same physical delivery.
    if (order.status === OrderStatus.DELIVERED && status !== OrderStatus.DELIVERED && status !== OrderStatus.RETURNED) {
      res.status(400).json({ error: 'A delivered order can only move to RETURNED, not back to an earlier status.' });
      return;
    }

    const isBeingClosed = status === OrderStatus.CANCELLED || status === OrderStatus.RETURNED;
    const isBeingDelivered = status === OrderStatus.DELIVERED && order.status !== OrderStatus.DELIVERED;

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Atomically claim the transition -- only matches if the order's status
      // is still what we just read, re-checked under Postgres's row lock at
      // UPDATE time. Closes the race where a concurrent admin/vendor status
      // update on the same order both read the same pre-close status and
      // both restore stock/credit wallets.
      const claim = await tx.order.updateMany({
        where: { id, status: order.status },
        data: {
          status,
          ...(status === OrderStatus.CANCELLED && { deliveryPartnerId: null }),
        }
      });
      if (claim.count === 0) {
        throw new Error('Order status changed concurrently by another request. Please refresh and retry.');
      }

      if (isBeingClosed) {
        await restoreOrderStock(tx, order.items, userId, id);
      }
      // A vendor can close an order out directly (e.g. no rider was ever
      // assigned) -- without this, the rider/vendor wallet credit that
      // normally happens in the rider's own updateMyDeliveryStatus would
      // just never happen for these orders. order.items is already scoped to
      // this vendor's own products, so this only ever credits this vendor's
      // own share (plus the assigned rider, if any).
      if (isBeingDelivered) {
        await creditOrderDelivery(tx, order);
      }

      return tx.order.findUniqueOrThrow({ where: { id } });
    });

    notifyUser(
      order.userId,
      'Order update',
      `Your order #${id.slice(0, 8)} is now ${updatedOrder.status}.`,
      { orderId: id, status: updatedOrder.status }
    );

    res.status(200).json(stripDeliveryOtp(updatedOrder));
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Order status changed concurrently')) {
      res.status(409).json({ error: error.message });
      return;
    }
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

export const getWalletDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const vendor = await prisma.vendor.findUnique({
      where: { userId },
      include: {
        bankAccounts: true,
        settlements: {
          orderBy: { date: 'desc' }
        }
      }
    });

    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' });
      return;
    }

    res.status(200).json({
      walletBalance: vendor.walletBalance,
      bankAccounts: vendor.bankAccounts,
      settlements: vendor.settlements
    });
  } catch (error) {
    console.error('Error fetching wallet details:', error);
    res.status(500).json({ error: 'Failed to fetch wallet details' });
  }
};

export const requestPayout = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { amount } = req.body;
    
    if (!amount || isNaN(amount) || amount <= 0) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }

    const vendor = await prisma.vendor.findUnique({ where: { userId } });

    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' });
      return;
    }

    const pendingSettlement = await prisma.vendorSettlement.findFirst({
      where: { vendorId: vendor.id, status: 'PENDING' }
    });

    if (pendingSettlement) {
      res.status(400).json({ error: 'You already have a pending payout request' });
      return;
    }

    if (vendor.walletBalance < amount) {
      res.status(400).json({ error: 'Insufficient balance' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      // Re-check for a pending settlement inside the transaction -- narrows
      // (though on its own doesn't fully close, without a DB-level unique
      // constraint) the window where two concurrent requests both pass the
      // outer check above and both create a PENDING settlement.
      const stillNoPending = await tx.vendorSettlement.findFirst({ where: { vendorId: vendor.id, status: 'PENDING' } });
      if (stillNoPending) {
        throw new Error('DUPLICATE_PENDING_PAYOUT');
      }
      // Guarded decrement -- only succeeds if the balance is still sufficient
      // at write time, re-checked under Postgres's row lock, not against the
      // stale `vendor.walletBalance` read above. Without this, two concurrent
      // payout requests for the vendor's full balance could each pass the
      // outer balance check and both decrement, driving walletBalance
      // negative (a plain `decrement` has no floor -- unlike Product.stock's
      // decrement in createOrder, which uses this same gte-guarded pattern).
      const claim = await tx.vendor.updateMany({
        where: { id: vendor.id, walletBalance: { gte: amount } },
        data: { walletBalance: { decrement: amount } },
      });
      if (claim.count === 0) {
        throw new Error('INSUFFICIENT_BALANCE');
      }
      const updatedVendor = await tx.vendor.findUniqueOrThrow({ where: { id: vendor.id } });
      const settlement = await tx.vendorSettlement.create({
        data: { vendorId: vendor.id, amount: Number(amount), status: 'PENDING' },
      });
      return { updatedVendor, settlement };
    });

    res.status(200).json({
      message: 'Payout requested successfully',
      walletBalance: result.updatedVendor.walletBalance,
      settlement: result.settlement,
    });
  } catch (error: any) {
    if (error.message === 'DUPLICATE_PENDING_PAYOUT') {
      res.status(400).json({ error: 'You already have a pending payout request' });
      return;
    }
    if (error.message === 'INSUFFICIENT_BALANCE') {
      res.status(400).json({ error: 'Insufficient balance' });
      return;
    }
    console.error('Error requesting payout:', error);
    res.status(500).json({ error: 'Failed to request payout' });
  }
};


// ----------------------------------------------------
// ADMIN APIs (Used by Admin Portal)
// ----------------------------------------------------

export const getVendors = async (req: Request, res: Response): Promise<void> => {
  try {
    const vendors = await prisma.user.findMany({
      where: {
        role: Role.VENDOR
      },
      include: {
        vendorProfile: {
          include: {
            documents: true,
            bankAccounts: true
          }
        },
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.status(200).json(sanitizeUsers(vendors));
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
};

export const getAllSettlements = async (req: Request, res: Response): Promise<void> => {
  try {
    const settlements = await prisma.vendorSettlement.findMany({
      include: {
        vendor: {
          include: {
            user: true,
            bankAccounts: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });
    const sanitized = settlements.map((s) => ({
      ...s,
      vendor: s.vendor ? { ...s.vendor, user: s.vendor.user ? sanitizeUser(s.vendor.user) : s.vendor.user } : s.vendor,
    }));
    res.status(200).json(sanitized);
  } catch (error) {
    console.error('Error fetching settlements:', error);
    res.status(500).json({ error: 'Failed to fetch settlements' });
  }
};

export const updateSettlementStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { status, transactionId } = req.body;
    
    const settlement = await prisma.vendorSettlement.findUnique({ where: { id } });
    if (!settlement) {
      res.status(404).json({ error: 'Settlement not found' });
      return;
    }

    if (settlement.status === 'COMPLETED' || settlement.status === 'FAILED') {
      res.status(400).json({ error: 'Settlement is already finalised' });
      return;
    }

    // Atomically claim the transition: only matches if the settlement's
    // status is still what we just read, re-checked under Postgres's row
    // lock at UPDATE time -- not against the stale `settlement.status` read
    // above. Without this, two concurrent/duplicated requests marking the
    // same settlement FAILED could both pass the "already finalised" check
    // and both credit the vendor's wallet with settlement.amount.
    const updatedSettlement = await prisma.$transaction(async (tx) => {
      const claim = await tx.vendorSettlement.updateMany({
        where: { id, status: settlement.status },
        data: { status, transactionId },
      });
      if (claim.count === 0) {
        throw new Error('SETTLEMENT_CHANGED_CONCURRENTLY');
      }
      if (status === 'FAILED') {
        await tx.vendor.update({
          where: { id: settlement.vendorId },
          data: { walletBalance: { increment: settlement.amount } },
        });
      }
      return tx.vendorSettlement.findUniqueOrThrow({ where: { id } });
    });

    res.status(200).json(updatedSettlement);
  } catch (error: any) {
    if (error.message === 'SETTLEMENT_CHANGED_CONCURRENTLY') {
      res.status(409).json({ error: 'Settlement was already updated by another request. Please refresh and retry.' });
      return;
    }
    console.error('Error updating settlement status:', error);
    res.status(500).json({ error: 'Failed to update settlement status' });
  }
};

export const updateVendorStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id); // Vendor ID
    const { status, remarks } = req.body; // APPROVED, REJECTED, etc.

    const previous = await prisma.vendor.findUnique({ where: { id } });

    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        status
      }
    });

    if (req.user) {
      recordAuditLog({
        userId: req.user.userId,
        action: 'VENDOR_STATUS_CHANGE',
        entity: 'Vendor',
        entityId: id,
        details: `${previous?.status ?? 'UNKNOWN'} -> ${status}${remarks ? ` (${remarks})` : ''}`,
        req,
      });
    }

    // Rider/technician KYC status changes already notify the applicant --
    // this was the one role left silent, so a vendor had no way to learn
    // their account was approved/rejected except by manually re-checking.
    notifyUser(
      vendor.userId,
      'Vendor application update',
      remarks ? `Your vendor application status is now ${status}: ${remarks}` : `Your vendor application status is now ${status}.`,
      { type: 'VENDOR_STATUS', status }
    );

    res.status(200).json(vendor);
  } catch (error) {
    console.error('Error updating vendor status:', error);
    res.status(500).json({ error: 'Failed to update vendor status' });
  }
};

// Old createVendor & updateVendor maintained for backward compatibility with existing Admin Portal
export const createVendor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, phone, email, city, state, storeName, gstNumber } = req.body;
    
    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      res.status(400).json({ error: 'User with this phone number already exists' });
      return;
    }

    const vendor = await prisma.user.create({
      data: {
        name,
        phone,
        email: email || null,
        city,
        state,
        role: Role.VENDOR,
        vendorProfile: {
          create: {
            storeName,
            gstNumber,
            status: VendorStatus.APPROVED, // Admin created vendors are automatically approved
            isActive: true
          }
        }
      },
      include: {
        vendorProfile: true
      }
    });

    res.status(201).json(sanitizeUser(vendor));
  } catch (error) {
    console.error('Error creating vendor:', error);
    res.status(500).json({ error: 'Failed to create vendor' });
  }
};

export const updateVendor = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id); // User ID
    const { name, phone, email, city, state, storeName, gstNumber, isActive } = req.body;
    
    const vendor = await prisma.user.update({
      where: { id },
      data: {
        name,
        phone,
        email: email || null,
        city,
        state,
        vendorProfile: {
          update: {
            storeName,
            gstNumber,
            isActive
          }
        }
      },
      include: {
        vendorProfile: true
      }
    });

    res.status(200).json(sanitizeUser(vendor));
  } catch (error) {
    console.error('Error updating vendor:', error);
    res.status(500).json({ error: 'Failed to update vendor' });
  }
};

// ----------------------------------------------------
// NEW VENDOR PORTAL APIs (Dashboard, Inventory, Profile, Edit/Delete Product)
// ----------------------------------------------------

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const vendor = await prisma.vendor.findUnique({ where: { userId } });
    if (!vendor) { res.status(404).json({ error: 'Vendor not found' }); return; }

    // Total products
    const totalProducts = await prisma.product.count({ where: { vendorId: vendor.id } });

    // Products by status
    const liveProducts = await prisma.product.count({ where: { vendorId: vendor.id, status: 'APPROVED' } });
    const pendingProducts = await prisma.product.count({ where: { vendorId: vendor.id, status: 'PENDING' } });

    // Low stock -- compares each product's stock against its OWN threshold, so
    // this can't be expressed as a single Prisma `where` (no field-to-field
    // comparison support); fetch the two columns and count in JS instead.
    const stockLevels = await prisma.product.findMany({
      where: { vendorId: vendor.id },
      select: { stock: true, lowStockThreshold: true },
    });
    const lowStockProducts = stockLevels.filter(p => p.stock < p.lowStockThreshold).length;

    // Orders for this vendor
    const orders = await prisma.order.findMany({
      where: {
        items: { some: { product: { vendorId: vendor.id } } }
      },
      include: {
        user: { select: { name: true, phone: true } },
        items: {
          where: { product: { vendorId: vendor.id } },
          include: { product: { select: { name: true, price: true } } }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    const totalOrders = await prisma.order.count({
      where: { items: { some: { product: { vendorId: vendor.id } } } }
    });

    // Total revenue (sum of order items for this vendor, excluding cancelled orders)
    const revenueResult = await prisma.orderItem.aggregate({
      where: { 
        product: { vendorId: vendor.id },
        order: { status: { not: 'CANCELLED' } }
      },
      _sum: { price: true }
    });
    const totalRevenue = revenueResult._sum.price || 0;

    // Revenue last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentRevenue = await prisma.orderItem.aggregate({
      where: { 
        product: { vendorId: vendor.id }, 
        order: { 
          createdAt: { gte: sevenDaysAgo },
          status: { not: 'CANCELLED' }
        } 
      },
      _sum: { price: true }
    });

    res.status(200).json({
      totalProducts,
      liveProducts,
      pendingProducts,
      lowStockProducts,
      totalOrders,
      totalRevenue,
      recentRevenue: recentRevenue._sum.price || 0,
      walletBalance: vendor.walletBalance,
      recentOrders: orders,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

// Daily revenue for this vendor over the last N days, for the Dashboard's
// sales chart. Grouped in SQL (date_trunc) rather than fetched-and-bucketed
// in JS -- a busy vendor's order-item history could be thousands of rows.
export const getSalesChart = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const vendor = await prisma.vendor.findUnique({ where: { userId } });
    if (!vendor) { res.status(404).json({ error: 'Vendor not found' }); return; }

    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const rows = await prisma.$queryRaw<{ day: Date; revenue: number; orders: bigint }[]>`
      SELECT date_trunc('day', o."createdAt") AS day,
             SUM(oi.price * oi.quantity)::float AS revenue,
             COUNT(DISTINCT o.id) AS orders
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      JOIN "Product" p ON p.id = oi."productId"
      WHERE p."vendorId" = ${vendor.id}
        AND o.status != 'CANCELLED'
        AND o."createdAt" >= ${since}
      GROUP BY day
      ORDER BY day ASC
    `;

    res.status(200).json(
      rows.map((r) => ({ date: r.day.toISOString().slice(0, 10), revenue: r.revenue, orders: Number(r.orders) }))
    );
  } catch (error) {
    console.error('Error fetching vendor sales chart:', error);
    res.status(500).json({ error: 'Failed to fetch sales chart' });
  }
};

export const updateMyProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const id = String(req.params.id);
    const { name, description, mrp, price, b2bPrice, lowStockThreshold, stock, oemNumber, partNumber } = req.body;

    const vendor = await prisma.vendor.findUnique({ where: { userId } });
    if (!vendor) { res.status(404).json({ error: 'Vendor not found' }); return; }

    // Ensure product belongs to this vendor
    const product = await prisma.product.findFirst({ where: { id, vendorId: vendor.id } });
    if (!product) { res.status(404).json({ error: 'Product not found' }); return; }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name,
        description,
        mrp: mrp !== undefined ? Number(mrp) : undefined,
        price: price !== undefined ? Number(price) : undefined,
        stock: stock !== undefined ? Number(stock) : undefined,
        oemNumber,
        partNumber,
        status: 'APPROVED', // no approval needed from admin side
        b2bPrice: b2bPrice !== undefined ? (b2bPrice === '' ? null : Number(b2bPrice)) : undefined,
        lowStockThreshold: lowStockThreshold !== undefined && lowStockThreshold !== '' ? Number(lowStockThreshold) : undefined,
      }
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

export const deleteMyProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const id = String(req.params.id);

    const vendor = await prisma.vendor.findUnique({ where: { userId } });
    if (!vendor) { res.status(404).json({ error: 'Vendor not found' }); return; }

    const product = await prisma.product.findFirst({ where: { id, vendorId: vendor.id } });
    if (!product) { res.status(404).json({ error: 'Product not found' }); return; }

    // A product that has real order history must not be deleted -- that would
    // silently corrupt a customer's past order (OrderItem requires a Product).
    // Vendors should deactivate it instead of deleting it.
    const orderItemCount = await prisma.orderItem.count({ where: { productId: id } });
    if (orderItemCount > 0) {
      res.status(400).json({ error: `Cannot delete. This product has ${orderItemCount} past order item(s). Mark it out of stock instead.` });
      return;
    }

    // Delete related records first (stock movements before their inventory row,
    // then inventory, compatibilities, reviews, wishlists)
    const inventories = await prisma.inventory.findMany({ where: { productId: id }, select: { id: true } });
    await prisma.stockMovement.deleteMany({ where: { inventoryId: { in: inventories.map(i => i.id) } } });
    await prisma.inventory.deleteMany({ where: { productId: id } });
    await prisma.productCompatibility.deleteMany({ where: { productId: id } });
    await prisma.review.deleteMany({ where: { productId: id } });
    await prisma.wishlist.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });

    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

export const getVendorInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const vendor = await prisma.vendor.findUnique({ where: { userId } });
    if (!vendor) { res.status(404).json({ error: 'Vendor not found' }); return; }

    const inventory = await prisma.inventory.findMany({
      where: { product: { vendorId: vendor.id } },
      include: {
        product: { include: { category: true, brand: true } },
        warehouse: true,
        movements: { orderBy: { createdAt: 'desc' }, take: 3 }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.status(200).json(inventory);
  } catch (error) {
    console.error('Error fetching vendor inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
};

export const updateMyProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { name, storeName, gstNumber, panNumber, businessType, categories, city, state } = req.body;

    const [updatedUser, updatedVendor] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { name, city, state }
      }),
      prisma.vendor.update({
        where: { userId },
        data: { storeName, gstNumber, panNumber, businessType, categories: categories || [] }
      })
    ]);

    res.status(200).json({ user: sanitizeUser(updatedUser), vendor: updatedVendor });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

