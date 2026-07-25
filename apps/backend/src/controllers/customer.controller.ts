import { Request, Response } from 'express';
import { Prisma, Role, VehicleType } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';
import { sanitizeUser, sanitizeUsers } from '../utils/sanitizeUser';
import { verifyOtpAndResolvePhone, OtpVerificationError } from '../utils/otp';
import prisma from '../config/prisma';

export const getCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    const customers = await prisma.user.findMany({
      where: {
        role: Role.CUSTOMER
      },
      include: {
        _count: {
          select: { orders: true }
        },
        // Admin panel's Customers page shows each customer's saved addresses
        // on a read-only map (Phase 4 Maps integration) -- additive, no
        // schema change, same Address rows the customer app already writes.
        addresses: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.status(200).json(sanitizeUsers(customers));
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
};
// Backs the admin panel's "View Details" drawer. The list endpoint above stays
// deliberately light (it polls); everything a single customer's detail view
// needs -- garage, recent orders, recent bookings -- is fetched on demand here.
export const getCustomerById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const customer = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: { select: { orders: true, serviceBookings: true, reviews: true, wishlists: true } },
        addresses: true,
        userVehicles: { orderBy: [{ isDefault: 'desc' }] },
        // Order has no human-facing order number column -- admin screens show a
        // shortened id, so send the id and let the UI truncate it.
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, status: true, finalAmount: true, createdAt: true },
        },
        serviceBookings: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, bookingNumber: true, status: true, finalAmount: true, createdAt: true },
        },
      },
    });

    if (!customer || customer.role !== Role.CUSTOMER) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    res.status(200).json(sanitizeUser(customer));
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
};

// Hard-deletes a customer account. No relation in the schema cascades, so every
// dependent row has to go explicitly. Rows that are the customer's own data
// (addresses, garage, wishlist, notifications, reviews, tickets) are removed
// with them; anything that is a business record -- orders, service bookings,
// audit/stock trails -- blocks the delete instead, so history is never silently
// destroyed. Admins who need those gone must deal with the orders first.
export const deleteCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);

    const customer = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: { orders: true, serviceBookings: true, auditLogs: true, stockMovements: true },
        },
      },
    });

    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    if (customer.role !== Role.CUSTOMER) {
      res.status(400).json({ error: 'Only customer accounts can be deleted from this screen.' });
      return;
    }

    const blockers: string[] = [];
    if (customer._count.orders > 0) blockers.push(`${customer._count.orders} order(s)`);
    if (customer._count.serviceBookings > 0) blockers.push(`${customer._count.serviceBookings} service booking(s)`);
    if (customer._count.auditLogs > 0 || customer._count.stockMovements > 0) blockers.push('activity logs');
    if (blockers.length > 0) {
      res.status(400).json({
        error: `This customer has ${blockers.join(', ')} and cannot be deleted. Delete or reassign that history first.`,
      });
      return;
    }

    await prisma.$transaction([
      prisma.serviceReview.deleteMany({ where: { userId: id } }),
      prisma.review.deleteMany({ where: { userId: id } }),
      prisma.wishlist.deleteMany({ where: { userId: id } }),
      prisma.notification.deleteMany({ where: { userId: id } }),
      prisma.supportTicket.deleteMany({ where: { userId: id } }),
      prisma.userVehicle.deleteMany({ where: { userId: id } }),
      prisma.address.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
      prisma.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: 'CUSTOMER_DELETE',
          entity: 'User',
          entityId: id,
          details: `Deleted customer ${customer.name || 'Unknown'} (${customer.phone})`,
          ipAddress: req.ip || null,
        },
      }),
    ]);

    res.status(200).json({ message: 'Customer deleted' });
  } catch (error) {
    // P2003 = some other table still references this user (a relation added
    // after this endpoint was written); report it instead of a blank 500.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      res.status(400).json({ error: 'This customer still has linked records and cannot be deleted.' });
      return;
    }
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
};

export const updateCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { isBusinessVerified } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: { isBusinessVerified }
    });

    res.status(200).json(sanitizeUser(user));
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
};

// ============ Self-service notification history (any authenticated user) ============
// Backs a "Notifications" screen with real history instead of only live push/socket
// events -- the Notification model existed already but nothing wrote to it before
// notifyUser (utils/notify.ts) started persisting a row alongside every push.

export const getMyNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.status(200).json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

export const markNotificationRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== req.user!.userId) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    const updated = await prisma.notification.update({ where: { id }, data: { isRead: true } });
    res.status(200).json(updated);
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
};

export const deleteMyNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== req.user!.userId) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    await prisma.notification.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};

// ============ Self-service saved addresses (any authenticated user) ============
// The Address model already existed (order.controller.ts auto-creates one
// inline as part of checkout), but no API ever let a customer manage their
// own saved addresses -- needed for the Services booking flow's "select
// saved address or add new" step, and for "Save multiple addresses".

export const getMyAddresses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user!.userId },
      orderBy: [{ isDefault: 'desc' }],
    });
    res.status(200).json(addresses);
  } catch (error) {
    console.error('Error fetching addresses:', error);
    res.status(500).json({ error: 'Failed to fetch addresses' });
  }
};

export const createMyAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, line1, line2, city, state, pincode, country, lat, lng, placeId, formattedAddress, isDefault } = req.body;
    if (!title || !line1 || !city || !state || !pincode) {
      res.status(400).json({ error: 'title, line1, city, state and pincode are required' });
      return;
    }

    const userId = req.user!.userId;
    const existingCount = await prisma.address.count({ where: { userId } });

    const address = await prisma.$transaction(async (tx) => {
      // First address is always the default; otherwise only flip other rows
      // over when the caller explicitly asks for this one to become default.
      const shouldBeDefault = existingCount === 0 || !!isDefault;
      if (shouldBeDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.address.create({
        data: {
          userId, title, line1, line2: line2 || null, city, state, pincode,
          country: country ?? null, lat: lat ?? null, lng: lng ?? null,
          placeId: placeId ?? null, formattedAddress: formattedAddress ?? null,
          isDefault: shouldBeDefault,
        },
      });
    });

    res.status(201).json(address);
  } catch (error: any) {
    // P2003 here means the token's userId has no matching User row -- a stale
    // session left over from a DB reseed, not a real server error.
    if (error?.code === 'P2003') {
      res.status(401).json({ error: 'Session expired, please log in again' });
      return;
    }
    console.error('Error creating address:', error);
    res.status(500).json({ error: 'Failed to create address' });
  }
};

export const updateMyAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const userId = req.user!.userId;
    const existing = await prisma.address.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }

    const { title, line1, line2, city, state, pincode, country, lat, lng, placeId, formattedAddress, isDefault } = req.body;

    const address = await prisma.$transaction(async (tx) => {
      if (isDefault === true) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.address.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(line1 !== undefined && { line1 }),
          ...(line2 !== undefined && { line2 }),
          ...(city !== undefined && { city }),
          ...(state !== undefined && { state }),
          ...(pincode !== undefined && { pincode }),
          ...(country !== undefined && { country }),
          ...(lat !== undefined && { lat }),
          ...(lng !== undefined && { lng }),
          ...(placeId !== undefined && { placeId }),
          ...(formattedAddress !== undefined && { formattedAddress }),
          ...(isDefault !== undefined && { isDefault }),
        },
      });
    });

    res.status(200).json(address);
  } catch (error) {
    console.error('Error updating address:', error);
    res.status(500).json({ error: 'Failed to update address' });
  }
};

export const deleteMyAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const userId = req.user!.userId;
    const existing = await prisma.address.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }

    const inUse = await prisma.serviceBooking.count({ where: { addressId: id } });
    if (inUse > 0) {
      res.status(400).json({ error: 'Cannot delete an address that has bookings against it.' });
      return;
    }

    await prisma.address.delete({ where: { id } });

    // If the default address was deleted, promote the most recently added
    // remaining one so there's always a sensible default when one exists.
    if (existing.isDefault) {
      const next = await prisma.address.findFirst({ where: { userId }, orderBy: { id: 'desc' } });
      if (next) {
        await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }

    res.status(200).json({ message: 'Address deleted' });
  } catch (error) {
    console.error('Error deleting address:', error);
    res.status(500).json({ error: 'Failed to delete address' });
  }
};

// ============ Self-service profile (any authenticated user) ============
// Previously the mobile Edit Profile screen never called any API at all --
// it just wrote to local Redux state, so every edit was lost on logout or
// reinstall. This is the first real self-service profile-update route;
// updateCustomer above stays admin-only (isBusinessVerified toggle).

export const getMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.status(200).json(sanitizeUser(user));
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

export const updateMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, gender, dob, avatar } = req.body;
    const userId = req.user!.userId;

    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== userId) {
        res.status(400).json({ error: 'Email already registered to another account' });
        return;
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email: email || null }),
        ...(gender !== undefined && { gender }),
        ...(dob !== undefined && { dob }),
        ...(avatar !== undefined && { avatar }),
      },
    });

    res.status(200).json(sanitizeUser(updated));
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// ============ Self-service phone number change (any authenticated user) ============
// Phone change is Firebase-only, mirroring login: the client runs Firebase
// Phone Auth against the NEW number, then PATCHes /me/phone with the resulting
// ID token as `otp`. confirmPhoneChange verifies that token (via
// verifyOtpAndResolvePhone) and updates the record. There is no backend
// send-otp step -- Firebase sends the SMS -- so the old requestPhoneChangeOtp
// endpoint (which generated a local numeric code) has been removed.
// auth.controller.ts's JWT payload is only {userId, role} (see
// middlewares/auth.ts), so an existing session's token stays valid after this
// -- no re-login required.

export const confirmPhoneChange = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { newPhone, otp } = req.body;
    if (!newPhone || !otp) {
      res.status(400).json({ error: 'New phone number and OTP are required.' });
      return;
    }

    let normalizedPhone: string;
    try {
      normalizedPhone = await verifyOtpAndResolvePhone(String(newPhone), String(otp));
    } catch (err) {
      if (err instanceof OtpVerificationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

    const existing = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
    if (existing && existing.id !== req.user!.userId) {
      res.status(400).json({ error: 'This mobile number is already registered to another account.' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { phone: normalizedPhone },
    });
    res.status(200).json(sanitizeUser(updated));
  } catch (error) {
    console.error('Error confirming phone change:', error);
    res.status(500).json({ error: 'Failed to update phone number' });
  }
};

// ============ Self-service wishlist (any authenticated user) ============
// The Wishlist model existed already (referenced only by deleteProduct's
// cleanup step) but nothing ever read or wrote it -- the mobile wishlist was
// entirely hardcoded/local. This is the first real wishlist API.

export const getMyWishlist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const items = await prisma.wishlist.findMany({
      where: { userId: req.user!.userId },
      include: { product: { include: { category: true, brand: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(items);
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
};

export const addToMyWishlist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productId } = req.body;
    if (!productId) {
      res.status(400).json({ error: 'productId is required' });
      return;
    }
    const product = await prisma.product.findUnique({ where: { id: String(productId) } });
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const item = await prisma.wishlist.upsert({
      where: { userId_productId: { userId: req.user!.userId, productId: String(productId) } },
      update: {},
      create: { userId: req.user!.userId, productId: String(productId) },
      include: { product: { include: { category: true, brand: true } } },
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
};

export const removeFromMyWishlist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const productId = String(req.params.productId);
    await prisma.wishlist.deleteMany({ where: { userId: req.user!.userId, productId } });
    res.status(200).json({ message: 'Removed from wishlist' });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
};

// ============ Self-service garage / vehicles (any authenticated user) ============
// UserVehicle existed already but nothing ever wrote to it -- the mobile
// "Garage" was AsyncStorage-only and didn't survive reinstall or a second
// device. Vehicle details are snapshotted (vehicleType/brand/model/...)
// rather than hard-linked to the Vehicle taxonomy, which is unseeded in
// production today -- same reasoning as ServiceBooking's snapshot fields.

export const getMyVehicles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vehicles = await prisma.userVehicle.findMany({
      where: { userId: req.user!.userId },
      orderBy: [{ isDefault: 'desc' }],
    });
    res.status(200).json(vehicles);
  } catch (error) {
    console.error(`[garage] GET vehicles failed (user ${req.user?.userId}):`, error);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
};

export const createMyVehicle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { vehicleType, brand, model, year, fuelType, engine, transmission, trim, registrationNumber, nickname, isDefault } = req.body;
    if (!vehicleType || !brand || !model) {
      res.status(400).json({ error: 'vehicleType, brand and model are required' });
      return;
    }
    if (!Object.values(VehicleType).includes(vehicleType)) {
      res.status(400).json({ error: `Invalid vehicleType "${vehicleType}". Must be CAR or BIKE.` });
      return;
    }

    const userId = req.user!.userId;
    const existingCount = await prisma.userVehicle.count({ where: { userId } });

    const vehicle = await prisma.$transaction(async (tx) => {
      const shouldBeDefault = existingCount === 0 || !!isDefault;
      if (shouldBeDefault) {
        await tx.userVehicle.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.userVehicle.create({
        data: {
          userId, vehicleType, brand, model,
          year: year || null, fuelType: fuelType || null,
          engine: engine || null, transmission: transmission || null, trim: trim || null,
          registrationNumber: registrationNumber || null, nickname: nickname || null,
          isDefault: shouldBeDefault,
        },
      });
    });

    res.status(201).json(vehicle);
  } catch (error) {
    console.error(`[garage] create vehicle failed (user ${req.user?.userId}, body ${JSON.stringify(req.body)}):`, error);
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
};

export const updateMyVehicle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const userId = req.user!.userId;
    const existing = await prisma.userVehicle.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    const { vehicleType, brand, model, year, fuelType, engine, transmission, trim, registrationNumber, nickname, isDefault } = req.body;
    if (vehicleType !== undefined && !Object.values(VehicleType).includes(vehicleType)) {
      res.status(400).json({ error: `Invalid vehicleType "${vehicleType}". Must be CAR or BIKE.` });
      return;
    }

    const vehicle = await prisma.$transaction(async (tx) => {
      if (isDefault === true) {
        await tx.userVehicle.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.userVehicle.update({
        where: { id },
        data: {
          ...(vehicleType !== undefined && { vehicleType }),
          ...(brand !== undefined && { brand }),
          ...(model !== undefined && { model }),
          ...(year !== undefined && { year }),
          ...(fuelType !== undefined && { fuelType }),
          ...(engine !== undefined && { engine }),
          ...(transmission !== undefined && { transmission }),
          ...(trim !== undefined && { trim }),
          ...(registrationNumber !== undefined && { registrationNumber }),
          ...(nickname !== undefined && { nickname }),
          ...(isDefault !== undefined && { isDefault }),
        },
      });
    });

    res.status(200).json(vehicle);
  } catch (error) {
    console.error(`[garage] update vehicle ${req.params.id} failed (user ${req.user?.userId}):`, error);
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
};

export const deleteMyVehicle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const userId = req.user!.userId;
    const existing = await prisma.userVehicle.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    // Block deletion only while a booking is still in flight. Finished/cancelled
    // bookings keep their vehicle details via the snapshot fields, so the link
    // can be dropped and the vehicle removed without losing history.
    const activeBookings = await prisma.serviceBooking.count({
      where: { userVehicleId: id, status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] } },
    });
    if (activeBookings > 0) {
      console.warn(`[garage] delete blocked, vehicle ${id} has ${activeBookings} active booking(s) (user ${userId})`);
      res.status(400).json({ error: 'This vehicle has an active service booking. Complete or cancel it first.' });
      return;
    }

    await prisma.$transaction([
      prisma.serviceBooking.updateMany({ where: { userVehicleId: id }, data: { userVehicleId: null } }),
      prisma.userVehicle.delete({ where: { id } }),
    ]);

    if (existing.isDefault) {
      const next = await prisma.userVehicle.findFirst({ where: { userId }, orderBy: { id: 'desc' } });
      if (next) {
        await prisma.userVehicle.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }

    res.status(200).json({ message: 'Vehicle deleted' });
  } catch (error) {
    console.error(`[garage] delete vehicle ${req.params.id} failed (user ${req.user?.userId}):`, error);
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
};
