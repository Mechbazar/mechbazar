import { Request, Response } from 'express';
import { Role, ScheduledNotificationStatus, Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/auth';
import { notifyUser, classifyNotificationDisplayCategory } from '../utils/notify';
import { isBroadcastAudience, sendBroadcast, BroadcastFilters } from '../services/broadcast.service';
import { sanitizeUser } from '../utils/sanitizeUser';
import { ensureFirebaseAccount, sendFirebasePasswordResetEmail } from '../utils/firebasePassword';
import { isEmailConfigured } from '../config/env';

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const [usersCount, ordersCount, productsCount, vendorsCount, lowStockCount] = await Promise.all([
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.order.count({ where: { status: 'PLACED' } }),
      prisma.product.count(),
      prisma.vendor.count(),
      prisma.inventory.count({ where: { availableStock: { lt: 10 } } })
    ]);

    // The Dashboard card labels this "Today's Sales" -- it was previously an
    // unfiltered all-time sum (and included cancelled orders), so it never
    // actually reflected today. Scoped to orders created since local midnight,
    // excluding CANCELLED, matching the convention getRevenueChart/
    // getSalesReport below already use for "revenue".
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const revenueRes = await prisma.order.aggregate({
      _sum: { finalAmount: true },
      where: { createdAt: { gte: todayStart }, status: { not: 'CANCELLED' } },
    });
    const revenue = revenueRes._sum.finalAmount || 0;

    const recentOrders = await prisma.order.findMany({
      take: 4,
      orderBy: { createdAt: 'desc' },
      include: {
        items: true
      }
    });

    const topSellingProducts = await prisma.product.findMany({
      take: 4,
      orderBy: {
        orderItems: {
          _count: 'desc'
        }
      },
      include: {
        vendor: true,
        orderItems: true
      }
    });

    res.json({
      stats: {
        users: usersCount,
        orders: ordersCount,
        products: productsCount,
        revenue,
        vendors: vendorsCount,
        lowStock: lowStockCount
      },
      recentOrders,
      topSellingProducts
    });

  } catch (error) {
    console.error('Error fetching admin dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

// Platform-wide daily revenue for the Dashboard's revenue chart. Grouped in
// SQL rather than fetched-and-bucketed in JS, since the Order table can
// realistically grow into the tens of thousands of rows.
export const getRevenueChart = async (req: Request, res: Response) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const rows = await prisma.$queryRaw<{ day: Date; revenue: number; orders: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day,
             SUM("finalAmount")::float AS revenue,
             COUNT(*) AS orders
      FROM "Order"
      WHERE status != 'CANCELLED'
        AND "createdAt" >= ${since}
      GROUP BY day
      ORDER BY day ASC
    `;

    res.json(rows.map((r) => ({ date: r.day.toISOString().slice(0, 10), revenue: r.revenue, orders: Number(r.orders) })));
  } catch (error) {
    console.error('Error fetching admin revenue chart:', error);
    res.status(500).json({ error: 'Failed to fetch revenue chart' });
  }
};

// Backs the admin Reports page -- a real sales report over a date range
// (order count, revenue, discounts, top categories), not the disabled
// "coming soon" placeholder that used to be the only thing on Dashboard.
export const getSalesReport = async (req: Request, res: Response) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    // Include the entire "to" day.
    to.setHours(23, 59, 59, 999);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
      select: {
        id: true,
        createdAt: true,
        status: true,
        totalAmount: true,
        discountAmount: true,
        deliveryFee: true,
        finalAmount: true,
        user: { select: { name: true, phone: true } },
        items: { select: { quantity: true, price: true, product: { select: { name: true, category: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalRevenue = orders.reduce((sum, o) => sum + o.finalAmount, 0);
    const totalDiscount = orders.reduce((sum, o) => sum + o.discountAmount, 0);

    const revenueByCategory = new Map<string, number>();
    for (const order of orders) {
      for (const item of order.items) {
        const category = item.product?.category?.name || 'Uncategorized';
        revenueByCategory.set(category, (revenueByCategory.get(category) || 0) + item.price * item.quantity);
      }
    }

    res.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        orderCount: orders.length,
        totalRevenue,
        totalDiscount,
        avgOrderValue: orders.length ? totalRevenue / orders.length : 0,
      },
      revenueByCategory: [...revenueByCategory.entries()].map(([category, revenue]) => ({ category, revenue })),
      orders: orders.map((o) => ({
        id: o.id,
        date: o.createdAt.toISOString(),
        status: o.status,
        customer: o.user?.name || 'Unknown',
        phone: o.user?.phone || '',
        itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
        totalAmount: o.totalAmount,
        discountAmount: o.discountAmount,
        finalAmount: o.finalAmount,
      })),
    });
  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).json({ error: 'Failed to generate sales report' });
  }
};

// Read side of AuditLog -- writes have existed for a while (vendor/rider/
// technician status changes, coupon/banner CRUD) but nothing ever exposed
// them, so admins had no way to actually see who changed what.
export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 25, 1), 100);
    const entity = req.query.entity ? String(req.query.entity) : undefined;

    const where = entity ? { entity } : {};

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, phone: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};

// Day-bucketed ServiceBooking counts -- the Dashboard analytics section's
// "Service Bookings" tab. Same raw-SQL bucketing pattern as getRevenueChart.
export const getBookingsChart = async (req: Request, res: Response) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const rows = await prisma.$queryRaw<{ day: Date; bookings: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day,
             COUNT(*) AS bookings
      FROM "ServiceBooking"
      WHERE "createdAt" >= ${since}
      GROUP BY day
      ORDER BY day ASC
    `;

    res.json(rows.map((r) => ({ date: r.day.toISOString().slice(0, 10), bookings: Number(r.bookings) })));
  } catch (error) {
    console.error('Error fetching bookings chart:', error);
    res.status(500).json({ error: 'Failed to fetch bookings chart' });
  }
};

// Day-bucketed vendor-attributable revenue (sum of order-item line totals,
// across all vendors) -- the Dashboard analytics section's "Vendor Earnings" tab.
export const getVendorEarningsChart = async (req: Request, res: Response) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const rows = await prisma.$queryRaw<{ day: Date; revenue: number }[]>`
      SELECT date_trunc('day', o."createdAt") AS day,
             SUM(oi.price * oi.quantity)::float AS revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE o.status != 'CANCELLED' AND o."createdAt" >= ${since}
      GROUP BY day
      ORDER BY day ASC
    `;

    res.json(rows.map((r) => ({ date: r.day.toISOString().slice(0, 10), revenue: r.revenue })));
  } catch (error) {
    console.error('Error fetching vendor earnings chart:', error);
    res.status(500).json({ error: 'Failed to fetch vendor earnings chart' });
  }
};

// Day-bucketed new-customer signups plus a running cumulative total -- the
// Dashboard analytics section's "Customer Growth" tab.
export const getCustomerGrowthChart = async (req: Request, res: Response) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const [rows, baseline] = await Promise.all([
      prisma.$queryRaw<{ day: Date; newCustomers: bigint }[]>`
        SELECT date_trunc('day', "createdAt") AS day,
               COUNT(*) AS "newCustomers"
        FROM "User"
        WHERE role = 'CUSTOMER' AND "createdAt" >= ${since}
        GROUP BY day
        ORDER BY day ASC
      `,
      prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { lt: since } } }),
    ]);

    let cumulative = baseline;
    res.json(
      rows.map((r) => {
        cumulative += Number(r.newCustomers);
        return { date: r.day.toISOString().slice(0, 10), newCustomers: Number(r.newCustomers), cumulative };
      })
    );
  } catch (error) {
    console.error('Error fetching customer growth chart:', error);
    res.status(500).json({ error: 'Failed to fetch customer growth chart' });
  }
};

// Cross-entity global search for the admin Topbar's command palette. Grouped
// by entity, capped at 5 results each -- a quick jump-to, not a full search
// results page.
export const globalSearch = async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.json({ query: q, results: { orders: [], customers: [], vendors: [], technicians: [], products: [], coupons: [] }, totalCount: 0 });
      return;
    }

    const insensitive = { contains: q, mode: 'insensitive' as const };

    const [orders, customers, vendors, technicians, products, coupons] = await Promise.all([
      prisma.order.findMany({
        where: {
          OR: [
            { user: { name: insensitive } },
            { user: { phone: insensitive } },
            { items: { some: { product: { name: insensitive } } } },
          ],
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, finalAmount: true, createdAt: true, user: { select: { name: true, phone: true } } },
      }),
      prisma.user.findMany({
        where: { role: 'CUSTOMER', OR: [{ name: insensitive }, { phone: insensitive }, { email: insensitive }] },
        take: 5,
        select: { id: true, name: true, phone: true, email: true },
      }),
      prisma.user.findMany({
        where: {
          roles: { has: Role.VENDOR },
          OR: [{ name: insensitive }, { phone: insensitive }, { vendorProfile: { storeName: insensitive } }],
        },
        take: 5,
        select: { id: true, name: true, phone: true, vendorProfile: { select: { id: true, storeName: true, status: true } } },
      }),
      prisma.user.findMany({
        where: { roles: { has: Role.SERVICE_TECHNICIAN }, OR: [{ name: insensitive }, { phone: insensitive }] },
        take: 5,
        select: { id: true, name: true, phone: true, technicianProfile: { select: { id: true, status: true } } },
      }),
      prisma.product.findMany({
        where: { OR: [{ name: insensitive }, { oemNumber: insensitive }, { partNumber: insensitive }] },
        take: 5,
        select: { id: true, name: true, price: true, images: true, status: true },
      }),
      prisma.coupon.findMany({
        where: { code: insensitive },
        take: 5,
        select: { id: true, code: true, discountType: true, discountValue: true, isActive: true },
      }),
    ]);

    const totalCount = orders.length + customers.length + vendors.length + technicians.length + products.length + coupons.length;
    res.json({ query: q, results: { orders, customers, vendors, technicians, products, coupons }, totalCount });
  } catch (error) {
    console.error('Error running global search:', error);
    res.status(500).json({ error: 'Failed to run search' });
  }
};

const REVENUE_TARGET_KEY = 'revenue_target_monthly';

// Persisted admin-editable monthly revenue target for the Dashboard hero's
// progress bar -- a real settings value, not a client-side guess.
export const getRevenueTarget = async (req: Request, res: Response) => {
  try {
    const setting = await prisma.platformSetting.findUnique({ where: { key: REVENUE_TARGET_KEY } });

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthToDateRes = await prisma.order.aggregate({
      _sum: { finalAmount: true },
      where: { createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } },
    });

    res.json({
      target: setting ? Number(setting.value) : 0,
      monthToDateRevenue: monthToDateRes._sum.finalAmount || 0,
    });
  } catch (error) {
    console.error('Error fetching revenue target:', error);
    res.status(500).json({ error: 'Failed to fetch revenue target' });
  }
};

export const updateRevenueTarget = async (req: Request, res: Response) => {
  try {
    const target = Number(req.body.target);
    if (!Number.isFinite(target) || target < 0) {
      res.status(400).json({ error: 'target must be a non-negative number' });
      return;
    }

    await prisma.platformSetting.upsert({
      where: { key: REVENUE_TARGET_KEY },
      create: { key: REVENUE_TARGET_KEY, value: String(target) },
      update: { value: String(target) },
    });

    res.json({ target });
  } catch (error) {
    console.error('Error updating revenue target:', error);
    res.status(500).json({ error: 'Failed to update revenue target' });
  }
};

// Backs the admin broadcast composer (and the Dashboard's older "Send
// Notification" quick action, which still posts here with no city/state/
// language) -- a real broadcast, reusing the same per-user notification
// fan-out every other admin notification already goes through
// (utils/notify.ts's notifyUser via services/broadcast.service.ts), just
// looped over a resolved audience instead of a single recipient. Fine at
// current scale; a large audience should eventually move off the request
// thread (see the sentCount cap discussion on scheduled sends below).
export const broadcastNotification = async (req: Request, res: Response) => {
  try {
    const { title, body, audience, city, state, language } = req.body as {
      title?: string;
      body?: string;
      audience?: string;
      city?: string;
      state?: string;
      language?: string;
    };

    if (!title || !body) {
      res.status(400).json({ error: 'title and body are required' });
      return;
    }
    if (!isBroadcastAudience(audience)) {
      res.status(400).json({ error: 'audience must be one of ALL_CUSTOMERS, ALL_VENDORS, ALL_TECHNICIANS, ALL_RIDERS' });
      return;
    }

    const sent = await sendBroadcast(title, body, { audience, city, state, language });
    res.json({ sent });
  } catch (error) {
    console.error('Error broadcasting notification:', error);
    res.status(500).json({ error: 'Failed to broadcast notification' });
  }
};

// ============ Scheduled broadcasts ============
// A ScheduledNotification row queued for a future send. Picked up by
// jobs/sweeper.ts's scheduled-notification sweep, which resolves the same
// audience filters through services/broadcast.service.ts and sends it
// through the same fan-out as an immediate broadcast above.

export const createScheduledNotification = async (req: AuthRequest, res: Response) => {
  try {
    const { title, body, audience, city, state, language, sendAt } = req.body as {
      title?: string;
      body?: string;
      audience?: string;
      city?: string;
      state?: string;
      language?: string;
      sendAt?: string;
    };

    if (!title || !body) {
      res.status(400).json({ error: 'title and body are required' });
      return;
    }
    if (!isBroadcastAudience(audience)) {
      res.status(400).json({ error: 'audience must be one of ALL_CUSTOMERS, ALL_VENDORS, ALL_TECHNICIANS, ALL_RIDERS' });
      return;
    }
    const sendAtDate = sendAt ? new Date(sendAt) : null;
    if (!sendAtDate || Number.isNaN(sendAtDate.getTime()) || sendAtDate.getTime() <= Date.now()) {
      res.status(400).json({ error: 'sendAt must be a valid future date/time' });
      return;
    }

    const filters: BroadcastFilters = { audience, city, state, language };
    const scheduled = await prisma.scheduledNotification.create({
      data: {
        title,
        body,
        audience: filters as object,
        sendAt: sendAtDate,
        createdByUserId: req.user!.userId,
      },
    });
    res.status(201).json(scheduled);
  } catch (error) {
    console.error('Error creating scheduled notification:', error);
    res.status(500).json({ error: 'Failed to create scheduled notification' });
  }
};

export const getScheduledNotifications = async (req: Request, res: Response) => {
  try {
    const notifications = await prisma.scheduledNotification.findMany({ orderBy: { sendAt: 'desc' }, take: 100 });
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching scheduled notifications:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled notifications' });
  }
};

export const cancelScheduledNotification = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const existing = await prisma.scheduledNotification.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Scheduled notification not found' });
      return;
    }
    if (existing.status !== ScheduledNotificationStatus.PENDING) {
      res.status(400).json({ error: `Cannot cancel a notification that is already ${existing.status}` });
      return;
    }
    const updated = await prisma.scheduledNotification.update({
      where: { id },
      data: { status: ScheduledNotificationStatus.CANCELLED },
    });
    res.json(updated);
  } catch (error) {
    console.error('Error cancelling scheduled notification:', error);
    res.status(500).json({ error: 'Failed to cancel scheduled notification' });
  }
};

// ============ Notification analytics ============
// Aggregates Notification's delivery/engagement columns (see notify.ts and
// the delivery-retry sweep in jobs/sweeper.ts for how deliveryStatus/
// deliveredAt get set, and customer.controller.ts's markNotificationRead/
// markNotificationOpened for openedAt/clickedAt). Optional date range +
// type filter; no audience filter today since Notification doesn't retain
// which broadcast/category sent it beyond `type`.
export const getNotificationAnalytics = async (req: Request, res: Response) => {
  try {
    const { from, to, type } = req.query as { from?: string; to?: string; type?: string };
    const where: Record<string, unknown> = {};
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }
    if (type) where.type = type;

    const [sent, delivered, opened, clicked, all] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ...where, deliveredAt: { not: null } } }),
      prisma.notification.count({ where: { ...where, openedAt: { not: null } } }),
      prisma.notification.count({ where: { ...where, clickedAt: { not: null } } }),
      // Sampled for the by-category breakdown -- type + createdAt only, cheap
      // even at high volume, capped so a huge date range can't return an
      // unbounded row set to aggregate in memory below.
      prisma.notification.findMany({ where, select: { type: true }, take: 20000 }),
    ]);

    const failed = await prisma.notification.count({
      where: { ...where, deliveryStatus: { not: Prisma.JsonNull } as any, deliveredAt: null },
    });

    const byCategory: Record<string, number> = {};
    for (const row of all) {
      const category = classifyNotificationDisplayCategory(row.type);
      byCategory[category] = (byCategory[category] || 0) + 1;
    }

    res.json({
      sent,
      delivered,
      opened,
      clicked,
      failed,
      deliveryRate: sent ? Math.round((delivered / sent) * 1000) / 10 : 0,
      ctr: delivered ? Math.round((clicked / delivered) * 1000) / 10 : 0,
      byCategory,
    });
  } catch (error) {
    console.error('Error computing notification analytics:', error);
    res.status(500).json({ error: 'Failed to compute notification analytics' });
  }
};

// ============ Staff / administrator account management ============
// "Staff" means any User whose role sits in STAFF_ROLES -- everyone who can
// sign into this admin panel. Managed separately from /customers (which only
// ever touches Role.CUSTOMER rows) even though both live on the same User
// table. Mirrors the role set auth.controller.ts's adminLogin already treats
// as admin-panel-eligible.
const STAFF_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.OPERATIONS_MANAGER,
  Role.INVENTORY_MANAGER,
  Role.VENDOR_MANAGER,
  Role.FINANCE_MANAGER,
  Role.CUSTOMER_SUPPORT,
];

export const getStaffUsers = async (req: Request, res: Response) => {
  try {
    const staff = await prisma.user.findMany({
      where: { role: { in: STAFF_ROLES }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      staff.map((s) => ({ ...sanitizeUser(s), isActive: s.roles.includes(s.role) }))
    );
  } catch (error) {
    console.error('Error fetching staff users:', error);
    res.status(500).json({ error: 'Failed to fetch administrators' });
  }
};

// Allocates a synthetic, never-dialable phone number for a staff account --
// User.phone is required + unique, but staff sign in with email/password, not
// OTP, so they have no real phone. A '0'-prefixed number can never collide
// with a real Indian mobile number (which always starts 6-9), matching the
// convention seed-admin.ts (0000000000) and product.controller.ts's house
// vendor (0000000002) already established.
async function allocateStaffPhone(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const candidate = '0' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
    const existing = await prisma.user.findUnique({ where: { phone: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  throw new Error('Could not allocate a unique staff phone after 10 attempts');
}

// Swaps only the staff-role portion of an identity's `roles` array, leaving
// every other role (CUSTOMER, or in principle VENDOR/DELIVERY_PARTNER/
// SERVICE_TECHNICIAN on a shared identity -- see the User model's own
// comment on why one phone can hold several role profiles) untouched.
// Setting `roles` to just `[newRole]` outright -- an earlier version of this
// -- silently stripped CUSTOMER from every admin account on any role change
// or deactivate/reactivate.
function withStaffRole(existingRoles: Role[], newRole: Role | null): Role[] {
  const nonStaff = existingRoles.filter((r) => !STAFF_ROLES.includes(r));
  return newRole ? [...nonStaff, newRole] : nonStaff;
}

export const createStaffUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, role } = req.body as { name?: string; email?: string; role?: Role };
    if (!name || !String(name).trim()) {
      res.status(400).json({ error: 'Name is required.' });
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'A valid email is required.' });
      return;
    }
    if (!role || !STAFF_ROLES.includes(role)) {
      res.status(400).json({ error: `role must be one of: ${STAFF_ROLES.join(', ')}` });
      return;
    }
    if (!isEmailConfigured()) {
      res.status(503).json({ error: 'Email delivery is not configured, so a new administrator cannot be invited right now.' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ error: 'An account with this email already exists.' });
      return;
    }

    const phone = await allocateStaffPhone();
    const user = await prisma.user.create({
      data: { name: name.trim(), email, phone, role, roles: [role] },
    });

    // No password is set here -- ensureFirebaseAccount creates the Firebase
    // Auth record with none, and the reset email below is how the new admin
    // sets their own first password, same trust model as seed-admin.ts minus
    // needing the creator to know or transmit a password at all.
    const firebaseUid = await ensureFirebaseAccount(user.id, email, null);
    if (!firebaseUid) {
      await prisma.user.delete({ where: { id: user.id } });
      res.status(502).json({ error: 'Failed to create the account in Firebase Auth. Nothing was saved -- try again.' });
      return;
    }

    const emailSent = await sendFirebasePasswordResetEmail(email);

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'STAFF_CREATE',
        entity: 'User',
        entityId: user.id,
        details: `Added administrator ${name} (${email}) with role ${role}`,
        ipAddress: req.ip || null,
      },
    });

    res.status(201).json({
      ...sanitizeUser(user),
      isActive: true,
      emailSent,
      message: emailSent
        ? 'Administrator created. A password-setup email has been sent to them.'
        : 'Administrator created, but the invite email could not be sent -- ask them to use "Forgot password" on the login screen.',
    });
  } catch (error) {
    console.error('Error creating staff user:', error);
    res.status(500).json({ error: 'Failed to create administrator' });
  }
};

export const updateStaffRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { role } = req.body as { role?: Role };
    if (!role || !STAFF_ROLES.includes(role)) {
      res.status(400).json({ error: `role must be one of: ${STAFF_ROLES.join(', ')}` });
      return;
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || !STAFF_ROLES.includes(target.role)) {
      res.status(404).json({ error: 'Administrator not found' });
      return;
    }

    // This endpoint is Super-Admin-gated, so reaching this point means the
    // caller IS a Super Admin -- this specifically blocks a Super Admin from
    // demoting themselves (accidentally or otherwise) and locking every
    // Super Admin out at once.
    if (target.id === req.user!.userId && role !== Role.SUPER_ADMIN) {
      res.status(400).json({ error: 'You cannot change your own role away from Super Admin.' });
      return;
    }

    if (target.role === Role.SUPER_ADMIN && role !== Role.SUPER_ADMIN) {
      const otherSuperAdmins = await prisma.user.count({
        where: { role: Role.SUPER_ADMIN, deletedAt: null, id: { not: id } },
      });
      if (otherSuperAdmins === 0) {
        res.status(400).json({ error: 'At least one Super Admin must remain.' });
        return;
      }
    }

    // Preserve deactivated state across a role change -- editing the role of
    // a deactivated admin shouldn't silently reactivate them.
    const wasActive = target.roles.includes(target.role);
    const updated = await prisma.user.update({
      where: { id },
      data: { role, roles: withStaffRole(target.roles, wasActive ? role : null) },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'STAFF_ROLE_UPDATE',
        entity: 'User',
        entityId: id,
        details: `Changed ${target.name || target.email}'s role from ${target.role} to ${role}`,
        ipAddress: req.ip || null,
      },
    });

    res.json({ ...sanitizeUser(updated), isActive: wasActive });
  } catch (error) {
    console.error('Error updating staff role:', error);
    res.status(500).json({ error: 'Failed to update administrator' });
  }
};

export const setStaffActive = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { isActive } = req.body as { isActive?: boolean };
    if (typeof isActive !== 'boolean') {
      res.status(400).json({ error: 'isActive (boolean) is required.' });
      return;
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || !STAFF_ROLES.includes(target.role)) {
      res.status(404).json({ error: 'Administrator not found' });
      return;
    }
    if (target.id === req.user!.userId) {
      res.status(400).json({ error: 'You cannot deactivate your own account.' });
      return;
    }
    if (!isActive && target.role === Role.SUPER_ADMIN) {
      const otherSuperAdmins = await prisma.user.count({
        where: { role: Role.SUPER_ADMIN, deletedAt: null, id: { not: id } },
      });
      if (otherSuperAdmins === 0) {
        res.status(400).json({ error: 'At least one Super Admin must remain.' });
        return;
      }
    }

    // Deactivation revokes every admin-panel privilege by dropping the role
    // from `roles` -- authenticate() (middlewares/auth.ts) checks that array
    // on every request, so this locks out an already-issued session
    // immediately rather than waiting up to 7 days for the JWT to expire.
    // `role` itself is left untouched so reactivating restores the exact same
    // role rather than requiring it to be picked again.
    const updated = await prisma.user.update({
      where: { id },
      data: { roles: withStaffRole(target.roles, isActive ? target.role : null) },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: isActive ? 'STAFF_REACTIVATE' : 'STAFF_DEACTIVATE',
        entity: 'User',
        entityId: id,
        details: `${isActive ? 'Reactivated' : 'Deactivated'} administrator ${target.name || target.email}`,
        ipAddress: req.ip || null,
      },
    });

    res.json({ ...sanitizeUser(updated), isActive });
  } catch (error) {
    console.error('Error updating staff status:', error);
    res.status(500).json({ error: 'Failed to update administrator status' });
  }
};
