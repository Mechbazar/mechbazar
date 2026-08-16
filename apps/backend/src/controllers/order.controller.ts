import { Request, Response } from 'express';
import { Prisma, VehicleType, OrderStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/auth';
import { sendExpoPush } from '../utils/expoPush';
import { resolveCoupon } from './coupon.controller';
import { notifyUser, notifyAdmins } from '../utils/notify';
import { broadcastOrderStatus } from '../services/orderState';
import { sanitizeOrder, sanitizeOrders, stripDeliveryOtp, stripDeliveryOtps } from '../utils/sanitizeUser';
import { pendingPaymentCreateInput, creditWalletForOnlineRefund } from '../services/payment.service';
import { resolveProductCommissionPercent, resolveRiderPayout, recordCommission, round2 } from '../services/commission.service';
import { isPincodeServiceable } from '../services/serviceability.service';
import { env } from '../config/env';

// Thrown from inside the createOrder $transaction to carry an intended HTTP
// status (400/409) back out through Prisma's error propagation, instead of
// every failure inside the transaction collapsing to a generic 500.
class OrderError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type RestockItem = { productId: string; quantity: number };

// Shared by updateAdminOrderStatus and vendor.controller.ts's updateOrderStatus:
// reverses createOrder's stock decrement (Product.stock, and Inventory/
// StockMovement where a warehouse row exists) when an order transitions into
// CANCELLED/RETURNED. Previously only Product.stock was ever restored, so a
// cancellation would desync warehouse-level inventory from the customer-
// facing stock count.
export const restoreOrderStock = async (
  tx: Prisma.TransactionClient,
  items: RestockItem[],
  actingUserId: string,
  orderId: string
) => {
  for (const item of items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }

  const mainWarehouse = await tx.warehouse.findUnique({ where: { code: 'MAIN_WH_01' } });
  if (!mainWarehouse) return;

  const inventoryRows = await tx.inventory.findMany({
    where: { warehouseId: mainWarehouse.id, productId: { in: items.map((i) => i.productId) } },
  });
  const inventoryByProductId = new Map(inventoryRows.map((inv) => [inv.productId, inv]));

  for (const item of items) {
    const inventory = inventoryByProductId.get(item.productId);
    if (!inventory) continue;

    await tx.inventory.update({
      where: { id: inventory.id },
      data: {
        availableStock: { increment: item.quantity },
        reservedStock: { decrement: item.quantity },
      },
    });
    await tx.stockMovement.create({
      data: {
        inventoryId: inventory.id,
        userId: actingUserId,
        action: 'RETURN',
        prevQuantity: inventory.availableStock,
        newQuantity: inventory.availableStock + item.quantity,
        quantityDiff: item.quantity,
        reason: `Order cancelled/returned: ${orderId}`,
      },
    });
  }
};

type DeliveryCreditOrder = {
  id: string;
  deliveryPartnerId: string | null;
  deliveryFee: number;
  address: { lat: number | null; lng: number | null } | null;
  items: {
    id: string;
    price: number;
    quantity: number;
    commissionPercent: number | null;
    commissionAmount: number | null;
    product: { vendorId: string; vendor: { lat: number | null; lng: number | null } | null } | null;
  }[];
};

// Shared by updateMyDeliveryStatus (rider's own flow), updateAdminOrderStatus,
// and vendor.controller.ts's updateOrderStatus: credits the assigned rider's
// payout and each vendor's net share of the order total when an order is
// first marked DELIVERED, regardless of which of the three endpoints performs
// that transition. Previously only the rider's own endpoint credited anyone,
// so an order the admin or a vendor set straight to DELIVERED (bypassing the
// rider flow entirely) silently never paid the vendor for it.
//
// Returns who got credited so callers can notify them once their own
// transaction commits -- previously this only ever notified the customer, so
// a rider/vendor had no way to learn a wallet credit happened except by
// polling their wallet balance.
export const creditOrderDelivery = async (
  tx: Prisma.TransactionClient,
  order: DeliveryCreditOrder
): Promise<{ userId: string; amount: number }[]> => {
  const credits: { userId: string; amount: number }[] = [];

  if (order.deliveryPartnerId) {
    // Pickup point is approximated from the first item whose vendor has a
    // location on file -- an order can span multiple vendors and there is no
    // per-vendor delivery leg tracked, so this is the same single-leg
    // simplification the pre-existing flat deliveryFee already made.
    const pickup = order.items.map((i) => i.product?.vendor).find((v) => v?.lat != null && v?.lng != null) || null;
    const { amount: riderAmount } = await resolveRiderPayout(tx, {
      pickupLat: pickup?.lat ?? null,
      pickupLng: pickup?.lng ?? null,
      dropLat: order.address?.lat ?? null,
      dropLng: order.address?.lng ?? null,
      deliveredAt: new Date(),
    });

    await tx.deliveryPartner.update({
      where: { id: order.deliveryPartnerId },
      data: { walletBalance: { increment: riderAmount } },
    });
    // Persisted so a later RETURNED reversal can claw back exactly this
    // amount even though the formula's inputs (e.g. rainModeActive) can
    // change between now and then.
    await tx.order.update({ where: { id: order.id }, data: { riderPayoutAmount: riderAmount } });
    const rider = await tx.deliveryPartner.findUnique({ where: { id: order.deliveryPartnerId }, select: { userId: true } });
    if (rider) credits.push({ userId: rider.userId, amount: riderAmount });
  }

  // An order can contain items from multiple vendors under one global status
  // (schema/architecture unchanged) -- each vendor is credited their own net
  // share: gross minus the commission that was resolved and snapshotted onto
  // the item back at order-creation time (see createOrder), not recomputed
  // now against whatever rate happens to be configured today.
  const shareByVendor = new Map<string, number>();
  for (const item of order.items) {
    const vendorId = item.product?.vendorId;
    if (!vendorId) continue;

    const gross = round2(item.price * item.quantity);
    // Null only for orders placed before this system existed -- those keep
    // the pre-existing full-amount behaviour rather than retroactively
    // deducting a rate that was never quoted at sale time.
    const hasSnapshot = item.commissionAmount != null && item.commissionPercent != null;
    const commissionAmount = hasSnapshot ? item.commissionAmount! : 0;
    const commissionPercent = hasSnapshot ? item.commissionPercent! : 0;
    const net = round2(gross - commissionAmount);

    shareByVendor.set(vendorId, round2((shareByVendor.get(vendorId) || 0) + net));

    if (hasSnapshot) {
      await recordCommission(tx, {
        sourceType: 'PRODUCT_ORDER',
        orderId: order.id,
        orderItemId: item.id,
        vendorId,
        grossAmount: gross,
        commissionPercent,
        commissionAmount,
        netPayoutAmount: net,
      });
    }
  }
  for (const [vendorId, share] of shareByVendor) {
    await tx.vendor.update({
      where: { id: vendorId },
      data: { walletBalance: { increment: share } },
    });
    const vendor = await tx.vendor.findUnique({ where: { id: vendorId }, select: { userId: true } });
    if (vendor) credits.push({ userId: vendor.userId, amount: share });
  }

  return credits;
};

// Reverses creditOrderDelivery: called when a previously-DELIVERED order
// (already credited above) is marked RETURNED. Claws back the rider's
// persisted payout and each vendor's net share, and writes a mirrored
// negative CommissionRecord per original one so Commission Reports reflect
// the reversal instead of silently over-stating revenue for a sale that was
// undone. A genuine pre-existing gap -- no clawback existed at all before.
export const reverseOrderDeliveryCredit = async (
  tx: Prisma.TransactionClient,
  order: { id: string; deliveryPartnerId: string | null; riderPayoutAmount: number | null }
): Promise<{ userId: string; amount: number }[]> => {
  const debits: { userId: string; amount: number }[] = [];

  if (order.deliveryPartnerId && order.riderPayoutAmount) {
    await tx.deliveryPartner.update({
      where: { id: order.deliveryPartnerId },
      data: { walletBalance: { decrement: order.riderPayoutAmount } },
    });
    const rider = await tx.deliveryPartner.findUnique({ where: { id: order.deliveryPartnerId }, select: { userId: true } });
    if (rider) debits.push({ userId: rider.userId, amount: order.riderPayoutAmount });
  }

  const originalRecords = await tx.commissionRecord.findMany({
    where: { orderId: order.id, sourceType: 'PRODUCT_ORDER', reversalOfId: null },
  });
  const clawbackByVendor = new Map<string, number>();
  for (const rec of originalRecords) {
    if (!rec.vendorId) continue;
    clawbackByVendor.set(rec.vendorId, round2((clawbackByVendor.get(rec.vendorId) || 0) + rec.netPayoutAmount));
    await recordCommission(tx, {
      sourceType: 'PRODUCT_ORDER',
      orderId: order.id,
      orderItemId: rec.orderItemId ?? undefined,
      vendorId: rec.vendorId,
      grossAmount: -rec.grossAmount,
      commissionPercent: rec.commissionPercent,
      commissionAmount: -rec.commissionAmount,
      netPayoutAmount: -rec.netPayoutAmount,
      reversalOfId: rec.id,
    });
  }
  for (const [vendorId, share] of clawbackByVendor) {
    await tx.vendor.update({ where: { id: vendorId }, data: { walletBalance: { decrement: share } } });
    const vendor = await tx.vendor.findUnique({ where: { id: vendorId }, select: { userId: true } });
    if (vendor) debits.push({ userId: vendor.userId, amount: share });
  }

  return debits;
};

// Fire-and-forget notification for each wallet credit creditOrderDelivery
// made -- called after the transaction that produced them has committed.
// notifyUser already swallows its own errors. Exported for
// vendor.controller.ts's updateOrderStatus, which shares creditOrderDelivery.
export const notifyWalletCredits = (credits: { userId: string; amount: number }[]) => {
  for (const credit of credits) {
    notifyUser(
      credit.userId,
      'Wallet credited',
      `Your wallet was credited ₹${credit.amount.toFixed(2)} for a delivered order.`,
      { amount: credit.amount },
      { type: 'WALLET_CREDIT' }
    );
  }
};

// Sibling of notifyWalletCredits for reverseOrderDeliveryCredit's debits.
export const notifyWalletDebits = (debits: { userId: string; amount: number }[]) => {
  for (const debit of debits) {
    notifyUser(
      debit.userId,
      'Wallet debited',
      `₹${debit.amount.toFixed(2)} was deducted from your wallet after an order was marked returned.`,
      { amount: debit.amount },
      { type: 'WALLET_DEBIT' }
    );
  }
};

export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { items, addressId, couponCode, payment_method } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty or invalid.' });
    }

    if (!addressId || typeof addressId !== 'string') {
      return res.status(400).json({ error: 'A valid delivery address is required.' });
    }

    // The user is identified from the verified JWT, not from the delivery
    // contact phone (which may legitimately differ from the account's
    // registered phone, e.g. a gift delivery or office number).
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });

    if (!user) {
      return res.status(401).json({ error: 'User not found for the provided token.' });
    }

    // Recomputed server-side, never trusted from the request body -- an
    // `isB2B` flag straight from the client meant any authenticated retail
    // customer could send `isB2B: true` and buy at wholesale (b2bPrice) on
    // any product that has one set. Wholesale pricing is only real for an
    // account the caller actually owns (accountType) that an admin has
    // actually approved (isBusinessVerified) -- both already exist and are
    // enforced nowhere before this.
    const isB2B = user.accountType === 'WHOLESALE' && user.isBusinessVerified === true;

    // Order + item creation, stock decrement, and inventory/coupon adjustment
    // all happen atomically: if any product is out of stock or the coupon is
    // invalid, nothing commits -- previously these were separate un-transacted
    // calls, so a mid-loop failure could leave an Order/OrderItem row created
    // with only some products' stock decremented.
    const newOrder = await prisma.$transaction(async (tx) => {
      // Scoped to the caller's own userId, so a missing, deleted, or someone
      // else's addressId all collapse to the same "not found" case rather
      // than silently attaching to the wrong customer's address. There is no
      // fallback here on purpose -- a former fallback used to auto-create an
      // address with a hard-coded, frequently non-serviceable Mumbai pincode
      // whenever no addressId was sent, which produced orders no rider could
      // ever be assigned to. Every current client already sends a real
      // addressId (CreateOrderPayload.addressId is a required field), so this
      // is not a behavior change for any real checkout.
      const address = await tx.address.findFirst({ where: { id: String(addressId), userId: user.id } });
      if (!address) {
        throw new OrderError(404, 'Delivery address not found.');
      }

      if (!(await isPincodeServiceable(address.pincode))) {
        throw new OrderError(400, `Sorry, we don't currently deliver to pincode ${address.pincode}.`);
      }

      let subtotal = 0;
      const validatedItems: {
        productId: string;
        quantity: number;
        price: number;
        commissionPercent: number;
        commissionAmount: number;
      }[] = [];
      const cartVehicleTypes = new Set<VehicleType>();

      // Verify products against real DB and that enough stock exists. Fetched
      // as one batch (not per-item) -- for an N-line cart this was N
      // sequential awaited queries before, purely from lookups the DB can
      // satisfy in a single IN (...) query.
      const productIds = [...new Set(items.map((item: any) => String(item.id)))];
      const products = await tx.product.findMany({ where: { id: { in: productIds } } });
      const productById = new Map(products.map((p) => [p.id, p]));

      for (const item of items) {
        const product = productById.get(String(item.id));

        if (!product) {
          throw new OrderError(400, `Product ID ${item.id} not found.`);
        }

        const quantity = Number(item.qty) || 0;
        if (quantity <= 0) {
          throw new OrderError(400, `Invalid quantity for ${product.name}.`);
        }
        if (product.stock < quantity) {
          throw new OrderError(409, `${product.name} only has ${product.stock} unit(s) in stock.`);
        }

        cartVehicleTypes.add(product.vehicleType);

        const retailPrice = product.price;
        // Prefer the vendor/admin-set B2B price; fall back to the old flat
        // 10%-off heuristic only for products that haven't had one set.
        const b2bPrice = product.b2bPrice ?? Math.floor(product.price * 0.9);
        const priceToUse = isB2B ? b2bPrice : retailPrice;
        subtotal += priceToUse * quantity;

        // Commission is resolved and snapshotted at order-creation time --
        // same philosophy as `price` above -- so a later rate change never
        // retroactively alters an already-placed order. The vendor is
        // actually credited net-of-commission only once the order reaches
        // DELIVERED (see creditOrderDelivery), but the rate itself is fixed
        // now, at the moment of sale.
        const lineTotal = priceToUse * quantity;
        const resolvedCommission = await resolveProductCommissionPercent(tx, {
          productId: product.id,
          vendorId: product.vendorId,
          categoryId: product.categoryId,
        });
        const commissionAmount = round2((lineTotal * resolvedCommission.percent) / 100);

        validatedItems.push({
          productId: product.id,
          quantity,
          price: priceToUse,
          commissionPercent: resolvedCommission.percent,
          commissionAmount,
        });
      }

      // A single order mixing Car and Bike parts has no clean semantics today
      // (rider assignment, returns, etc. all assume one vehicle context) --
      // reject it early rather than let it silently succeed.
      if (cartVehicleTypes.size > 1) {
        throw new OrderError(400, 'Cannot mix Car and Bike parts in a single order. Please place separate orders.');
      }

      const deliveryFee = 50;
      let discountAmount = 0;
      let couponId: string | undefined;

      if (couponCode) {
        const couponResult = await resolveCoupon(couponCode, subtotal, tx, [...cartVehicleTypes]);
        if ('error' in couponResult) {
          throw new OrderError(400, couponResult.error);
        }
        discountAmount = couponResult.discountAmount;
        couponId = couponResult.coupon!.id;
      }

      const finalAmount = subtotal + deliveryFee - discountAmount;

      // Save Order to Prisma DB
      const order = await tx.order.create({
        data: {
          userId: user.id,
          addressId: address.id,
          couponId,
          status: 'PLACED',
          totalAmount: subtotal,
          deliveryFee,
          discountAmount,
          finalAmount,
          items: {
            create: validatedItems // This connects the OrderItems if they exist in DB
          },
          // See services/payment.service.ts -- no real gateway is integrated yet,
          // so status is always PENDING regardless of method.
          payment: {
            create: pendingPaymentCreateInput(payment_method, finalAmount)
          }
        },
        include: {
          items: { include: { product: true } },
          payment: true
        }
      });

      // Deduct stock. Product.stock is the field the customer-facing app actually reads and
      // displays ("N units in stock"), so it must decrement on every order regardless of
      // whether the warehouse/inventory subsystem has been set up for that product. The
      // read-check above can't prevent a race between two concurrent checkouts for the same
      // last unit, so the actual guard is this conditional update -- it only decrements (and
      // reports success) if stock is still >= the requested quantity at write time.
      for (const item of validatedItems) {
        const updated = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } }
        });
        if (updated.count === 0) {
          throw new OrderError(409, `Product ${item.productId} went out of stock while placing your order.`);
        }
      }

      // Warehouse-level inventory tracking (available/reserved split, stock movement audit
      // trail) remains optional and only applies where MAIN_WH_01 inventory has been set up.
      const mainWarehouse = await tx.warehouse.findUnique({ where: { code: 'MAIN_WH_01' } });
      if (mainWarehouse) {
        const inventoryRows = await tx.inventory.findMany({
          where: { warehouseId: mainWarehouse.id, productId: { in: validatedItems.map((i) => i.productId) } },
        });
        const inventoryByProductId = new Map(inventoryRows.map((inv) => [inv.productId, inv]));

        for (const item of validatedItems) {
          const inventory = inventoryByProductId.get(item.productId);
          if (inventory) {
            const updatedInventory = await tx.inventory.updateMany({
              where: { id: inventory.id, availableStock: { gte: item.quantity } },
              data: {
                availableStock: { decrement: item.quantity },
                reservedStock: { increment: item.quantity }
              }
            });
            if (updatedInventory.count === 0) {
              throw new OrderError(409, `Product ${item.productId} is out of stock at the warehouse.`);
            }

            await tx.stockMovement.create({
              data: {
                inventoryId: inventory.id,
                userId: user.id,
                action: 'SALE',
                prevQuantity: inventory.availableStock,
                newQuantity: inventory.availableStock - item.quantity,
                quantityDiff: -item.quantity,
                reason: `Order placed: ${order.id}`
              }
            });
          }
        }
      }

      return order;
    });

    notifyUser(
      user.id,
      'Order placed',
      `Your order #${newOrder.id.slice(0, 8)} has been placed successfully.`,
      { orderId: newOrder.id, status: newOrder.status }
    );

    // Seeds OrderStatusHistory with the initial PLACED row -- every later
    // status write goes through this same helper (see updateAdminOrderStatus,
    // vendor.controller.ts's updateOrderStatus, rider.controller.ts's
    // updateDeliveryStatus), so the live order-tracking timeline has a first
    // entry to build on instead of starting empty.
    broadcastOrderStatus(newOrder, null);

    // Powers the admin Dashboard's live activity feed. socketOnly: high-frequency
    // event -- a persisted Notification row per order would flood the admin
    // notification centre, so this is a live ping only, not an actionable item.
    notifyAdmins(
      'New order placed',
      `${user.name || user.phone} placed an order worth ₹${newOrder.finalAmount.toLocaleString('en-IN')}.`,
      { orderId: newOrder.id, finalAmount: newOrder.finalAmount },
      { type: 'ADMIN_NEW_ORDER', socketOnly: true }
    );

    // A vendor previously had no way to learn about a new order except by
    // having their Orders screen open and waiting for its own poll (vendor
    // web) or manually pulling to refresh (seller-mobile) -- neither app
    // holds a live socket connection, unlike the admin ping above. Not
    // socketOnly: unlike the admin feed, this is the vendor's only signal
    // that they have something to fulfill, so it must persist + push.
    const orderedVendorIds = [...new Set(newOrder.items.map((item) => item.product.vendorId))];
    prisma.vendor
      .findMany({ where: { id: { in: orderedVendorIds } }, select: { userId: true } })
      .then((vendors) => {
        const vendorUserIds = [...new Set(vendors.map((v) => v.userId))];
        for (const vendorUserId of vendorUserIds) {
          notifyUser(
            vendorUserId,
            'New order received',
            `You have a new order #${newOrder.id.slice(0, 8)} to fulfill.`,
            { orderId: newOrder.id },
            { type: 'VENDOR_NEW_ORDER' }
          );
        }
      })
      .catch((err) => console.error('Failed to notify vendor(s) of new order:', err));

    res.status(201).json({
      message: 'Order placed successfully',
      order: newOrder
    });

  } catch (error: any) {
    if (error instanceof OrderError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Checkout error:', error.message);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getMyOrders = async (req: AuthRequest, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user!.userId },
      include: {
        items: {
          include: {
            product: true
          }
        },
        payment: true,
        address: true,
        deliveryPartner: {
          include: { user: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(sanitizeOrders(orders));
  } catch (error: any) {
    console.error('Error fetching orders:', error.message);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

const ADMIN_ORDER_ROLES = new Set([
  'ADMIN', 'SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER',
  'VENDOR_MANAGER', 'FINANCE_MANAGER', 'CUSTOMER_SUPPORT',
]);

// Lets the customer tracking screen fetch current status on open instead of
// only waiting for a socket push. Scoped to whoever has a legitimate reason
// to see this order: the customer who placed it, its assigned rider, a
// vendor with an item in it, or an admin -- not just any authenticated user.
export const getOrderById = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        payment: true,
        address: true,
        deliveryPartner: { include: { user: true } },
      },
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const { userId, role } = req.user!;
    const isOwner = order.userId === userId;
    const isAdmin = ADMIN_ORDER_ROLES.has(role);
    const isAssignedRider =
      role === 'DELIVERY_PARTNER' &&
      order.deliveryPartner?.userId === userId;
    const isOrderVendor =
      role === 'VENDOR' &&
      (await prisma.vendor.findFirst({
        where: { userId, products: { some: { orderItems: { some: { orderId: id } } } } },
      })) !== null;

    if (!isOwner && !isAdmin && !isAssignedRider && !isOrderVendor) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Only the order's owner (the customer) ever sees the raw code -- the
    // rider is who's supposed to receive it FROM the customer, so leaking it
    // here would defeat the point. Mirrors service.controller.ts's handling
    // of ServiceBooking.completionOtp for the technician-facing endpoint.
    const sanitized = sanitizeOrder(order);
    res.status(200).json(isOwner ? sanitized : { ...sanitized, deliveryOtp: undefined, deliveryOtpGeneratedAt: undefined });
  } catch (error: any) {
    console.error('Error fetching order:', error.message);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        user: true,
        items: {
          include: {
            product: true
          }
        },
        payment: true,
        address: true,
        deliveryPartner: {
          include: {
            user: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(stripDeliveryOtps(sanitizeOrders(orders)));
  } catch (error: any) {
    console.error('Error fetching all orders:', error.message);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

export const assignRider = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { riderId } = req.body; // This should be the deliveryPartner.id

    if (!riderId) {
      return res.status(400).json({ error: 'riderId is required' });
    }

    // Defense in depth: a non-approved rider can't go online (requireApprovedRider
    // gates that), so the admin UI's "online drivers" dropdown already excludes
    // them in practice, but this closes the gap directly at the write path too.
    const riderProfile = await prisma.deliveryPartner.findUnique({ where: { id: riderId } });
    if (!riderProfile || riderProfile.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Rider is not an approved, active delivery partner.' });
    }

    const previous = await prisma.order.findUnique({ where: { id }, select: { status: true } });

    const order = await prisma.order.update({
      where: { id },
      data: {
        deliveryPartnerId: riderId,
        status: 'PICKUP'
      },
      include: {
        deliveryPartner: {
          include: {
            user: true
          }
        }
      }
    });

    if (order.deliveryPartner?.expoPushToken) {
      sendExpoPush(
        order.deliveryPartner.expoPushToken,
        'New delivery assigned',
        `Order #${order.id.slice(0, 8)} is ready for pickup.`,
        { orderId: order.id }
      );
    }

    notifyUser(
      order.userId,
      'Rider assigned',
      `A delivery partner has been assigned to order #${order.id.slice(0, 8)}.`,
      { orderId: order.id }
    );
    broadcastOrderStatus(order, previous?.status ?? null);

    res.status(200).json(stripDeliveryOtp(sanitizeOrder(order)));
  } catch (error: any) {
    console.error('Error assigning rider:', error.message);
    res.status(500).json({ error: 'Failed to assign rider' });
  }
};

export const updateAdminOrderStatus = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    if (!Object.values(OrderStatus).includes(status)) {
      return res.status(400).json({ error: `Invalid status "${status}". Must be one of ${Object.values(OrderStatus).join(', ')}.` });
    }

    const existing = await prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: { include: { vendor: true } } } }, address: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Terminal states can't be reopened through this endpoint. Without this,
    // an order could be un-cancelled and re-cancelled later, restoring stock
    // a second time for the same units (isBeingClosed would evaluate true
    // again on the second closure since the order isn't "already closed" any
    // more at that point).
    if (existing.status === 'CANCELLED' || existing.status === 'RETURNED') {
      return res.status(400).json({ error: `Order is already ${existing.status}; this is a terminal state and cannot be changed.` });
    }
    // A delivered order's goods are physically with the customer -- cancelling
    // it (as opposed to marking it RETURNED once the goods actually come back)
    // would restore stock for units that were never returned, inflating
    // Product.stock/Inventory.availableStock beyond the true physical count.
    if (status === 'CANCELLED' && existing.status === 'DELIVERED') {
      return res.status(400).json({ error: 'A delivered order cannot be cancelled directly -- use RETURNED once the goods are physically returned.' });
    }
    // Once delivered, the only legitimate forward transition is RETURNED --
    // "un-delivering" back to an earlier status doesn't reflect reality, and
    // would also let a second admin call re-trigger creditOrderDelivery below
    // (rider/vendor wallet credit) for the same physical delivery.
    if (existing.status === 'DELIVERED' && status !== 'DELIVERED' && status !== 'RETURNED') {
      return res.status(400).json({ error: 'A delivered order can only move to RETURNED, not back to an earlier status.' });
    }

    const isBeingClosed = status === 'CANCELLED' || status === 'RETURNED';
    const isBeingDelivered = status === 'DELIVERED' && existing.status !== 'DELIVERED';
    // A delivered order was already credited by creditOrderDelivery -- moving
    // it to RETURNED must claw that back, not just restore stock.
    const isReturnAfterDelivery = status === 'RETURNED' && existing.status === 'DELIVERED';

    const { order, credits, debits } = await prisma.$transaction(async (tx) => {
      // Atomically claim the transition: only matches if the order's status
      // is still what we just read, re-checked under Postgres's row lock at
      // UPDATE time -- not against the stale `existing.status` read above.
      // This closes the race where two concurrent admin status-update calls
      // (or a retried request) both read the same pre-close status and both
      // restore stock/credit wallets for the same order.
      const claim = await tx.order.updateMany({
        where: { id, status: existing.status },
        data: {
          status: status as any,
          // A cancelled order frees up the rider for reassignment. A RETURNED
          // order implies delivery already happened, so the rider link stays
          // as a historical record of who delivered it.
          ...(status === 'CANCELLED' && { deliveryPartnerId: null }),
        }
      });
      if (claim.count === 0) {
        throw new OrderError(409, 'Order status changed concurrently by another request. Please refresh and retry.');
      }

      if (isBeingClosed) {
        await restoreOrderStock(tx, existing.items, req.user!.userId, id);
      }
      // An admin can close an order out directly (e.g. no rider was ever
      // assigned, or the rider's own app wasn't used) -- without this, the
      // rider/vendor wallet credit that normally happens in
      // updateMyDeliveryStatus would just never happen for these orders.
      const credits = isBeingDelivered ? await creditOrderDelivery(tx, existing) : [];
      const debits = isReturnAfterDelivery ? await reverseOrderDeliveryCredit(tx, existing) : [];

      return { order: await tx.order.findUniqueOrThrow({ where: { id } }), credits, debits };
    });

    notifyUser(
      existing.userId,
      'Order update',
      `Your order #${id.slice(0, 8)} is now ${order.status}.`,
      { orderId: id, status: order.status }
    );
    notifyWalletCredits(credits);
    notifyWalletDebits(debits);
    broadcastOrderStatus(order, existing.status);

    res.status(200).json(stripDeliveryOtp(order));
  } catch (error: any) {
    if (error instanceof OrderError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error updating order status:', error.message);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

// Statuses a customer can still back out of themselves. Once a rider has
// physically picked up the package (PICKUP/ON_THE_WAY/DELIVERED) this is no
// longer safe to self-serve -- the app routes those to support instead.
const CUSTOMER_CANCELLABLE_STATUSES: OrderStatus[] = [OrderStatus.PLACED, OrderStatus.ACCEPTED, OrderStatus.PACKING];

// Customer-initiated cancel, scoped to orders actually owned by the calling
// user (never trusts a client-supplied userId). Mirrors updateAdminOrderStatus's
// restock-on-close logic, plus a wallet refund for anything already paid
// online (COD has nothing to refund since no money changed hands yet).
export const cancelMyOrder = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);

    const existing = await prisma.order.findFirst({
      where: { id, userId: req.user!.userId },
      include: { items: { include: { product: true } }, payment: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (!CUSTOMER_CANCELLABLE_STATUSES.includes(existing.status)) {
      return res.status(400).json({ error: `Order can no longer be self-cancelled (current status: ${existing.status}). Please contact support.` });
    }

    const order = await prisma.$transaction(async (tx) => {
      // Claim the cancellation atomically: this conditional updateMany only
      // matches (and flips) the row if it's still in a cancellable status at
      // the moment the UPDATE actually runs, re-checked under Postgres's row
      // lock -- not against the stale `existing.status` read above. Without
      // this, two concurrent cancel requests (a double-tap, or a client retry
      // after a timeout) would both pass the `existing.status` check and both
      // restore stock / refund the wallet for the same order.
      const claim = await tx.order.updateMany({
        where: { id, userId: req.user!.userId, status: { in: CUSTOMER_CANCELLABLE_STATUSES } },
        data: { status: OrderStatus.CANCELLED, deliveryPartnerId: null },
      });
      if (claim.count === 0) {
        throw new OrderError(409, 'Order status changed just now and can no longer be self-cancelled. Please refresh and contact support if needed.');
      }

      await restoreOrderStock(tx, existing.items, req.user!.userId, id);

      if (existing.payment) {
        const credited = await creditWalletForOnlineRefund(tx, existing.payment, req.user!.userId);
        if (credited) {
          await tx.payment.update({
            where: { id: existing.payment.id },
            data: { status: 'REFUNDED' },
          });
        }
      }

      return tx.order.findUniqueOrThrow({ where: { id } });
    });

    notifyUser(
      existing.userId,
      'Order cancelled',
      `Your order #${id.slice(0, 8)} has been cancelled.`,
      { orderId: id, status: order.status }
    );

    res.status(200).json(order);
  } catch (error: any) {
    if (error instanceof OrderError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error cancelling order:', error.message);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
};

// Rider-driven status update, scoped to deliveries actually assigned to the
// calling rider (never trusts a client-supplied riderId). Mirrors the
// ownership-check pattern used by vendor.controller.ts's updateMyProduct.
const RIDER_STATUS_FLOW: Record<string, string[]> = {
  PICKUP: ['ON_THE_WAY', 'RETURNED'],
  ON_THE_WAY: ['DELIVERED', 'RETURNED'],
};

export const updateMyDeliveryStatus = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status, proofImageUrl, codCollected, issueReason, otp } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const partner = await prisma.deliveryPartner.findUnique({ where: { userId: req.user!.userId } });
    if (!partner) {
      return res.status(404).json({ error: 'Rider profile not found' });
    }

    const order = await prisma.order.findFirst({
      where: { id, deliveryPartnerId: partner.id },
      include: { payment: true, items: { include: { product: { include: { vendor: true } } } }, address: true },
    });
    if (!order) {
      return res.status(404).json({ error: 'Delivery not found or not assigned to you' });
    }

    const allowedNext = RIDER_STATUS_FLOW[order.status];
    if (!allowedNext || !allowedNext.includes(status)) {
      return res.status(400).json({ error: `Cannot move from ${order.status} to ${status}` });
    }

    if (status === 'DELIVERED') {
      if (!proofImageUrl) {
        return res.status(400).json({ error: 'A delivery photo (proofImageUrl) is required to mark as delivered' });
      }
      if (order.payment?.method === 'COD' && !codCollected) {
        return res.status(400).json({ error: 'COD collection must be confirmed to mark as delivered' });
      }
    }
    if (status === 'RETURNED' && !issueReason) {
      return res.status(400).json({ error: 'issueReason is required when reporting a delivery issue' });
    }

    const { updated, credits } = await prisma.$transaction(async (tx) => {
      // Delivery-code check runs INSIDE the transaction, attempt-capped and
      // TTL-checked the same way jobOtp.service.ts's verifyAndConsumeOtp works
      // for emergency jobs (VMR-09 fix; previously this compared the plaintext
      // code outside any transaction with no attempt limit or expiry check --
      // live-verified 8 consecutive wrong guesses returned plain 400s with no
      // lockout). Only enforced once an OTP has actually been generated for
      // this order -- keeps this backward-compatible with any order that
      // reached ON_THE_WAY before this feature existed / where generate-otp
      // was never called.
      if (status === 'DELIVERED' && order.deliveryOtp) {
        if (order.deliveryOtpGeneratedAt && Date.now() - order.deliveryOtpGeneratedAt.getTime() > env.JOB_OTP_TTL_SECONDS * 1000) {
          throw new OrderError(410, 'This delivery code has expired. Ask the customer for a fresh one.');
        }
        if (order.deliveryOtpAttempts >= env.JOB_OTP_MAX_ATTEMPTS) {
          throw new OrderError(429, 'Too many incorrect attempts. Ask the customer to generate a new code.');
        }
        if (!otp) {
          throw new OrderError(400, 'Ask the customer for their delivery code and enter it to confirm delivery.');
        }
        // Increment BEFORE comparing, conditioned on the attempt count just
        // read, so two concurrent guesses can't both pass the cap check and
        // both get a free attempt -- one of them loses this compare-and-swap.
        const bumped = await tx.order.updateMany({
          where: { id, deliveryOtpAttempts: order.deliveryOtpAttempts },
          data: { deliveryOtpAttempts: { increment: 1 } },
        });
        if (bumped.count === 0) {
          throw new OrderError(409, 'Another verification is in progress. Try again.');
        }
        if (String(otp) !== order.deliveryOtp) {
          const remaining = Math.max(0, env.JOB_OTP_MAX_ATTEMPTS - (order.deliveryOtpAttempts + 1));
          throw new OrderError(
            400,
            remaining > 0
              ? `Incorrect delivery code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
              : 'Incorrect delivery code. Ask the customer to generate a new one.'
          );
        }
      }

      // Atomically claim the transition: only matches if the order's status
      // is still what we just read, re-checked under Postgres's row lock at
      // UPDATE time -- not against the stale `order.status` read above.
      // RIDER_STATUS_FLOW prevents an illegitimate transition, but on its own
      // does nothing to stop the SAME legitimate transition (e.g. a mobile
      // network retry double-tapping "Mark Delivered") from being processed
      // twice concurrently, which would double-credit the rider's and every
      // vendor's wallet below.
      const claim = await tx.order.updateMany({
        where: { id, status: order.status },
        data: {
          status: status as any,
          ...(proofImageUrl && { proofImageUrl }),
          ...(typeof codCollected === 'boolean' && { codCollected }),
          ...(issueReason && { issueReason }),
          ...(status === 'DELIVERED' && { deliveryOtp: null, deliveryOtpGeneratedAt: null, deliveryOtpAttempts: 0 }),
        },
      });
      if (claim.count === 0) {
        throw new OrderError(409, 'Delivery status changed concurrently by another request. Please retry.');
      }
      const updatedOrder = await tx.order.findUniqueOrThrow({ where: { id } });

      // Credit the rider's and vendors' wallets. RIDER_STATUS_FLOW has no
      // transitions out of DELIVERED, so this only ever fires once per order
      // (the atomic claim above additionally guards against a concurrent retry).
      const credits = status === 'DELIVERED' ? await creditOrderDelivery(tx, order) : [];

      return { updated: updatedOrder, credits };
    });

    notifyUser(
      order.userId,
      'Order update',
      `Your order #${id.slice(0, 8)} is now ${updated.status}.`,
      { orderId: id, status: updated.status }
    );
    notifyWalletCredits(credits);
    broadcastOrderStatus(updated, order.status);

    res.status(200).json(stripDeliveryOtp(updated));
  } catch (error: any) {
    if (error instanceof OrderError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error updating delivery status:', error.message);
    res.status(500).json({ error: 'Failed to update delivery status' });
  }
};

// Rider calls this once ON_THE_WAY -- generates a fresh code, notifies the
// customer (never in the push title/body itself, only the data payload,
// same privacy rule as service.controller.ts's generateBookingCompletionOtp),
// and deliberately never echoes it back here.
export const generateDeliveryOtp = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const partner = await prisma.deliveryPartner.findUnique({ where: { userId: req.user!.userId } });
    if (!partner) {
      return res.status(404).json({ error: 'Rider profile not found' });
    }

    const order = await prisma.order.findFirst({ where: { id, deliveryPartnerId: partner.id } });
    if (!order) {
      return res.status(404).json({ error: 'Delivery not found or not assigned to you' });
    }
    if (order.status !== 'ON_THE_WAY') {
      return res.status(400).json({ error: 'OTP can only be generated once the order is out for delivery' });
    }

    const otp = String(Math.floor(1000 + Math.random() * 9000));
    // Reset the wrong-guess counter with every fresh code, same as JobOtp
    // reissuing invalidates the previous code's attempt count along with it.
    await prisma.order.update({
      where: { id },
      data: { deliveryOtp: otp, deliveryOtpGeneratedAt: new Date(), deliveryOtpAttempts: 0 },
    });

    notifyUser(order.userId, 'Delivery code ready', 'Open the app to view your delivery confirmation code.', { orderId: id, deliveryOtp: otp });

    res.status(200).json({ message: 'OTP sent to the customer' });
  } catch (error: any) {
    console.error('Error generating delivery OTP:', error.message);
    res.status(500).json({ error: 'Failed to generate OTP' });
  }
};
