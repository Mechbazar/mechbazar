import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/auth';
import { notifyUser } from '../utils/notify';

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

type BroadcastAudience = 'ALL_CUSTOMERS' | 'ALL_VENDORS' | 'ALL_TECHNICIANS' | 'ALL_RIDERS';

const AUDIENCE_ROLE: Record<BroadcastAudience, Role> = {
  ALL_CUSTOMERS: Role.CUSTOMER,
  ALL_VENDORS: Role.VENDOR,
  ALL_TECHNICIANS: Role.SERVICE_TECHNICIAN,
  ALL_RIDERS: Role.DELIVERY_PARTNER,
};

// Backs the Dashboard's "Send Notification" quick action -- a real broadcast,
// reusing the same per-user notification fan-out every other admin
// notification already goes through (utils/notify.ts's notifyUser), just
// looped over an audience instead of a single recipient. Fine at current
// scale; a large audience should eventually move off the request thread.
export const broadcastNotification = async (req: Request, res: Response) => {
  try {
    const { title, body, audience } = req.body as { title?: string; body?: string; audience?: BroadcastAudience };

    if (!title || !body) {
      res.status(400).json({ error: 'title and body are required' });
      return;
    }
    const role = audience ? AUDIENCE_ROLE[audience] : undefined;
    if (!role) {
      res.status(400).json({ error: 'audience must be one of ALL_CUSTOMERS, ALL_VENDORS, ALL_TECHNICIANS, ALL_RIDERS' });
      return;
    }

    const recipients = await prisma.user.findMany({ where: { roles: { has: role } }, select: { id: true } });
    await Promise.all(recipients.map((r) => notifyUser(r.id, title, body, {}, { type: 'ADMIN_BROADCAST' })));

    res.json({ sent: recipients.length });
  } catch (error) {
    console.error('Error broadcasting notification:', error);
    res.status(500).json({ error: 'Failed to broadcast notification' });
  }
};
