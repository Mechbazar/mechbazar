import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const getManufacturers = async (req: Request, res: Response) => {
  try {
    const manufacturers = await prisma.manufacturer.findMany();
    res.json(manufacturers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch manufacturers' });
  }
};

export const getModels = async (req: Request, res: Response) => {
  try {
    const { manufacturerId } = req.query;
    if (!manufacturerId) {
      return res.status(400).json({ error: 'manufacturerId is required' });
    }
    const models = await prisma.model.findMany({
      where: { manufacturerId: String(manufacturerId) },
    });
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch models' });
  }
};

export const getVariants = async (req: Request, res: Response) => {
  try {
    const { modelId } = req.query;
    if (!modelId) {
      return res.status(400).json({ error: 'modelId is required' });
    }
    const variants = await prisma.variant.findMany({
      where: { modelId: String(modelId) },
    });
    res.json(variants);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch variants' });
  }
};

export const getFuelTypes = async (req: Request, res: Response) => {
  try {
    const fuelTypes = await prisma.fuelType.findMany();
    res.json(fuelTypes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch fuel types' });
  }
};

export const getVehicleByDetails = async (req: Request, res: Response) => {
  try {
    const { manufacturerId, modelId, variantId, fuelTypeId, year } = req.query;
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        manufacturerId: String(manufacturerId),
        modelId: String(modelId),
        variantId: variantId ? String(variantId) : null,
        fuelTypeId: String(fuelTypeId),
        year: Number(year),
      },
    });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
};
