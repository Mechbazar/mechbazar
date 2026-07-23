import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const getInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { warehouseId, productId } = req.query;
    const filter: any = {};
    if (warehouseId) filter.warehouseId = String(warehouseId);
    if (productId) filter.productId = String(productId);

    const inventory = await prisma.inventory.findMany({
      where: filter,
      include: {
        product: {
          include: { category: true, brand: true, vendor: true }
        },
        warehouse: true
      },
      orderBy: { product: { name: 'asc' } }
    });

    res.status(200).json(inventory);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
};

export const adjustStock = async (req: Request, res: Response): Promise<void> => {
  try {
    const { inventoryId, newQuantity, reason, actionType } = req.body;
    const userId = (req as any).user.userId;

    const inventory = await prisma.inventory.findUnique({ where: { id: inventoryId } });
    if (!inventory) {
      res.status(404).json({ error: 'Inventory record not found' });
      return;
    }

    const prevQuantity = inventory.availableStock;
    const quantityDiff = newQuantity - prevQuantity;

    // Transaction to update stock and create movement log
    const updated = await prisma.$transaction(async (tx) => {
      const updatedInv = await tx.inventory.update({
        where: { id: inventoryId },
        data: { availableStock: newQuantity }
      });

      await tx.stockMovement.create({
        data: {
          inventoryId,
          userId,
          action: actionType || 'ADJUSTMENT',
          prevQuantity,
          newQuantity,
          quantityDiff,
          reason
        }
      });

      // Update global product stock
      const productInventory = await tx.inventory.aggregate({
        where: { productId: inventory.productId },
        _sum: { availableStock: true }
      });

      await tx.product.update({
        where: { id: inventory.productId },
        data: { stock: productInventory._sum.availableStock || 0 }
      });

      return updatedInv;
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error('Error adjusting stock:', error);
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
};
