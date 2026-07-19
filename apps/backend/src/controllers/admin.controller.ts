import { Request, Response } from 'express';
import prisma from '../config/prisma';

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
