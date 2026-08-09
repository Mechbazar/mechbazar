import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const getManufacturers = async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    const vehicleType = typeof type === 'string' ? type.toUpperCase() : undefined;
    if (vehicleType && vehicleType !== 'CAR' && vehicleType !== 'BIKE') {
      return res.status(400).json({ error: 'type must be CAR or BIKE' });
    }
    const manufacturers = await prisma.manufacturer.findMany({
      where: vehicleType ? { type: vehicleType as 'CAR' | 'BIKE' } : undefined,
      orderBy: { name: 'asc' },
    });
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
      orderBy: { name: 'asc' },
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
      orderBy: { name: 'asc' },
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

// ============================================================
// ADMIN: Vehicle Master Management (Manufacturer/Model/Variant/
// FuelType/Vehicle CRUD). Everything above this point is the
// public read-only taxonomy lookup used by the mobile app's
// vehicle picker; everything below is authenticated and used by
// the admin panel's Vehicle Master page.
// ============================================================

export const getAllVehiclesAdmin = async (_req: Request, res: Response) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      include: { manufacturer: true, model: true, variant: true, fuelType: true },
      orderBy: [{ manufacturer: { name: 'asc' } }, { model: { name: 'asc' } }, { year: 'desc' }],
    });
    res.json(vehicles);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
};

export const createManufacturer = async (req: Request, res: Response) => {
  try {
    const { name, type } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const vehicleType = type === 'BIKE' ? 'BIKE' : 'CAR';
    const trimmed = String(name).trim();
    // Case-insensitive de-dupe so "Honda" typed twice from the admin's
    // "+ Add new" field doesn't fork into two rows for the same brand.
    const existing = await prisma.manufacturer.findFirst({
      where: { type: vehicleType, name: { equals: trimmed, mode: 'insensitive' } },
    });
    if (existing) {
      return res.status(200).json(existing);
    }
    const manufacturer = await prisma.manufacturer.create({ data: { name: trimmed, type: vehicleType } });
    res.status(201).json(manufacturer);
  } catch (error) {
    console.error('Error creating manufacturer:', error);
    res.status(500).json({ error: 'Failed to create manufacturer' });
  }
};

// Admin-only listing for the Vehicle Brand Master page -- same rows as the
// public getManufacturers above, but with model/vehicle counts so the admin
// can see at a glance which brands are actually in use before renaming or
// deleting one.
export const getManufacturersAdmin = async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    const vehicleType = typeof type === 'string' ? type.toUpperCase() : undefined;
    if (vehicleType && vehicleType !== 'CAR' && vehicleType !== 'BIKE') {
      return res.status(400).json({ error: 'type must be CAR or BIKE' });
    }
    const manufacturers = await prisma.manufacturer.findMany({
      where: vehicleType ? { type: vehicleType as 'CAR' | 'BIKE' } : undefined,
      include: { _count: { select: { models: true, vehicles: true } } },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    res.json(manufacturers);
  } catch (error) {
    console.error('Error fetching manufacturers (admin):', error);
    res.status(500).json({ error: 'Failed to fetch manufacturers' });
  }
};

export const updateManufacturer = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const manufacturer = await prisma.manufacturer.findUnique({ where: { id } });
    if (!manufacturer) {
      return res.status(404).json({ error: 'Manufacturer not found' });
    }
    const trimmed = String(name).trim();
    const duplicate = await prisma.manufacturer.findFirst({
      where: { type: manufacturer.type, name: { equals: trimmed, mode: 'insensitive' }, id: { not: id } },
    });
    if (duplicate) {
      return res.status(409).json({ error: `Another ${manufacturer.type.toLowerCase()} brand is already named "${trimmed}"` });
    }
    const updated = await prisma.manufacturer.update({ where: { id }, data: { name: trimmed } });
    res.json(updated);
  } catch (error) {
    console.error('Error updating manufacturer:', error);
    res.status(500).json({ error: 'Failed to update manufacturer' });
  }
};

export const deleteManufacturer = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const manufacturer = await prisma.manufacturer.findUnique({ where: { id } });
    if (!manufacturer) {
      return res.status(404).json({ error: 'Manufacturer not found' });
    }
    const [modelCount, vehicleCount] = await Promise.all([
      prisma.model.count({ where: { manufacturerId: id } }),
      prisma.vehicle.count({ where: { manufacturerId: id } }),
    ]);
    if (modelCount > 0 || vehicleCount > 0) {
      return res.status(400).json({
        error: `Cannot delete: this brand has ${modelCount} model(s) and ${vehicleCount} vehicle combination(s). Remove those first.`,
      });
    }
    await prisma.manufacturer.delete({ where: { id } });
    res.status(200).json({ message: 'Brand deleted' });
  } catch (error) {
    console.error('Error deleting manufacturer:', error);
    res.status(500).json({ error: 'Failed to delete manufacturer' });
  }
};

export const createModel = async (req: Request, res: Response) => {
  try {
    const { manufacturerId, name } = req.body;
    if (!manufacturerId || !name || !String(name).trim()) {
      return res.status(400).json({ error: 'manufacturerId and name are required' });
    }
    const manufacturer = await prisma.manufacturer.findUnique({ where: { id: String(manufacturerId) } });
    if (!manufacturer) {
      return res.status(404).json({ error: 'Manufacturer not found' });
    }
    const trimmed = String(name).trim();
    const existing = await prisma.model.findFirst({
      where: { manufacturerId: String(manufacturerId), name: { equals: trimmed, mode: 'insensitive' } },
    });
    if (existing) {
      return res.status(200).json(existing);
    }
    const model = await prisma.model.create({ data: { manufacturerId: String(manufacturerId), name: trimmed } });
    res.status(201).json(model);
  } catch (error) {
    console.error('Error creating model:', error);
    res.status(500).json({ error: 'Failed to create model' });
  }
};

export const createVariant = async (req: Request, res: Response) => {
  try {
    const { modelId, name } = req.body;
    if (!modelId || !name || !String(name).trim()) {
      return res.status(400).json({ error: 'modelId and name are required' });
    }
    const model = await prisma.model.findUnique({ where: { id: String(modelId) } });
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    const trimmed = String(name).trim();
    const existing = await prisma.variant.findFirst({
      where: { modelId: String(modelId), name: { equals: trimmed, mode: 'insensitive' } },
    });
    if (existing) {
      return res.status(200).json(existing);
    }
    const variant = await prisma.variant.create({ data: { modelId: String(modelId), name: trimmed } });
    res.status(201).json(variant);
  } catch (error) {
    console.error('Error creating variant:', error);
    res.status(500).json({ error: 'Failed to create variant' });
  }
};

export const createFuelType = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const trimmed = String(name).trim();
    const fuelType = await prisma.fuelType.upsert({
      where: { name: trimmed },
      update: {},
      create: { name: trimmed },
    });
    res.status(201).json(fuelType);
  } catch (error) {
    console.error('Error creating fuel type:', error);
    res.status(500).json({ error: 'Failed to create fuel type' });
  }
};

const parseVehiclePayload = (body: any) => {
  const { manufacturerId, modelId, variantId, fuelTypeId, year, engineCc } = body;
  if (!manufacturerId || !modelId || !fuelTypeId || !year) {
    return { error: 'manufacturerId, modelId, fuelTypeId and year are required' };
  }
  const yearNum = Number(year);
  if (!Number.isInteger(yearNum) || yearNum < 1980 || yearNum > new Date().getFullYear() + 1) {
    return { error: 'year is invalid' };
  }
  let engineCcNum: number | null = null;
  if (engineCc !== undefined && engineCc !== null && engineCc !== '') {
    engineCcNum = Number(engineCc);
    if (!Number.isInteger(engineCcNum) || engineCcNum <= 0) {
      return { error: 'engineCc must be a positive whole number' };
    }
  }
  return {
    data: {
      manufacturerId: String(manufacturerId),
      modelId: String(modelId),
      variantId: variantId ? String(variantId) : null,
      fuelTypeId: String(fuelTypeId),
      year: yearNum,
      engineCc: engineCcNum,
    },
  };
};

export const createVehicleAdmin = async (req: Request, res: Response) => {
  try {
    const parsed = parseVehiclePayload(req.body);
    if (parsed.error || !parsed.data) {
      return res.status(400).json({ error: parsed.error });
    }
    const vehicle = await prisma.vehicle.create({
      data: parsed.data,
      include: { manufacturer: true, model: true, variant: true, fuelType: true },
    });
    res.status(201).json(vehicle);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'This exact vehicle (make/model/variant/fuel/year) already exists' });
    }
    console.error('Error creating vehicle:', error);
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
};

export const updateVehicleAdmin = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    const parsed = parseVehiclePayload(req.body);
    if (parsed.error || !parsed.data) {
      return res.status(400).json({ error: parsed.error });
    }
    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: parsed.data,
      include: { manufacturer: true, model: true, variant: true, fuelType: true },
    });
    res.json(vehicle);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'This exact vehicle (make/model/variant/fuel/year) already exists' });
    }
    console.error('Error updating vehicle:', error);
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
};

export const deleteVehicleAdmin = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    const [compatCount, garageCount] = await Promise.all([
      prisma.productCompatibility.count({ where: { vehicleId: id } }),
      prisma.userVehicle.count({ where: { vehicleId: id } }),
    ]);
    if (compatCount > 0 || garageCount > 0) {
      return res.status(400).json({
        error: `Cannot delete: linked to ${compatCount} product(s) and ${garageCount} customer garage entr${garageCount === 1 ? 'y' : 'ies'}.`,
      });
    }
    await prisma.vehicle.delete({ where: { id } });
    res.status(200).json({ message: 'Vehicle deleted' });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
};
