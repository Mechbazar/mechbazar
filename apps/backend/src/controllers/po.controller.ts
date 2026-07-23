import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const getPurchaseOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const pos = await prisma.purchaseOrder.findMany({
      include: {
        supplier: true,
        items: true,
        _count: {
          select: { items: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.status(200).json(pos);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
};

export const createPurchaseOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { supplierId, totalCost, expectedDate } = req.body;
    
    // In a real application, we would also process the items[] from req.body
    // For this simple implementation, we just create the PO header
    
    const po = await prisma.purchaseOrder.create({
      data: { 
        supplierId, 
        totalCost: Number(totalCost), 
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        status: 'DRAFT'
      }
    });
    
    const fullPo = await prisma.purchaseOrder.findUnique({
      where: { id: po.id },
      include: { supplier: true, _count: { select: { items: true } } }
    });
    
    res.status(201).json(fullPo);
  } catch (error) {
    console.error('Error creating purchase order:', error);
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
};
