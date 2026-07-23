import { Request, Response } from 'express';
import { Prisma, VehicleType, OrderStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/auth';
import { sendExpoPush } from '../utils/expoPush';
import { resolveCoupon } from './coupon.controller';
import { notifyUser } from '../utils/notify';
import { sanitizeOrder, sanitizeOrders } from '../utils/sanitizeUser';
import { pendingPaymentCreateInput, creditWalletForOnlineRefund } from '../services/payment.service';

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

  for (const item of items) {
    const inventory = await tx.inventory.findUnique({
      where: { productId_warehouseId: { productId: item.productId, warehouseId: mainWarehouse.id } },
    });
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
  deliveryPartnerId: string | null;
  deliveryFee: number;
  items: { price: number; quantity: number; product: { vendorId: string } | null }[];
};

// Shared by updateMyDeliveryStatus (rider's own flow), updateAdminOrderStatus,
// and vendor.controller.ts's updateOrderStatus: credits the assigned rider's
// delivery fee and each vendor's share of the order total when an order is
// first marked DELIVERED, regardless of which of the three endpoints performs
// that transition. Previously only the rider's own endpoint credited anyone,
// so an order the admin or a vendor set straight to DELIVERED (bypassing the
// rider flow entirely) silently never paid the vendor for it.
export const creditOrderDelivery = async (
  tx: Prisma.TransactionClient,
  order: DeliveryCreditOrder
) => {
  if (order.deliveryPartnerId) {
    await tx.deliveryPartner.update({
      where: { id: order.deliveryPartnerId },
      data: { walletBalance: { increment: order.deliveryFee } },
    });
  }

  // An order can contain items from multiple vendors under one global status
  // (schema/architecture unchanged) -- each vendor is credited their own
  // share, computed from the items actually attributed to them, rather than
  // crediting one vendor the whole order total.
  const shareByVendor = new Map<string, number>();
  for (const item of order.items) {
    const vendorId = item.product?.vendorId;
    if (!vendorId) continue;
    shareByVendor.set(vendorId, (shareByVendor.get(vendorId) || 0) + item.price * item.quantity);
  }
  for (const [vendorId, share] of shareByVendor) {
    await tx.vendor.update({
      where: { id: vendorId },
      data: { walletBalance: { increment: share } },
    });
  }
};

export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { items, addressId, deliveryAddress, couponCode, isB2B, payment_method } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty or invalid.' });
    }

    if (!addressId && !deliveryAddress) {
      return res.status(400).json({ error: 'Delivery address is required.' });
    }

    // The user is identified from the verified JWT, not from the delivery
    // contact phone (which may legitimately differ from the account's
    // registered phone, e.g. a gift delivery or office number).
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });

    if (!user) {
      return res.status(401).json({ error: 'User not found for the provided token.' });
    }

    // Order + item creation, stock decrement, and inventory/coupon adjustment
    // all happen atomically: if any product is out of stock or the coupon is
    // invalid, nothing commits -- previously these were separate un-transacted
    // calls, so a mid-loop failure could leave an Order/OrderItem row created
    // with only some products' stock decremented.
    const newOrder = await prisma.$transaction(async (tx) => {
      // Prefer an explicit, customer-selected addressId (what the current app
      // build sends) over the legacy free-text deliveryAddress fallback below,
      // which used to silently ignore the customer's actual selection/default
      // and pick an arbitrary existing address instead. The fallback path is
      // kept only so an already-installed older app build (which never sends
      // addressId) doesn't break at checkout before it can be updated.
      let address = addressId
        ? await tx.address.findFirst({ where: { id: String(addressId), userId: user.id } })
        : null;
      if (addressId && !address) {
        throw new OrderError(404, 'Delivery address not found.');
      }
      if (!address) {
        address = await tx.address.findFirst({ where: { userId: user.id }, orderBy: { isDefault: 'desc' } });
      }
      if (!address) {
        address = await tx.address.create({
          data: {
            userId: user.id,
            title: 'Home',
            line1: deliveryAddress,
            city: 'Mumbai',
            state: 'MH',
            pincode: '400099',
          }
        });
      }

      let subtotal = 0;
      const validatedItems: { productId: string; quantity: number; price: number }[] = [];
      const cartVehicleTypes = new Set<VehicleType>();

      // Verify products against real DB and that enough stock exists
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: String(item.id) } });

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

        validatedItems.push({
          productId: product.id,
          quantity,
          price: priceToUse
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
        for (const item of validatedItems) {
          const inventory = await tx.inventory.findUnique({
            where: { productId_warehouseId: { productId: item.productId, warehouseId: mainWarehouse.id } }
          });
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

    res.status(200).json(sanitizeOrder(order));
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

    res.status(200).json(sanitizeOrders(orders));
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

    res.status(200).json(sanitizeOrder(order));
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

    const existing = await prisma.order.findUnique({ where: { id }, include: { items: { include: { product: true } } } });
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

    const order = await prisma.$transaction(async (tx) => {
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
      if (isBeingDelivered) {
        await creditOrderDelivery(tx, existing);
      }

      return tx.order.findUniqueOrThrow({ where: { id } });
    });

    notifyUser(
      existing.userId,
      'Order update',
      `Your order #${id.slice(0, 8)} is now ${order.status}.`,
      { orderId: id, status: order.status }
    );

    res.status(200).json(order);
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
    const { status, proofImageUrl, codCollected, issueReason } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const partner = await prisma.deliveryPartner.findUnique({ where: { userId: req.user!.userId } });
    if (!partner) {
      return res.status(404).json({ error: 'Rider profile not found' });
    }

    const order = await prisma.order.findFirst({
      where: { id, deliveryPartnerId: partner.id },
      include: { payment: true, items: { include: { product: true } } },
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

    const updated = await prisma.$transaction(async (tx) => {
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
        },
      });
      if (claim.count === 0) {
        throw new OrderError(409, 'Delivery status changed concurrently by another request. Please retry.');
      }
      const updatedOrder = await tx.order.findUniqueOrThrow({ where: { id } });

      // Credit the rider's and vendors' wallets. RIDER_STATUS_FLOW has no
      // transitions out of DELIVERED, so this only ever fires once per order
      // (the atomic claim above additionally guards against a concurrent retry).
      if (status === 'DELIVERED') {
        await creditOrderDelivery(tx, order);
      }

      return updatedOrder;
    });

    notifyUser(
      order.userId,
      'Order update',
      `Your order #${id.slice(0, 8)} is now ${updated.status}.`,
      { orderId: id, status: updated.status }
    );

    res.status(200).json(updated);
  } catch (error: any) {
    if (error instanceof OrderError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error updating delivery status:', error.message);
    res.status(500).json({ error: 'Failed to update delivery status' });
  }
};
