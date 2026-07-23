import { Request, Response } from 'express';
import { Prisma, PrismaClient, VehicleType } from '@prisma/client';
import { normalizeVehicleType } from '../utils/vehicleType';
import prisma from '../config/prisma';

// Shared by validateCoupon (standalone "apply coupon" check in the cart UI)
// and order.controller.ts's createOrder (the actual checkout, which must
// re-validate rather than trust whatever the client claims it saw). Accepts
// a transaction client so createOrder can call it from inside its own
// $transaction. `cartVehicleTypes` is the set of distinct vehicleType values
// actually present in the cart -- if the coupon is scoped to one vehicle type
// (vehicleType is non-null) and the cart contains a different one, reject it
// rather than silently discounting a Car order with a Bike-only coupon.
export const resolveCoupon = async (
  code: string,
  cartTotal: number,
  client: Prisma.TransactionClient | PrismaClient = prisma,
  cartVehicleTypes: VehicleType[] = []
): Promise<{ error: string } | { coupon: Awaited<ReturnType<PrismaClient['coupon']['findUnique']>>; discountAmount: number }> => {
  const coupon = await client.coupon.findUnique({ where: { code } });
  if (!coupon) return { error: 'Invalid coupon code' };
  if (!coupon.isActive) return { error: 'Coupon is no longer active' };
  if (coupon.minOrderValue && cartTotal < coupon.minOrderValue) {
    return { error: `Minimum order value is ₹${coupon.minOrderValue}` };
  }
  if (coupon.vehicleType && cartVehicleTypes.some((t) => t !== coupon.vehicleType)) {
    return { error: `This coupon only applies to ${coupon.vehicleType === 'CAR' ? 'Car' : 'Bike'} orders.` };
  }

  const discountAmount = coupon.discountType === 'PERCENTAGE'
    ? Math.floor((cartTotal * coupon.discountValue) / 100)
    : coupon.discountValue;

  return { coupon, discountAmount: Math.min(discountAmount, cartTotal) };
};

export const getCoupons = async (req: Request, res: Response): Promise<void> => {
  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: {
        id: 'desc'
      }
    });
    res.status(200).json(coupons);
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
};

export const createCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, discountType, discountValue, minOrderValue, isActive, vehicleType } = req.body;

    // Check if code exists
    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (existing) {
      res.status(400).json({ error: 'Coupon code already exists' });
      return;
    }

    const coupon = await prisma.coupon.create({
      data: {
        code,
        discountType,
        discountValue,
        minOrderValue,
        isActive,
        // null/omitted = applies to both Car and Bike orders
        vehicleType: vehicleType ? normalizeVehicleType(vehicleType) : null
      }
    });
    
    res.status(201).json(coupon);
  } catch (error) {
    console.error('Error creating coupon:', error);
    res.status(500).json({ error: 'Failed to create coupon' });
  }
};

export const updateCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { code, discountType, discountValue, minOrderValue, isActive, vehicleType } = req.body;

    // Check if updating code to one that already exists
    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (existing && existing.id !== id) {
      res.status(400).json({ error: 'Coupon code already exists' });
      return;
    }

    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        code,
        discountType,
        discountValue,
        minOrderValue,
        isActive,
        vehicleType: vehicleType !== undefined ? (vehicleType ? normalizeVehicleType(vehicleType) : null) : undefined
      }
    });
    
    res.status(200).json(coupon);
  } catch (error) {
    console.error('Error updating coupon:', error);
    res.status(500).json({ error: 'Failed to update coupon' });
  }
};

export const deleteCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    
    await prisma.coupon.delete({
      where: { id }
    });
    
    res.status(200).json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('Error deleting coupon:', error);
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
};

// Any authenticated customer can browse currently redeemable coupons -- used
// by the account screen's "Available Coupons" list, which previously showed
// hardcoded mock codes that didn't correspond to any real coupon in the DB
// (applying one at checkout would have failed with "Invalid coupon code").
export const getActiveCoupons = async (req: Request, res: Response): Promise<void> => {
  try {
    const coupons = await prisma.coupon.findMany({
      where: { isActive: true },
      orderBy: { id: 'desc' },
      select: { id: true, code: true, discountType: true, discountValue: true, minOrderValue: true, vehicleType: true },
    });
    res.status(200).json(coupons);
  } catch (error) {
    console.error('Error fetching active coupons:', error);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
};

export const validateCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, cartTotal } = req.body;
    if (!code) {
      res.status(400).json({ error: 'Coupon code is required' });
      return;
    }

    const result = await resolveCoupon(code, Number(cartTotal) || 0);
    if ('error' in result) {
      res.status(result.error === 'Invalid coupon code' ? 404 : 400).json({ error: result.error });
      return;
    }

    res.status(200).json({
      id: result.coupon!.id,
      code: result.coupon!.code,
      discountType: result.coupon!.discountType,
      discountValue: result.coupon!.discountValue,
      discountAmount: result.discountAmount,
      message: 'Coupon applied successfully!'
    });
  } catch (error) {
    console.error('Error validating coupon:', error);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
};
