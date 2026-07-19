import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getSuppliers = async (req: Request, res: Response): Promise<void> => {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: {
        _count: {
          select: { purchaseOrders: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.status(200).json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
};

export const createSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, companyName, contactPerson, phone, email, gstNumber, address } = req.body;
    
    const supplier = await prisma.supplier.create({
      data: { name, companyName, contactPerson, phone, email, gstNumber, address }
    });
    res.status(201).json(supplier);
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
};

export const updateSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { name, companyName, contactPerson, phone, email, gstNumber, address, isActive } = req.body;
    
    const supplier = await prisma.supplier.update({
      where: { id },
      data: { name, companyName, contactPerson, phone, email, gstNumber, address, isActive }
    });
    res.status(200).json(supplier);
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
};

export const deleteSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    
    // Check if POs exist
    const poCount = await prisma.purchaseOrder.count({ where: { supplierId: id } });
    if (poCount > 0) {
      res.status(400).json({ error: 'Cannot delete supplier with existing purchase orders' });
      return;
    }

    await prisma.supplier.delete({ where: { id } });
    res.status(200).json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
};
