import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { parseVehicleTypeFilter } from '../utils/vehicleType';

export const getHome = async (req: Request, res: Response): Promise<void> => {
  try {
    const vehicle = req.query.vehicle || 'car';
    const v = String(vehicle);

    // Invalid/unrecognized values fall back to "no filter" -- this is a public
    // browse endpoint, degrading gracefully beats 400-ing a customer's home feed.
    const vehicleFilter = (raw: unknown) => {
      const parsed = parseVehicleTypeFilter(raw);
      return parsed ? { vehicleType: parsed } : {};
    };

    const [banners, categories, deals, featured, bestSellers, brands, offers] = await Promise.all([
      prisma.banner.findMany({
        where: { isActive: true, ...vehicleFilter(v) },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.category.findMany({
        where: { status: 'Active', ...vehicleFilter(v) },
        orderBy: { name: 'asc' },
      }),
      prisma.product.findMany({
        where: { status: 'APPROVED', isDeal: true, ...vehicleFilter(v) },
        include: { category: true, brand: true },
        take: 10,
      }),
      prisma.product.findMany({
        where: { status: 'APPROVED', isFeatured: true, ...vehicleFilter(v) },
        include: { category: true, brand: true },
        take: 10,
      }),
      prisma.product.findMany({
        where: { status: 'APPROVED', ...vehicleFilter(v) },
        include: { category: true, brand: true },
        orderBy: { salesCount: 'desc' },
        take: 10,
      }),
      prisma.brand.findMany({
        where: vehicleFilter(v),
        orderBy: { name: 'asc' },
      }),
      prisma.offer.findMany({
        where: { isActive: true, ...vehicleFilter(v) },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({ vehicle: v, banners, categories, deals, featured, bestSellers, brands, offers });
  } catch (error) {
    console.error('Error fetching home data:', error);
    res.status(500).json({ error: 'Failed to fetch home data' });
  }
};
