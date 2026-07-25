import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const getWarehouses = async (req: Request, res: Response): Promise<void> => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      include: {
        _count: {
          select: { inventory: true }
        }
      }
    });
    res.status(200).json(warehouses);
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    res.status(500).json({ error: 'Failed to fetch warehouses' });
  }
};

// Synthesizes the legacy free-text `address` field from structured parts when
// the caller sends only those (e.g. a future map-based picker) and omits
// `address` -- keeps existing clients that still read `address` as plain
// text working, even for rows created without ever typing a free-text address.
function synthesizeAddress(parts: { addressLine1?: string; addressLine2?: string; city?: string; state?: string; pincode?: string }) {
  return [parts.addressLine1, parts.addressLine2, parts.city, parts.state, parts.pincode].filter(Boolean).join(', ');
}

export const createWarehouse = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name, code, address, managerName, phone, capacity,
      addressLine1, addressLine2, city, state, pincode, country, lat, lng, placeId, formattedAddress,
    } = req.body;
    const existing = await prisma.warehouse.findUnique({ where: { code } });

    if (existing) {
      res.status(400).json({ error: 'Warehouse code already exists' });
      return;
    }

    const resolvedAddress = address || synthesizeAddress({ addressLine1, addressLine2, city, state, pincode });

    const warehouse = await prisma.warehouse.create({
      data: {
        name, code, address: resolvedAddress, managerName, phone, capacity: Number(capacity) || 0,
        addressLine1, addressLine2, city, state, pincode, country, lat, lng, placeId, formattedAddress,
      }
    });
    res.status(201).json(warehouse);
  } catch (error) {
    console.error('Error creating warehouse:', error);
    res.status(500).json({ error: 'Failed to create warehouse' });
  }
};

export const updateWarehouse = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const {
      name, address, managerName, phone, capacity, isActive,
      addressLine1, addressLine2, city, state, pincode, country, lat, lng, placeId, formattedAddress,
    } = req.body;

    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: {
        name, address, managerName, phone, capacity: Number(capacity), isActive,
        addressLine1, addressLine2, city, state, pincode, country, lat, lng, placeId, formattedAddress,
      }
    });
    res.status(200).json(warehouse);
  } catch (error) {
    console.error('Error updating warehouse:', error);
    res.status(500).json({ error: 'Failed to update warehouse' });
  }
};

export const deleteWarehouse = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    
    // Check if inventory exists
    const invCount = await prisma.inventory.count({ where: { warehouseId: id } });
    if (invCount > 0) {
      res.status(400).json({ error: 'Cannot delete warehouse with existing inventory' });
      return;
    }

    await prisma.warehouse.delete({ where: { id } });
    res.status(200).json({ message: 'Warehouse deleted successfully' });
  } catch (error) {
    console.error('Error deleting warehouse:', error);
    res.status(500).json({ error: 'Failed to delete warehouse' });
  }
};
