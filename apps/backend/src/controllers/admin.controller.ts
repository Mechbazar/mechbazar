import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/auth';

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const [usersCount, ordersCount, productsCount, vendorsCount, lowStockCount] = await Promise.all([
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.order.count({ where: { status: 'PLACED' } }),
      prisma.product.count(),
      prisma.vendor.count(),
      prisma.inventory.count({ where: { availableStock: { lt: 10 } } })
    ]);

    const revenueRes = await prisma.order.aggregate({
      _sum: { finalAmount: true }
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
