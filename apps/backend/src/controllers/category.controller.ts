import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { normalizeVehicleType, parseVehicleTypeFilter } from '../utils/vehicleType';

export const getCategories = async (req: Request, res: Response) => {
  try {
    const { vehicleType, vehicle_type } = req.query;
    const rawVehicleType = vehicleType || vehicle_type;
    const resolvedVehicleType = parseVehicleTypeFilter(rawVehicleType);
    if (rawVehicleType && !resolvedVehicleType) {
      res.status(400).json({ error: `Invalid vehicleType "${rawVehicleType}". Must be CAR or BIKE.` });
      return;
    }

    const categories = await prisma.category.findMany({
      where: {
        ...(resolvedVehicleType && { vehicleType: resolvedVehicleType }),
      },
      include: {
        _count: { select: { products: true } }
      },
      orderBy: { name: 'asc' }
    });

    const withCounts = categories.map(({ _count, ...cat }) => ({
      ...cat,
      productCount: _count.products
    }));

    res.json(withCounts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, icon, status, vehicleType } = req.body;

    const newCategory = await prisma.category.create({
      data: {
        name,
        icon: icon || '📦',
        status: status || 'Active',
        vehicleType: normalizeVehicleType(vehicleType)
      }
    });

    res.status(201).json(newCategory);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: `A category named "${req.body.name}" already exists for this vehicle type.` });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to create category' });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, icon, status, vehicleType } = req.body;

    const updated = await prisma.category.update({
      where: { id: String(id) },
      data: {
        name,
        icon,
        status,
        vehicleType: vehicleType !== undefined ? normalizeVehicleType(vehicleType) : undefined
      }
    });

    res.json(updated);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: `A category named "${req.body.name}" already exists for this vehicle type.` });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Check for linked products
    const productCount = await prisma.product.count({ where: { categoryId: String(id) } });
    if (productCount > 0) {
      res.status(400).json({ error: `Cannot delete category. It has ${productCount} linked products. Please reassign them first.` });
      return;
    }

    await prisma.category.delete({ where: { id: String(id) } });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};
