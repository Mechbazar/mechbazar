import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { normalizeVehicleType, parseVehicleTypeFilter } from '../utils/vehicleType';

// Invalid/unrecognized values fall back to "no filter" -- a public browse
// endpoint should degrade gracefully rather than 400 a customer's offers feed.
const vehicleFilter = (v: unknown) => {
  const parsed = parseVehicleTypeFilter(v);
  return parsed ? { vehicleType: parsed } : {};
};

export const getOffers = async (req: Request, res: Response): Promise<void> => {
  try {
    const vehicle = req.query.vehicle || 'car';
    const offers = await prisma.offer.findMany({
      where: { isActive: true, ...vehicleFilter(vehicle) },
      orderBy: { createdAt: 'desc' },
    });
    res.json(offers);
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
};

export const getAllOffers = async (req: Request, res: Response): Promise<void> => {
  try {
    const offers = await prisma.offer.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(offers);
  } catch (error) {
    console.error('Error fetching all offers:', error);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
};

export const createOffer = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      description,
      image,
      discountType,
      discountValue,
      minOrderValue,
      code,
      vehicleType,
      isActive,
      startDate,
      endDate,
    } = req.body;

    const offer = await prisma.offer.create({
      data: {
        title,
        description,
        image,
        discountType: discountType || 'PERCENTAGE',
        discountValue: Number(discountValue) || 0,
        minOrderValue: Number(minOrderValue) || 0,
        code,
        vehicleType: normalizeVehicleType(vehicleType),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    res.status(201).json(offer);
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({ error: 'Failed to create offer' });
  }
};

export const updateOffer = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const {
      title,
      description,
      image,
      discountType,
      discountValue,
      minOrderValue,
      code,
      vehicleType,
      isActive,
      startDate,
      endDate,
    } = req.body;

    const offer = await prisma.offer.update({
      where: { id },
      data: {
        title,
        description,
        image,
        discountType: discountType || undefined,
        discountValue: discountValue !== undefined ? Number(discountValue) : undefined,
        minOrderValue: minOrderValue !== undefined ? Number(minOrderValue) : undefined,
        code,
        vehicleType: vehicleType !== undefined ? normalizeVehicleType(vehicleType) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        startDate: startDate ? new Date(startDate) : startDate === null ? null : undefined,
        endDate: endDate ? new Date(endDate) : endDate === null ? null : undefined,
      },
    });

    res.json(offer);
  } catch (error) {
    console.error('Error updating offer:', error);
    res.status(500).json({ error: 'Failed to update offer' });
  }
};

export const deleteOffer = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    await prisma.offer.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting offer:', error);
    res.status(500).json({ error: 'Failed to delete offer' });
  }
};
