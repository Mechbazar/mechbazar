import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/auth';
import { Role } from '@prisma/client';
import { normalizeVehicleType, parseVehicleTypeFilter } from '../utils/vehicleType';

const ADMIN_CATEGORY_ROLES: string[] = [Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATIONS_MANAGER];

export const getCategories = async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleType, vehicle_type } = req.query;
    const rawVehicleType = vehicleType || vehicle_type;
    const resolvedVehicleType = parseVehicleTypeFilter(rawVehicleType);
    if (rawVehicleType && !resolvedVehicleType) {
      res.status(400).json({ error: `Invalid vehicleType "${rawVehicleType}". Must be CAR or BIKE.` });
      return;
    }

    // Public/customer/vendor callers only ever see Active categories -- the
    // admin panel's "Inactive (Hidden)" status option previously did nothing
    // at all, since this query never filtered on status and every consumer
    // (mobile app, vendor product-creation picker) shared this same public
    // endpoint. Admins keep seeing every status so the Categories page can
    // still manage (and re-activate) hidden ones.
    const isAdminCaller = !!req.user && ADMIN_CATEGORY_ROLES.includes(req.user.role);

    const categories = await prisma.category.findMany({
      where: {
        ...(resolvedVehicleType && { vehicleType: resolvedVehicleType }),
        ...(!isAdminCaller && { status: 'Active' }),
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
    const resolvedVehicleType = normalizeVehicleType(vehicleType);

    // The DB unique constraint on [name, vehicleType] is case-sensitive, so
    // "Engine Oil" and "Engine oil" wouldn't collide there -- check
    // case-insensitively first so an admin can't create a duplicate that
    // only the exact-match constraint would have caught.
    const duplicate = name
      ? await prisma.category.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, vehicleType: resolvedVehicleType } })
      : null;
    if (duplicate) {
      res.status(400).json({ error: `A category named "${duplicate.name}" already exists for this vehicle type.` });
      return;
    }

    const newCategory = await prisma.category.create({
      data: {
        name,
        icon: icon || '📦',
        status: status || 'Active',
        vehicleType: resolvedVehicleType
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
    const resolvedVehicleType = vehicleType !== undefined ? normalizeVehicleType(vehicleType) : undefined;

    if (name) {
      const duplicate = await prisma.category.findFirst({
        where: {
          id: { not: String(id) },
          name: { equals: name, mode: 'insensitive' },
          vehicleType: resolvedVehicleType ?? (await prisma.category.findUnique({ where: { id: String(id) }, select: { vehicleType: true } }))?.vehicleType,
        },
      });
      if (duplicate) {
        res.status(400).json({ error: `A category named "${duplicate.name}" already exists for this vehicle type.` });
        return;
      }
    }

    const updated = await prisma.category.update({
      where: { id: String(id) },
      data: {
        name,
        icon,
        status,
        vehicleType: resolvedVehicleType
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
