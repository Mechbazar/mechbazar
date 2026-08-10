import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/prisma';
import { isPincodeServiceable, normalizePincode } from '../services/serviceability.service';

const PINCODE_REGEX = /^\d{6}$/;

// Public -- called by the customer app while entering/selecting a delivery
// address, so it can warn before checkout rather than the customer only
// finding out at "Place Order" that createOrder/createBooking rejected it.
export const checkPincode = async (req: Request, res: Response) => {
  try {
    const pincode = normalizePincode(String(req.query.pincode || ''));
    if (!PINCODE_REGEX.test(pincode)) {
      res.status(400).json({ error: 'A valid 6-digit pincode is required.' });
      return;
    }
    const serviceable = await isPincodeServiceable(pincode);
    res.json({ pincode, serviceable });
  } catch (error) {
    console.error('Error checking pincode serviceability:', error);
    res.status(500).json({ error: 'Failed to check serviceability' });
  }
};

// ============ Admin: manage the serviceable-pincode allowlist ============

export const getServiceablePincodes = async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.serviceablePincode.findMany({ orderBy: { pincode: 'asc' } });
    res.json(rows);
  } catch (error) {
    console.error('Error fetching serviceable pincodes:', error);
    res.status(500).json({ error: 'Failed to fetch serviceable pincodes' });
  }
};

// Accepts either a single { pincode, city?, state? } or a bulk
// { pincodes: string[], city?, state? } -- an admin rolling out coverage for
// a whole city/launch area needs to add dozens of pincodes at once, and a
// one-at-a-time-only form would make that painful enough to discourage using
// the feature at all.
export const addServiceablePincodes = async (req: AuthRequest, res: Response) => {
  try {
    const { pincode, pincodes, city, state } = req.body as {
      pincode?: string; pincodes?: string[]; city?: string; state?: string;
    };
    const list = Array.from(
      new Set(
        (pincodes && Array.isArray(pincodes) ? pincodes : pincode ? [pincode] : [])
          .map((p) => normalizePincode(String(p)))
          .filter(Boolean)
      )
    );
    if (list.length === 0) {
      res.status(400).json({ error: 'At least one pincode is required.' });
      return;
    }
    const invalid = list.filter((p) => !PINCODE_REGEX.test(p));
    if (invalid.length > 0) {
      res.status(400).json({ error: `Invalid pincode(s): ${invalid.join(', ')}. Must be exactly 6 digits.` });
      return;
    }

    // upsert per pincode rather than createMany+skipDuplicates -- re-adding an
    // existing (possibly deactivated) pincode should reactivate it and refresh
    // city/state instead of silently no-op'ing.
    const results = await prisma.$transaction(
      list.map((p) =>
        prisma.serviceablePincode.upsert({
          where: { pincode: p },
          update: { isActive: true, ...(city !== undefined && { city }), ...(state !== undefined && { state }) },
          create: { pincode: p, city: city || null, state: state || null },
        })
      )
    );
    res.status(201).json(results);
  } catch (error) {
    console.error('Error adding serviceable pincodes:', error);
    res.status(500).json({ error: 'Failed to add serviceable pincodes' });
  }
};

export const updateServiceablePincode = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { isActive, city, state } = req.body as { isActive?: boolean; city?: string; state?: string };
    const existing = await prisma.serviceablePincode.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Pincode not found' });
      return;
    }
    const updated = await prisma.serviceablePincode.update({
      where: { id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
      },
    });
    res.json(updated);
  } catch (error) {
    console.error('Error updating serviceable pincode:', error);
    res.status(500).json({ error: 'Failed to update serviceable pincode' });
  }
};

export const deleteServiceablePincode = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const existing = await prisma.serviceablePincode.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Pincode not found' });
      return;
    }
    await prisma.serviceablePincode.delete({ where: { id } });
    res.status(200).json({ message: 'Pincode removed' });
  } catch (error) {
    console.error('Error deleting serviceable pincode:', error);
    res.status(500).json({ error: 'Failed to delete serviceable pincode' });
  }
};
