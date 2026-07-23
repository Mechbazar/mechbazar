import { Request, Response } from 'express';
import { normalizeVehicleType, parseVehicleTypeFilter } from '../utils/vehicleType';
import prisma from '../config/prisma';

export const getBanners = async (req: Request, res: Response): Promise<void> => {
  try {
    const banners = await prisma.banner.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.status(200).json(banners);
  } catch (error) {
    console.error('Error fetching banners:', error);
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
};

export const getPublicBanners = async (req: Request, res: Response): Promise<void> => {
  try {
    // Invalid/unrecognized vehicle values fall back to "no filter" (a public
    // browse endpoint should degrade gracefully, not 400 a customer's home feed).
    const vehicleFilter = parseVehicleTypeFilter(req.query.vehicle) ?? normalizeVehicleType(req.query.vehicle || 'car');
    const banners = await prisma.banner.findMany({
      where: {
        isActive: true,
        vehicleType: vehicleFilter
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(banners);
  } catch (error) {
    console.error('Error fetching public banners:', error);
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
};

export const createBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, image, type, link, buttonText, redirectLink, vehicleType, isActive, startDate, endDate } = req.body;

    const banner = await prisma.banner.create({
      data: {
        title,
        image,
        type: type || 'HOMEPAGE',
        link,
        buttonText,
        redirectLink,
        vehicleType: normalizeVehicleType(vehicleType),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    res.status(201).json(banner);
  } catch (error) {
    console.error('Error creating banner:', error);
    res.status(500).json({ error: 'Failed to create banner' });
  }
};

export const updateBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, image, type, link, buttonText, redirectLink, vehicleType, isActive, startDate, endDate } = req.body;

    const banner = await prisma.banner.update({
      where: { id: String(id) },
      data: {
        title,
        image,
        type,
        link,
        buttonText,
        redirectLink,
        vehicleType: vehicleType !== undefined ? normalizeVehicleType(vehicleType) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        startDate: startDate ? new Date(startDate) : startDate === null ? null : undefined,
        endDate: endDate ? new Date(endDate) : endDate === null ? null : undefined,
      },
    });

    res.status(200).json(banner);
  } catch (error) {
    console.error('Error updating banner:', error);
    res.status(500).json({ error: 'Failed to update banner' });
  }
};

export const deleteBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    await prisma.banner.delete({
      where: { id: String(id) }
    });
    
    res.status(200).json({ message: 'Banner deleted successfully' });
  } catch (error) {
    console.error('Error deleting banner:', error);
    res.status(500).json({ error: 'Failed to delete banner' });
  }
};
