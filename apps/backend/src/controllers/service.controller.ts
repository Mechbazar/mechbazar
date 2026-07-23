import { Request, Response } from 'express';
import { Prisma, BookingStatus, VehicleType } from '@prisma/client';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/auth';
import { sendExpoPush } from '../utils/expoPush';
import { notifyUser, notifyAdmins } from '../utils/notify';
import { sanitizeBooking, sanitizeBookings } from '../utils/sanitizeUser';
import { haversineKm, findNearestApprovedTechnician } from '../utils/geo';

// Thrown from inside createBooking's $transaction to carry an intended HTTP
// status (400/404/409) back out, mirroring order.controller.ts's OrderError.
class BookingError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const ADMIN_SERVICE_ROLES = new Set([
  'ADMIN', 'SUPER_ADMIN', 'OPERATIONS_MANAGER', 'CUSTOMER_SUPPORT', 'FINANCE_MANAGER',
]);

const generateBookingNumber = () =>
  `SB-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

// Bookings are taken for a calendar day, not a precise timestamp -- slot
// capacity is checked per (timeSlotId, day), so the time component is
// normalized away before it's ever compared or stored.
const normalizeDateOnly = (dateInput: string | Date) => {
  const d = new Date(dateInput);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Idempotent -- called both from the technician/admin COMPLETED transition
// and lazily from getBookingInvoice if a booking somehow reached COMPLETED
// without going through either path.
const generateInvoiceForBooking = async (
  tx: Prisma.TransactionClient,
  booking: { id: string; bookingNumber: string; estimatedCost: number; additionalCost: number; finalAmount: number }
) => {
  return tx.serviceInvoice.upsert({
    where: { bookingId: booking.id },
    update: {},
    create: {
      bookingId: booking.id,
      invoiceNumber: `INV-${booking.bookingNumber}`,
      subtotal: booking.estimatedCost,
      additionalCost: booking.additionalCost,
      totalAmount: booking.finalAmount,
    },
  });
};

// ============ Service categories (public read, admin write) ============

// Returns every category/package regardless of status/isActive -- mirrors
// category.controller.ts's getCategories, which never filters server-side
// either. Filtering here would mean a disabled category could never be found
// again by the admin panel to re-enable it. Clients that only want visible
// rows (the mobile app) filter client-side, same as product.service.ts's
// fetchCategories already does.
export const getServiceCategories = async (req: Request, res: Response) => {
  try {
    const { vehicleType } = req.query;
    const categories = await prisma.serviceCategory.findMany({
      where: {
        ...(vehicleType ? { vehicleType: vehicleType as VehicleType } : {}),
      },
      include: { packages: true, _count: { select: { packages: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.status(200).json(categories);
  } catch (error) {
    console.error('Error fetching service categories:', error);
    res.status(500).json({ error: 'Failed to fetch service categories' });
  }
};

export const getServiceCategoryById = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const category = await prisma.serviceCategory.findUnique({
      where: { id },
      include: { packages: { where: { isActive: true } } },
    });
    if (!category) return res.status(404).json({ error: 'Service category not found' });
    res.status(200).json(category);
  } catch (error) {
    console.error('Error fetching service category:', error);
    res.status(500).json({ error: 'Failed to fetch service category' });
  }
};

export const createServiceCategory = async (req: Request, res: Response) => {
  try {
    const { name, icon, image, description, vehicleType, isEmergency, sortOrder } = req.body;
    if (!name || !vehicleType) {
      return res.status(400).json({ error: 'name and vehicleType are required' });
    }
    const category = await prisma.serviceCategory.create({
      data: { name, icon, image, description, vehicleType, isEmergency: !!isEmergency, sortOrder: sortOrder ?? 0 },
    });
    res.status(201).json(category);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const target = error?.meta?.target;
      return res.status(400).json({ error: `Duplicate value for ${Array.isArray(target) ? target.join(', ') : 'unique field'}` });
    }
    console.error('Error creating service category:', error);
    res.status(500).json({ error: 'Failed to create service category' });
  }
};

export const updateServiceCategory = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { name, icon, image, description, vehicleType, isEmergency, status, sortOrder } = req.body;
    const category = await prisma.serviceCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(icon !== undefined && { icon }),
        ...(image !== undefined && { image }),
        ...(description !== undefined && { description }),
        ...(vehicleType !== undefined && { vehicleType }),
        ...(isEmergency !== undefined && { isEmergency }),
        ...(status !== undefined && { status }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });
    res.status(200).json(category);
  } catch (error: any) {
    if (error?.code === 'P2025') return res.status(404).json({ error: 'Service category not found' });
    if (error?.code === 'P2002') {
      const target = error?.meta?.target;
      return res.status(400).json({ error: `Duplicate value for ${Array.isArray(target) ? target.join(', ') : 'unique field'}` });
    }
    console.error('Error updating service category:', error);
    res.status(500).json({ error: 'Failed to update service category' });
  }
};

export const deleteServiceCategory = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const packageCount = await prisma.servicePackage.count({ where: { categoryId: id } });
    if (packageCount > 0) {
      return res.status(400).json({ error: 'Cannot delete a category that still has packages. Remove its packages first.' });
    }
    await prisma.serviceCategory.delete({ where: { id } });
    res.status(200).json({ message: 'Service category deleted' });
  } catch (error: any) {
    if (error?.code === 'P2025') return res.status(404).json({ error: 'Service category not found' });
    console.error('Error deleting service category:', error);
    res.status(500).json({ error: 'Failed to delete service category' });
  }
};

// ============ Service packages (public read, admin write) ============

// No isActive filter server-side, same rationale as getServiceCategories above.
export const getServicePackages = async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.query;
    const packages = await prisma.servicePackage.findMany({
      where: { ...(categoryId ? { categoryId: String(categoryId) } : {}) },
      include: { category: true },
      orderBy: { price: 'asc' },
    });
    res.status(200).json(packages);
  } catch (error) {
    console.error('Error fetching service packages:', error);
    res.status(500).json({ error: 'Failed to fetch service packages' });
  }
};

export const getServicePackageById = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const pkg = await prisma.servicePackage.findUnique({ where: { id }, include: { category: true } });
    if (!pkg) return res.status(404).json({ error: 'Service package not found' });
    res.status(200).json(pkg);
  } catch (error) {
    console.error('Error fetching service package:', error);
    res.status(500).json({ error: 'Failed to fetch service package' });
  }
};

export const createServicePackage = async (req: Request, res: Response) => {
  try {
    const {
      categoryId, name, description, image, price, discountPrice, estimatedMinutes, includedServices,
      isActive, isPopular, isRecommended, isEmergency,
    } = req.body;
    if (!categoryId || !name || price === undefined) {
      return res.status(400).json({ error: 'categoryId, name and price are required' });
    }
    const category = await prisma.serviceCategory.findUnique({ where: { id: categoryId } });
    if (!category) return res.status(404).json({ error: 'Service category not found' });

    const pkg = await prisma.servicePackage.create({
      data: {
        categoryId,
        name,
        description,
        image: image || null,
        price: Number(price),
        discountPrice: discountPrice !== undefined && discountPrice !== null ? Number(discountPrice) : null,
        estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : 60,
        includedServices: Array.isArray(includedServices) ? includedServices : [],
        isActive: isActive !== undefined ? !!isActive : true,
        isPopular: !!isPopular,
        isRecommended: !!isRecommended,
        isEmergency: !!isEmergency,
      },
    });
    res.status(201).json(pkg);
  } catch (error) {
    console.error('Error creating service package:', error);
    res.status(500).json({ error: 'Failed to create service package' });
  }
};

export const updateServicePackage = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const {
      name, description, image, price, discountPrice, estimatedMinutes, includedServices,
      isActive, isPopular, isRecommended, isEmergency,
    } = req.body;
    const pkg = await prisma.servicePackage.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(image !== undefined && { image: image || null }),
        ...(price !== undefined && { price: Number(price) }),
        ...(discountPrice !== undefined && { discountPrice: discountPrice === null ? null : Number(discountPrice) }),
        ...(estimatedMinutes !== undefined && { estimatedMinutes: Number(estimatedMinutes) }),
        ...(includedServices !== undefined && { includedServices }),
        ...(isActive !== undefined && { isActive }),
        ...(isPopular !== undefined && { isPopular: !!isPopular }),
        ...(isRecommended !== undefined && { isRecommended: !!isRecommended }),
        ...(isEmergency !== undefined && { isEmergency: !!isEmergency }),
      },
    });
    res.status(200).json(pkg);
  } catch (error: any) {
    if (error?.code === 'P2025') return res.status(404).json({ error: 'Service package not found' });
    console.error('Error updating service package:', error);
    res.status(500).json({ error: 'Failed to update service package' });
  }
};

export const deleteServicePackage = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const bookingCount = await prisma.serviceBooking.count({ where: { packageId: id } });
    if (bookingCount > 0) {
      return res.status(400).json({ error: 'Cannot delete a package with existing bookings. Disable it instead.' });
    }
    await prisma.servicePackage.delete({ where: { id } });
    res.status(200).json({ message: 'Service package deleted' });
  } catch (error: any) {
    if (error?.code === 'P2025') return res.status(404).json({ error: 'Service package not found' });
    console.error('Error deleting service package:', error);
    res.status(500).json({ error: 'Failed to delete service package' });
  }
};

// ============ Time slots (public read, admin write) ============

// No isActive filter server-side, same rationale as getServiceCategories above
// -- the admin Time Slots page needs to see and re-enable disabled slots too.
export const getTimeSlots = async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    const slots = await prisma.timeSlot.findMany({ orderBy: { sortOrder: 'asc' } });
    if (!date) {
      return res.status(200).json(slots.map((s) => ({ ...s, bookedCount: 0, available: true })));
    }
    const normalizedDate = normalizeDateOnly(String(date));
    const counts = await prisma.serviceBooking.groupBy({
      by: ['timeSlotId'],
      where: { scheduledDate: normalizedDate, status: { not: 'CANCELLED' } },
      _count: { _all: true },
    });
    const countMap = new Map(counts.map((c) => [c.timeSlotId, c._count._all]));
    res.status(200).json(
      slots.map((s) => {
        const bookedCount = countMap.get(s.id) || 0;
        return { ...s, bookedCount, available: bookedCount < s.maxBookingsPerSlot };
      })
    );
  } catch (error) {
    console.error('Error fetching time slots:', error);
    res.status(500).json({ error: 'Failed to fetch time slots' });
  }
};

export const createTimeSlot = async (req: Request, res: Response) => {
  try {
    const { label, startTime, endTime, maxBookingsPerSlot, sortOrder } = req.body;
    if (!label || !startTime || !endTime) {
      return res.status(400).json({ error: 'label, startTime and endTime are required' });
    }
    const slot = await prisma.timeSlot.create({
      data: {
        label,
        startTime,
        endTime,
        maxBookingsPerSlot: maxBookingsPerSlot ? Number(maxBookingsPerSlot) : 20,
        sortOrder: sortOrder ?? 0,
      },
    });
    res.status(201).json(slot);
  } catch (error) {
    console.error('Error creating time slot:', error);
    res.status(500).json({ error: 'Failed to create time slot' });
  }
};

export const updateTimeSlot = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { label, startTime, endTime, maxBookingsPerSlot, isActive, sortOrder } = req.body;
    const slot = await prisma.timeSlot.update({
      where: { id },
      data: {
        ...(label !== undefined && { label }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(maxBookingsPerSlot !== undefined && { maxBookingsPerSlot: Number(maxBookingsPerSlot) }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });
    res.status(200).json(slot);
  } catch (error: any) {
    if (error?.code === 'P2025') return res.status(404).json({ error: 'Time slot not found' });
    console.error('Error updating time slot:', error);
    res.status(500).json({ error: 'Failed to update time slot' });
  }
};

export const deleteTimeSlot = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await prisma.timeSlot.delete({ where: { id } });
    res.status(200).json({ message: 'Time slot deleted' });
  } catch (error: any) {
    if (error?.code === 'P2025') return res.status(404).json({ error: 'Time slot not found' });
    console.error('Error deleting time slot:', error);
    res.status(500).json({ error: 'Failed to delete time slot' });
  }
};

// ============ Bookings (customer) ============

export const createBooking = async (req: AuthRequest, res: Response) => {
  try {
    const {
      userVehicleId, vehicleType, vehicleBrand, vehicleModel, vehicleFuelType, vehicleRegistrationNumber,
      categoryId, packageId, addressId, scheduledDate, timeSlotId, issueDescription, payment_method,
    } = req.body;

    if (!vehicleType || !vehicleBrand || !vehicleModel) {
      return res.status(400).json({ error: 'vehicleType, vehicleBrand and vehicleModel are required' });
    }
    if (!categoryId || !packageId || !addressId || !scheduledDate || !timeSlotId) {
      return res.status(400).json({ error: 'categoryId, packageId, addressId, scheduledDate and timeSlotId are required' });
    }

    const userId = req.user!.userId;

    const booking = await prisma.$transaction(async (tx) => {
      const address = await tx.address.findFirst({ where: { id: addressId, userId } });
      if (!address) throw new BookingError(404, 'Address not found');

      if (userVehicleId) {
        const ownedVehicle = await tx.userVehicle.findFirst({ where: { id: userVehicleId, userId } });
        if (!ownedVehicle) throw new BookingError(404, 'Vehicle not found in your garage');
      }

      const category = await tx.serviceCategory.findUnique({ where: { id: categoryId } });
      if (!category || category.status !== 'Active') throw new BookingError(404, 'Service category not found');
      if (category.vehicleType !== vehicleType) {
        throw new BookingError(400, 'This service category does not apply to the selected vehicle type');
      }

      const pkg = await tx.servicePackage.findUnique({ where: { id: packageId } });
      if (!pkg || !pkg.isActive || pkg.categoryId !== categoryId) throw new BookingError(404, 'Service package not found');

      const timeSlot = await tx.timeSlot.findUnique({ where: { id: timeSlotId } });
      if (!timeSlot || !timeSlot.isActive) throw new BookingError(404, 'Time slot not found');

      const normalizedDate = normalizeDateOnly(scheduledDate);
      const slotBookingCount = await tx.serviceBooking.count({
        where: { timeSlotId, scheduledDate: normalizedDate, status: { not: 'CANCELLED' } },
      });
      if (slotBookingCount >= timeSlot.maxBookingsPerSlot) {
        throw new BookingError(409, 'Selected time slot is fully booked. Please choose another slot.');
      }

      const estimatedCost = pkg.discountPrice ?? pkg.price;

      // No real payment gateway exists yet to gate CONFIRMED on, so the
      // PENDING -> CONFIRMED transition happens synchronously here (its own
      // history row, for the audit trail and as a hook for real payment
      // confirmation later) before attempting auto-assignment.
      const technician = await findNearestApprovedTechnician(tx, vehicleType as VehicleType, address.lat, address.lng);
      const status: BookingStatus = technician ? 'MECHANIC_ASSIGNED' : 'CONFIRMED';

      const newBooking = await tx.serviceBooking.create({
        data: {
          bookingNumber: generateBookingNumber(),
          userId,
          userVehicleId: userVehicleId || null,
          vehicleType,
          vehicleBrand,
          vehicleModel,
          vehicleFuelType: vehicleFuelType || null,
          vehicleRegistrationNumber: vehicleRegistrationNumber || null,
          categoryId,
          packageId,
          technicianId: technician?.id,
          addressId,
          scheduledDate: normalizedDate,
          timeSlotId,
          issueDescription: issueDescription || null,
          status,
          estimatedCost,
          finalAmount: estimatedCost,
          payment: {
            create: {
              method: payment_method === 'online' ? 'ONLINE' : 'COD',
              status: 'PENDING',
              amount: estimatedCost,
            },
          },
          statusHistory: {
            create: [
              { status: 'PENDING', changedByUserId: userId },
              { status: 'CONFIRMED', changedByUserId: userId },
              ...(status === 'MECHANIC_ASSIGNED' ? [{ status: 'MECHANIC_ASSIGNED' as BookingStatus, changedByUserId: userId }] : []),
            ],
          },
        },
        include: { payment: true, technician: true, category: true, package: true, address: true },
      });

      return newBooking;
    });

    console.log(`[booking] created booking=${booking.bookingNumber} user=${userId} status=${booking.status} technician=${booking.technicianId || 'none'}`);

    // One combined push for the (same-request, instant) PENDING->CONFIRMED
    // transition rather than two back-to-back notifications for what a
    // customer would perceive as the same moment.
    notifyUser(userId, 'Booking confirmed', `Your service booking #${booking.bookingNumber} has been confirmed.`, { bookingId: booking.id });
    notifyAdmins(
      'New service booking',
      booking.technicianId
        ? `Booking #${booking.bookingNumber} was created and auto-assigned.`
        : `Booking #${booking.bookingNumber} needs a mechanic assigned.`,
      { bookingId: booking.id }
    );
    if (booking.technicianId && booking.technician) {
      notifyUser(userId, 'Mechanic assigned', `A technician has been assigned to your booking #${booking.bookingNumber}.`, { bookingId: booking.id });
      notifyUser(booking.technician.userId, 'New service job assigned', `Booking #${booking.bookingNumber} is ready for you.`, { bookingId: booking.id });
      if (booking.technician.expoPushToken) {
        sendExpoPush(
          booking.technician.expoPushToken,
          'New service job assigned',
          `Booking #${booking.bookingNumber} is ready for you.`,
          { bookingId: booking.id }
        );
      }
    }

    res.status(201).json({ message: 'Booking placed successfully', booking });
  } catch (error: any) {
    if (error instanceof BookingError) {
      console.warn(`[booking] rejected ${error.status} (user ${req.user?.userId}): ${error.message}`);
      return res.status(error.status).json({ error: error.message });
    }
    console.error(`[booking] create failed (user ${req.user?.userId}, body ${JSON.stringify(req.body)}):`, error);
    res.status(500).json({ error: 'Failed to create booking. Please try again.' });
  }
};

export const getMyBookings = async (req: AuthRequest, res: Response) => {
  try {
    const bookings = await prisma.serviceBooking.findMany({
      where: { userId: req.user!.userId },
      include: {
        category: true, package: true, address: true, payment: true, timeSlot: true,
        technician: { include: { user: true } }, review: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(sanitizeBookings(bookings));
  } catch (error: any) {
    console.error('Error fetching bookings:', error.message);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
};

export const getBookingById = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const booking = await prisma.serviceBooking.findUnique({
      where: { id },
      include: {
        category: true, package: true, address: true, payment: true, timeSlot: true,
        technician: { include: { user: true } }, user: true,
        // Metadata only -- fileData is megabytes of raw bytes per photo and this
        // endpoint is polled every 10s by the tracking screen. Actual bytes are
        // served on demand via GET /bookings/images/:imageId/file.
        images: { select: { id: true, bookingId: true, type: true, uploadedByRole: true, mimeType: true, createdAt: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } }, review: true, invoice: true,
      },
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const { userId, role } = req.user!;
    const isOwner = booking.userId === userId;
    const isAdmin = ADMIN_SERVICE_ROLES.has(role);
    const isAssignedTechnician = role === 'SERVICE_TECHNICIAN' && booking.technician?.userId === userId;

    if (!isOwner && !isAdmin && !isAssignedTechnician) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const sanitized = sanitizeBooking(booking);
    // The completion OTP is read aloud by the customer to the technician --
    // it must never be readable from the technician's own API response.
    if (role === 'SERVICE_TECHNICIAN') {
      res.status(200).json({ ...sanitized, completionOtp: undefined, completionOtpGeneratedAt: undefined });
      return;
    }
    res.status(200).json(sanitized);
  } catch (error: any) {
    console.error('Error fetching booking:', error.message);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
};

// REJECTED included so a customer isn't stuck waiting indefinitely for an
// admin to manually reassign a booking whose technician rejected it with no
// automatic replacement found -- they can now cancel and rebook themselves.
const CANCELLABLE_STATUSES = new Set(['PENDING', 'CONFIRMED', 'MECHANIC_ASSIGNED', 'MECHANIC_ACCEPTED', 'REJECTED']);

export const cancelBooking = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { cancelReason } = req.body || {};
    const booking = await prisma.serviceBooking.findFirst({ where: { id, userId: req.user!.userId }, include: { technician: true } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (!CANCELLABLE_STATUSES.has(booking.status)) {
      return res.status(400).json({ error: 'This booking can no longer be cancelled -- the technician has already started work.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.serviceBooking.update({
        where: { id },
        data: { status: 'CANCELLED', cancelReason: cancelReason || null },
      });
      await tx.bookingStatusHistory.create({
        data: { bookingId: id, status: 'CANCELLED', note: cancelReason || null, changedByUserId: req.user!.userId },
      });
      return b;
    });

    console.log(`[booking] cancelled booking=${booking.bookingNumber} by=customer:${req.user!.userId}`);
    notifyUser(booking.userId, 'Booking cancelled', `Your service booking #${booking.bookingNumber} has been cancelled.`, { bookingId: id });
    if (booking.technician?.expoPushToken) {
      sendExpoPush(booking.technician.expoPushToken, 'Booking cancelled', `Booking #${booking.bookingNumber} was cancelled by the customer.`, { bookingId: id });
    }
    if (booking.technician) {
      notifyUser(booking.technician.userId, 'Booking cancelled', `Booking #${booking.bookingNumber} was cancelled by the customer.`, { bookingId: id });
    }

    res.status(200).json(updated);
  } catch (error: any) {
    console.error('Error cancelling booking:', error.message);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
};

// ============ Bookings (technician-driven status) ============
// Exported here (not technician.controller.ts) and wired into
// technician.routes.ts, mirroring how order.controller.ts's
// updateMyDeliveryStatus is imported into rider.routes.ts.

// Deliberately no MECHANIC_ASSIGNED entry -- that transition only happens via
// acceptBookingJob/rejectBookingJob below, not this generic flow map.
const TECHNICIAN_STATUS_FLOW: Record<string, string[]> = {
  MECHANIC_ACCEPTED: ['MECHANIC_ON_THE_WAY'],
  MECHANIC_ON_THE_WAY: ['ARRIVED'],
  ARRIVED: ['WORK_STARTED'],
  WORK_STARTED: ['COMPLETED'],
};

const STATUS_NOTIFICATION_COPY: Partial<Record<string, string>> = {
  MECHANIC_ON_THE_WAY: 'Your mechanic has started their journey to you.',
  ARRIVED: 'Your mechanic has arrived at your location.',
  WORK_STARTED: 'Work has started on your vehicle.',
  COMPLETED: 'Your service has been completed.',
};

export const updateMyBookingStatus = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status, otp } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });

    const technician = await prisma.serviceTechnician.findUnique({ where: { userId: req.user!.userId } });
    if (!technician) return res.status(404).json({ error: 'Technician profile not found' });

    const booking = await prisma.serviceBooking.findFirst({ where: { id, technicianId: technician.id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found or not assigned to you' });

    const allowedNext = TECHNICIAN_STATUS_FLOW[booking.status];
    if (!allowedNext || !allowedNext.includes(status)) {
      return res.status(400).json({ error: `Cannot move from ${booking.status} to ${status}` });
    }

    if (status === 'COMPLETED') {
      if (!booking.completionOtp) {
        return res.status(400).json({ error: 'Generate an OTP and have the customer read it to you before marking this job completed.' });
      }
      if (!otp || String(otp) !== booking.completionOtp) {
        return res.status(400).json({ error: 'Incorrect OTP' });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Atomically claim the transition: only matches if the booking's status
      // is still what we just read, re-checked under Postgres's row lock at
      // UPDATE time -- not against the stale `booking.status` read above.
      // Without this, a retried/duplicated request (e.g. a mobile network
      // retry resubmitting the same OTP) could pass the allowedNext/OTP checks
      // twice concurrently and credit the technician's wallet + totalJobs
      // twice for the same job.
      const claim = await tx.serviceBooking.updateMany({
        where: { id, status: booking.status },
        data: {
          status,
          ...(status === 'COMPLETED' && { completedAt: new Date(), completionOtp: null, completionOtpGeneratedAt: null }),
        },
      });
      if (claim.count === 0) {
        throw new Error('Booking status changed concurrently by another request. Please retry.');
      }
      const b = await tx.serviceBooking.findUniqueOrThrow({ where: { id } });
      await tx.bookingStatusHistory.create({
        data: { bookingId: id, status, changedByUserId: req.user!.userId },
      });

      if (status === 'COMPLETED') {
        await tx.serviceTechnician.update({
          where: { id: technician.id },
          data: { walletBalance: { increment: b.finalAmount }, totalJobs: { increment: 1 } },
        });
        await generateInvoiceForBooking(tx, b);
      }

      return b;
    });

    console.log(`[booking] status_change booking=${booking.bookingNumber} ${booking.status}->${status} by=technician:${req.user!.userId}`);

    notifyUser(
      booking.userId,
      'Service update',
      STATUS_NOTIFICATION_COPY[status] || `Your booking #${booking.bookingNumber} is now ${status}.`,
      { bookingId: id, status }
    );
    if (status === 'COMPLETED') {
      notifyUser(booking.userId, 'Invoice generated', `Your invoice for booking #${booking.bookingNumber} is ready.`, { bookingId: id });
    }

    res.status(200).json(updated);
  } catch (error: any) {
    if (error.message?.startsWith('Booking status changed concurrently')) {
      return res.status(409).json({ error: error.message });
    }
    console.error('Error updating booking status:', error.message);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
};

// ============ Bookings (technician accept/reject/OTP) ============

export const acceptBookingJob = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const technician = await prisma.serviceTechnician.findUnique({ where: { userId: req.user!.userId } });
    if (!technician) return res.status(404).json({ error: 'Technician profile not found' });

    const booking = await prisma.serviceBooking.findFirst({ where: { id, technicianId: technician.id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found or not assigned to you' });
    if (booking.status !== 'MECHANIC_ASSIGNED') {
      return res.status(400).json({ error: `Cannot accept a booking that is currently ${booking.status}` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.serviceBooking.update({ where: { id }, data: { status: 'MECHANIC_ACCEPTED' } });
      await tx.bookingStatusHistory.create({
        data: { bookingId: id, status: 'MECHANIC_ACCEPTED', changedByUserId: req.user!.userId },
      });
      return b;
    });

    console.log(`[booking] accepted booking=${booking.bookingNumber} technician=${technician.id}`);
    notifyUser(booking.userId, 'Mechanic accepted', `Your mechanic has accepted booking #${booking.bookingNumber}.`, { bookingId: id });

    res.status(200).json(updated);
  } catch (error: any) {
    console.error('Error accepting booking:', error.message);
    res.status(500).json({ error: 'Failed to accept booking' });
  }
};

export const rejectBookingJob = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { reason } = req.body;
    const technician = await prisma.serviceTechnician.findUnique({ where: { userId: req.user!.userId } });
    if (!technician) return res.status(404).json({ error: 'Technician profile not found' });

    const booking = await prisma.serviceBooking.findFirst({ where: { id, technicianId: technician.id }, include: { address: true } });
    if (!booking) return res.status(404).json({ error: 'Booking not found or not assigned to you' });
    if (booking.status !== 'MECHANIC_ASSIGNED') {
      return res.status(400).json({ error: `Cannot reject a booking that is currently ${booking.status}` });
    }

    const { updated, reassignedTechnicianId } = await prisma.$transaction(async (tx) => {
      await tx.serviceBooking.update({ where: { id }, data: { status: 'REJECTED', technicianId: null } });
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          status: 'REJECTED',
          note: reason ? `Rejected by ${technician.id}: ${reason}` : `Rejected by ${technician.id}`,
          changedByUserId: req.user!.userId,
        },
      });

      const replacement = await findNearestApprovedTechnician(
        tx, booking.vehicleType, booking.address.lat, booking.address.lng, technician.id
      );

      if (!replacement) {
        const stillRejected = await tx.serviceBooking.findUniqueOrThrow({ where: { id } });
        return { updated: stillRejected, reassignedTechnicianId: null as string | null };
      }

      const reassigned = await tx.serviceBooking.update({
        where: { id },
        data: { technicianId: replacement.id, status: 'MECHANIC_ASSIGNED' },
        include: { technician: true },
      });
      await tx.bookingStatusHistory.create({
        data: { bookingId: id, status: 'MECHANIC_ASSIGNED', note: 'Auto-reassigned after rejection', changedByUserId: req.user!.userId },
      });
      return { updated: reassigned, reassignedTechnicianId: replacement.id };
    });

    if (reassignedTechnicianId) {
      const reassignedTech = await prisma.serviceTechnician.findUnique({ where: { id: reassignedTechnicianId } });
      if (reassignedTech) {
        notifyUser(reassignedTech.userId, 'New service job assigned', `Booking #${booking.bookingNumber} is ready for you.`, { bookingId: id });
        if (reassignedTech.expoPushToken) {
          sendExpoPush(reassignedTech.expoPushToken, 'New service job assigned', `Booking #${booking.bookingNumber} is ready for you.`, { bookingId: id });
        }
      }
      notifyUser(booking.userId, 'Mechanic assigned', `A new technician has been assigned to your booking #${booking.bookingNumber}.`, { bookingId: id });
    } else {
      notifyUser(booking.userId, 'Finding a new mechanic', `Your mechanic for booking #${booking.bookingNumber} became unavailable. We're finding a replacement.`, { bookingId: id });
      notifyAdmins('Booking needs reassignment', `Booking #${booking.bookingNumber} was rejected and has no available replacement technician.`, { bookingId: id });
    }

    console.log(`[booking] rejected booking=${booking.bookingNumber} technician=${technician.id} reassigned=${reassignedTechnicianId || 'none'}`);

    res.status(200).json(updated);
  } catch (error: any) {
    console.error('Error rejecting booking:', error.message);
    res.status(500).json({ error: 'Failed to reject booking' });
  }
};

export const generateBookingCompletionOtp = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const technician = await prisma.serviceTechnician.findUnique({ where: { userId: req.user!.userId } });
    if (!technician) return res.status(404).json({ error: 'Technician profile not found' });

    const booking = await prisma.serviceBooking.findFirst({ where: { id, technicianId: technician.id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found or not assigned to you' });
    if (booking.status !== 'WORK_STARTED') {
      return res.status(400).json({ error: 'OTP can only be generated once work has started' });
    }

    const otp = String(Math.floor(1000 + Math.random() * 9000));
    await prisma.serviceBooking.update({
      where: { id },
      data: { completionOtp: otp, completionOtpGeneratedAt: new Date() },
    });

    // Deliberately never echoed back to the technician's own response -- the
    // customer must read it aloud for the technician to enter. The OTP itself
    // must not go in the push title/body either: those render on the lock
    // screen by default, which would defeat the point of requiring the
    // customer to read it aloud. Keep it in the data payload only, where it's
    // reachable by the app in the foreground but not shown in a notification
    // preview.
    notifyUser(booking.userId, 'Completion code ready', 'Open the app to view your mechanic completion code.', { bookingId: id, completionOtp: otp });

    res.status(200).json({ message: 'OTP sent to the customer' });
  } catch (error: any) {
    console.error('Error generating completion OTP:', error.message);
    res.status(500).json({ error: 'Failed to generate OTP' });
  }
};

export const createBookingApprovalRequest = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { additionalCost, approvalNote } = req.body;
    if (!additionalCost || isNaN(additionalCost) || Number(additionalCost) <= 0) {
      return res.status(400).json({ error: 'A positive additionalCost is required' });
    }
    if (!approvalNote) {
      return res.status(400).json({ error: 'approvalNote describing the additional work is required' });
    }

    const technician = await prisma.serviceTechnician.findUnique({ where: { userId: req.user!.userId } });
    if (!technician) return res.status(404).json({ error: 'Technician profile not found' });

    const booking = await prisma.serviceBooking.findFirst({ where: { id, technicianId: technician.id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found or not assigned to you' });

    if (booking.status !== 'WORK_STARTED') {
      return res.status(400).json({ error: 'Approval can only be requested while work is in progress' });
    }
    if (booking.approvalStatus === 'PENDING') {
      return res.status(400).json({ error: 'An approval request is already pending for this booking' });
    }

    // approvalStatus is a non-blocking flag layered on top of WORK_STARTED --
    // the booking's top-level status doesn't change while approval is pending.
    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.serviceBooking.update({
        where: { id },
        data: {
          additionalCost: Number(additionalCost),
          approvalStatus: 'PENDING',
          approvalNote,
        },
      });
      await tx.bookingStatusHistory.create({
        data: { bookingId: id, status: 'WORK_STARTED', note: `Approval requested: ${approvalNote}`, changedByUserId: req.user!.userId },
      });
      return b;
    });

    notifyUser(
      booking.userId,
      'Approval required',
      `Your mechanic found additional work needed (+₹${additionalCost}). Please review and approve.`,
      { bookingId: id }
    );

    res.status(200).json(updated);
  } catch (error: any) {
    console.error('Error requesting approval:', error.message);
    res.status(500).json({ error: 'Failed to request approval' });
  }
};

// ============ Bookings (customer approval response) ============

export const respondToApproval = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { approve } = req.body;
    if (typeof approve !== 'boolean') return res.status(400).json({ error: 'approve (boolean) is required' });

    const booking = await prisma.serviceBooking.findFirst({ where: { id, userId: req.user!.userId } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.approvalStatus !== 'PENDING') {
      return res.status(400).json({ error: 'This booking is not currently awaiting approval' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.serviceBooking.update({
        where: { id },
        data: {
          approvalStatus: approve ? 'APPROVED' : 'REJECTED',
          ...(approve
            ? { finalAmount: booking.estimatedCost + booking.additionalCost }
            : { additionalCost: 0, finalAmount: booking.estimatedCost }),
        },
      });
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          status: 'WORK_STARTED',
          note: approve ? 'Additional work approved by customer' : 'Additional work rejected by customer',
          changedByUserId: req.user!.userId,
        },
      });

      const payment = await tx.payment.findUnique({ where: { serviceBookingId: id } });
      if (payment) {
        await tx.payment.update({ where: { id: payment.id }, data: { amount: b.finalAmount } });
      }

      return b;
    });

    notifyUser(
      booking.userId,
      approve ? 'Additional work approved' : 'Additional work rejected',
      approve
        ? `You approved the additional work for booking #${booking.bookingNumber}.`
        : `You rejected the additional work for booking #${booking.bookingNumber}. Original service will continue.`,
      { bookingId: id }
    );

    res.status(200).json(updated);
  } catch (error: any) {
    console.error('Error responding to approval:', error.message);
    res.status(500).json({ error: 'Failed to respond to approval' });
  }
};

// ============ Booking images ============

export const uploadBookingImage = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { type } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const booking = await prisma.serviceBooking.findUnique({ where: { id }, include: { technician: true } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const { userId, role } = req.user!;
    const isOwner = booking.userId === userId;
    const isAssignedTechnician = role === 'SERVICE_TECHNICIAN' && booking.technician?.userId === userId;
    if (!isOwner && !isAssignedTechnician) return res.status(403).json({ error: 'Forbidden' });

    const image = await prisma.serviceImage.create({
      data: {
        bookingId: id,
        fileData: req.file.buffer,
        mimeType: req.file.mimetype,
        type: type || (isAssignedTechnician ? 'BEFORE' : 'ISSUE'),
        uploadedByRole: isAssignedTechnician ? 'TECHNICIAN' : 'CUSTOMER',
      },
    });

    res.status(201).json({ ...image, fileData: undefined });
  } catch (error: any) {
    console.error('Error uploading booking image:', error.message);
    res.status(500).json({ error: 'Failed to upload image' });
  }
};

export const getBookingImageFile = async (req: AuthRequest, res: Response) => {
  try {
    const imageId = String(req.params.imageId);
    const image = await prisma.serviceImage.findUnique({
      where: { id: imageId },
      include: { booking: { include: { technician: true } } },
    });
    if (!image) return res.status(404).json({ error: 'Image not found' });

    const { userId, role } = req.user!;
    const isAdmin = ADMIN_SERVICE_ROLES.has(role);
    const isOwner = image.booking.userId === userId;
    const isAssignedTechnician = role === 'SERVICE_TECHNICIAN' && image.booking.technician?.userId === userId;
    if (!isAdmin && !isOwner && !isAssignedTechnician) return res.status(403).json({ error: 'Forbidden' });

    if (!image.fileData) return res.status(404).json({ error: 'File not found' });
    res.setHeader('Content-Type', image.mimeType || 'application/octet-stream');
    res.send(image.fileData);
  } catch (error: any) {
    console.error('Error fetching booking image:', error.message);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
};

// ============ Chat ============
// Polling-based (mirrors the app's existing "no realtime infra" pattern, see
// DeliveryTrackingScreen's 10s poll) -- no socket layer exists yet. Customer
// side lands here in Phase 2; the technician side reads/sends through the
// same endpoints once Phase 4's mechanic app exists.

const getBookingForChatAccess = async (id: string, userId: string, role: string) => {
  const booking = await prisma.serviceBooking.findUnique({ where: { id }, include: { technician: true } });
  if (!booking) return null;
  const isAdmin = ADMIN_SERVICE_ROLES.has(role);
  const isOwner = booking.userId === userId;
  const isAssignedTechnician = role === 'SERVICE_TECHNICIAN' && booking.technician?.userId === userId;
  if (!isAdmin && !isOwner && !isAssignedTechnician) return null;
  return { booking, isOwner, isAssignedTechnician };
};

export const sendBookingMessage = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    const { userId, role } = req.user!;
    const access = await getBookingForChatAccess(id, userId, role);
    if (!access) return res.status(404).json({ error: 'Booking not found' });
    if (!access.isOwner && !access.isAssignedTechnician) {
      return res.status(403).json({ error: 'Only the customer or assigned technician can send messages' });
    }

    const created = await prisma.serviceChatMessage.create({
      data: {
        bookingId: id,
        senderUserId: userId,
        senderRole: access.isAssignedTechnician ? 'TECHNICIAN' : 'CUSTOMER',
        message: message.trim(),
      },
    });

    const recipientId = access.isAssignedTechnician ? access.booking.userId : access.booking.technician?.userId;
    if (recipientId) {
      notifyUser(recipientId, 'New message', message.trim().slice(0, 120), { bookingId: id, type: 'CHAT' });
    }

    res.status(201).json(created);
  } catch (error: any) {
    console.error('Error sending booking message:', error.message);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

export const getBookingMessages = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { userId, role } = req.user!;
    const access = await getBookingForChatAccess(id, userId, role);
    if (!access) return res.status(404).json({ error: 'Booking not found' });

    const messages = await prisma.serviceChatMessage.findMany({
      where: { bookingId: id },
      orderBy: { createdAt: 'asc' },
    });
    res.status(200).json(messages);
  } catch (error: any) {
    console.error('Error fetching booking messages:', error.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// ============ Invoice ============

export const getBookingInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const booking = await prisma.serviceBooking.findUnique({ where: { id }, include: { technician: true, invoice: true } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const { userId, role } = req.user!;
    const isAdmin = ADMIN_SERVICE_ROLES.has(role);
    const isOwner = booking.userId === userId;
    const isAssignedTechnician = role === 'SERVICE_TECHNICIAN' && booking.technician?.userId === userId;
    if (!isAdmin && !isOwner && !isAssignedTechnician) return res.status(404).json({ error: 'Booking not found' });

    let invoice = booking.invoice;
    if (!invoice) {
      invoice = await prisma.$transaction((tx) => generateInvoiceForBooking(tx, booking));
      notifyUser(booking.userId, 'Invoice generated', `Your invoice for booking #${booking.bookingNumber} is ready.`, { bookingId: id });
    }

    res.status(200).json(invoice);
  } catch (error: any) {
    console.error('Error fetching booking invoice:', error.message);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
};

// ============ Review ============

export const createBookingReview = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { rating, comment } = req.body;
    if (!rating || isNaN(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating (1-5) is required' });
    }

    const booking = await prisma.serviceBooking.findFirst({ where: { id, userId: req.user!.userId } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status !== 'COMPLETED') return res.status(400).json({ error: 'You can only review a completed service' });
    if (!booking.technicianId) return res.status(400).json({ error: 'No technician was assigned to this booking' });

    const existing = await prisma.serviceReview.findUnique({ where: { bookingId: id } });
    if (existing) return res.status(400).json({ error: 'This booking has already been reviewed' });

    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.serviceReview.create({
        data: {
          bookingId: id,
          userId: req.user!.userId,
          technicianId: booking.technicianId!,
          rating: Number(rating),
          comment: comment || null,
        },
      });

      const agg = await tx.serviceReview.aggregate({
        where: { technicianId: booking.technicianId! },
        _avg: { rating: true },
      });
      await tx.serviceTechnician.update({
        where: { id: booking.technicianId! },
        data: { rating: agg._avg.rating || Number(rating) },
      });

      // Package rating is denormalized the same way -- ServiceReview has no
      // direct packageId, so filter through the booking relation.
      const packageAgg = await tx.serviceReview.aggregate({
        where: { booking: { packageId: booking.packageId } },
        _avg: { rating: true },
        _count: { rating: true },
      });
      await tx.servicePackage.update({
        where: { id: booking.packageId },
        data: { rating: packageAgg._avg.rating || Number(rating), reviewCount: packageAgg._count.rating },
      });

      return created;
    });

    res.status(201).json(review);
  } catch (error: any) {
    console.error('Error creating review:', error.message);
    res.status(500).json({ error: 'Failed to submit review' });
  }
};

// ============ Admin ============

export const getAllBookings = async (req: Request, res: Response) => {
  try {
    const { status, technicianId, search, paymentStatus, vehicleType, dateFrom, dateTo, sortBy, sortOrder, page, limit } = req.query;

    const where: Prisma.ServiceBookingWhereInput = {
      ...(status ? { status: { in: String(status).split(',') as BookingStatus[] } } : {}),
      ...(technicianId ? { technicianId: String(technicianId) } : {}),
      ...(vehicleType ? { vehicleType: String(vehicleType) as VehicleType } : {}),
      ...(paymentStatus === 'PAID' && { payment: { status: 'SUCCESS' } }),
      ...(paymentStatus === 'UNPAID' && { payment: { status: { not: 'SUCCESS' } } }),
      ...(paymentStatus === 'REFUNDED' && { payment: { status: 'REFUNDED' } }),
      ...((dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom ? { gte: new Date(String(dateFrom)) } : {}),
          ...(dateTo ? { lte: new Date(String(dateTo)) } : {}),
        },
      }),
      ...(search && {
        OR: [
          { bookingNumber: { contains: String(search), mode: 'insensitive' } },
          { user: { name: { contains: String(search), mode: 'insensitive' } } },
          { user: { phone: { contains: String(search) } } },
        ],
      }),
    };

    const orderDir: Prisma.SortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.ServiceBookingOrderByWithRelationInput =
      sortBy === 'scheduledDate' ? { scheduledDate: orderDir } :
      sortBy === 'finalAmount' ? { finalAmount: orderDir } :
      { createdAt: orderDir };

    const include = {
      user: true, category: true, package: true, address: true, payment: true,
      technician: { include: { user: true } }, timeSlot: true,
      statusHistory: { orderBy: { createdAt: 'asc' as const } }, invoice: true,
    };

    // Pagination is opt-in (only kicks in if the caller passes page/limit) so
    // existing callers that expect a flat array back (ServicesDashboard.tsx,
    // MechanicsPage.tsx completed-jobs modal) keep working unchanged.
    const isPaginated = page !== undefined || limit !== undefined;
    if (!isPaginated) {
      const bookings = await prisma.serviceBooking.findMany({ where, include, orderBy });
      res.status(200).json(sanitizeBookings(bookings));
      return;
    }

    const take = Math.min(Math.max(parseInt(String(limit)) || 20, 1), 100);
    const currentPage = Math.max(parseInt(String(page)) || 1, 1);
    const skip = (currentPage - 1) * take;

    const [bookings, total] = await Promise.all([
      prisma.serviceBooking.findMany({ where, include, orderBy, skip, take }),
      prisma.serviceBooking.count({ where }),
    ]);

    res.status(200).json({
      bookings: sanitizeBookings(bookings),
      total,
      page: currentPage,
      limit: take,
      pages: Math.max(Math.ceil(total / take), 1),
    });
  } catch (error: any) {
    console.error('Error fetching all bookings:', error.message);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
};

export const getAssignableTechnicians = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const booking = await prisma.serviceBooking.findUnique({ where: { id }, include: { address: true } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const candidates = await prisma.serviceTechnician.findMany({
      where: { status: 'APPROVED', isActive: true, specializations: { has: booking.vehicleType } },
      include: {
        user: true,
        documents: { where: { type: 'SELFIE' }, select: { id: true } },
      },
    });

    const jobCounts = await prisma.serviceBooking.groupBy({
      by: ['technicianId'],
      where: {
        technicianId: { in: candidates.map((c) => c.id) },
        status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] },
      },
      _count: { _all: true },
    });
    const jobCountMap = new Map(jobCounts.map((j) => [j.technicianId, j._count._all]));

    const enriched = candidates.map((tech) => {
      const distanceKm =
        booking.address.lat != null && booking.address.lng != null && tech.currentLat != null && tech.currentLng != null
          ? haversineKm(booking.address.lat, booking.address.lng, tech.currentLat, tech.currentLng)
          : null;
      const currentJobs = jobCountMap.get(tech.id) || 0;
      return {
        id: tech.id,
        name: tech.user.name,
        rating: tech.rating,
        experienceYears: tech.experienceYears,
        skills: tech.skills,
        isOnline: tech.isOnline,
        isActive: tech.isActive,
        distanceKm,
        currentJobs,
        isBusy: currentJobs > 0,
        photoDocumentId: tech.documents[0]?.id || null,
      };
    });

    enriched.sort((a, b) => {
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });

    res.status(200).json(enriched);
  } catch (error: any) {
    console.error('Error fetching assignable technicians:', error.message);
    res.status(500).json({ error: 'Failed to fetch assignable technicians' });
  }
};

export const getBookingTechnicianPhoto = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const booking = await prisma.serviceBooking.findUnique({ where: { id }, include: { technician: true } });
    if (!booking || !booking.technician) return res.status(404).json({ error: 'Photo not found' });

    const { userId, role } = req.user!;
    const isAdmin = ADMIN_SERVICE_ROLES.has(role);
    const isOwner = booking.userId === userId;
    const isAssignedTechnician = role === 'SERVICE_TECHNICIAN' && booking.technician.userId === userId;
    if (!isAdmin && !isOwner && !isAssignedTechnician) return res.status(403).json({ error: 'Forbidden' });

    const photo = await prisma.technicianDocument.findFirst({
      where: { technicianId: booking.technician.id, type: 'SELFIE' },
      orderBy: { uploadedAt: 'desc' },
    });
    if (!photo?.fileData) return res.status(404).json({ error: 'Photo not found' });

    res.setHeader('Content-Type', photo.mimeType || 'application/octet-stream');
    res.send(photo.fileData);
  } catch (error: any) {
    console.error('Error fetching technician photo:', error.message);
    res.status(500).json({ error: 'Failed to fetch photo' });
  }
};

export const assignTechnician = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { technicianId } = req.body;
    if (!technicianId) return res.status(400).json({ error: 'technicianId is required' });

    const technician = await prisma.serviceTechnician.findUnique({ where: { id: technicianId } });
    if (!technician || technician.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Technician is not an approved, active service technician.' });
    }

    const booking = await prisma.serviceBooking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    // REJECTED is deliberately assignable here (not just PENDING/CONFIRMED) --
    // this is also how a rejected-with-no-replacement booking gets manually
    // reassigned by an admin.
    if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
      return res.status(400).json({ error: `Cannot assign a technician to a ${booking.status.toLowerCase()} booking` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.serviceBooking.update({
        where: { id },
        data: { technicianId, status: 'MECHANIC_ASSIGNED' },
        include: { technician: { include: { user: true } } },
      });
      await tx.bookingStatusHistory.create({
        data: { bookingId: id, status: 'MECHANIC_ASSIGNED', changedByUserId: req.user!.userId, note: 'Assigned by admin' },
      });
      return b;
    });

    if (updated.technician) {
      notifyUser(updated.technician.userId, 'New service job assigned', `Booking #${updated.bookingNumber} is ready for you.`, { bookingId: id });
      if (updated.technician.expoPushToken) {
        sendExpoPush(
          updated.technician.expoPushToken,
          'New service job assigned',
          `Booking #${updated.bookingNumber} is ready for you.`,
          { bookingId: id }
        );
      }
    }
    notifyUser(updated.userId, 'Mechanic assigned', `A technician has been assigned to your booking #${updated.bookingNumber}.`, { bookingId: id });
    console.log(`[booking] assigned booking=${updated.bookingNumber} technician=${technicianId} by=${req.user!.userId}`);

    res.status(200).json(sanitizeBooking(updated));
  } catch (error: any) {
    console.error('Error assigning technician:', error.message);
    res.status(500).json({ error: 'Failed to assign technician' });
  }
};

const BOOKING_STATUS_VALUES = new Set(Object.values(BookingStatus));

export const updateAdminBookingStatus = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });
    if (!BOOKING_STATUS_VALUES.has(status)) {
      return res.status(400).json({ error: 'Invalid booking status' });
    }

    const existing = await prisma.serviceBooking.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Booking not found' });

    // Terminal states can't be reopened through this endpoint. Without this,
    // an admin could move a COMPLETED booking back to WORK_STARTED, letting
    // the technician legitimately re-run generate-OTP -> complete and get
    // credited (wallet + totalJobs) a second time for the same job.
    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      return res.status(400).json({ error: `Booking is already ${existing.status}; this is a terminal state and cannot be changed.` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Atomically claim the transition -- only matches if the booking's
      // status is still what we just read, re-checked under Postgres's row
      // lock at UPDATE time. Closes the race where a concurrent admin/
      // technician status update on the same booking both act on the same
      // stale pre-transition status.
      const claim = await tx.serviceBooking.updateMany({
        where: { id, status: existing.status },
        data: {
          status,
          ...(status === 'CANCELLED' && { technicianId: null }),
          ...(status === 'COMPLETED' && { completedAt: new Date() }),
        },
      });
      if (claim.count === 0) {
        throw new Error('Booking status changed concurrently by another request. Please refresh and retry.');
      }
      const b = await tx.serviceBooking.findUniqueOrThrow({ where: { id } });
      await tx.bookingStatusHistory.create({
        data: { bookingId: id, status, changedByUserId: req.user!.userId, note: 'Updated by admin' },
      });
      if (status === 'COMPLETED') {
        // An admin can close out a booking directly, bypassing the
        // technician's own accept/OTP flow (updateMyBookingStatus) -- that
        // flow is the only other place the technician gets credited, so
        // without this, a technician who did the job could go unpaid simply
        // because an admin closed the booking administratively instead.
        if (b.technicianId) {
          await tx.serviceTechnician.update({
            where: { id: b.technicianId },
            data: { walletBalance: { increment: b.finalAmount }, totalJobs: { increment: 1 } },
          });
        }
        await generateInvoiceForBooking(tx, b);
      }
      return b;
    });

    console.log(`[booking] status_change booking=${existing.bookingNumber} ${existing.status}->${status} by=admin:${req.user!.userId}`);
    notifyUser(existing.userId, 'Service update', `Your booking #${existing.bookingNumber} is now ${updated.status}.`, { bookingId: id, status: updated.status });

    res.status(200).json(updated);
  } catch (error: any) {
    if (error.message?.startsWith('Booking status changed concurrently')) {
      return res.status(409).json({ error: error.message });
    }
    console.error('Error updating booking status:', error.message);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
};

export const refundBookingPayment = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const payment = await prisma.payment.findUnique({
      where: { serviceBookingId: id },
      include: { serviceBooking: true },
    });
    if (!payment) return res.status(404).json({ error: 'Payment not found for this booking' });
    if (payment.status === 'REFUNDED') return res.status(400).json({ error: 'Payment already refunded' });

    // Mirrors order.controller.ts's cancelMyOrder refund logic: a paid-online
    // payment actually credits the customer's wallet, not just a status flip.
    // COD has nothing to refund through the wallet (no money moved through
    // the platform), so it stays a status-only record for ops purposes.
    const shouldCreditWallet = payment.method !== 'COD' && payment.status === 'SUCCESS' && payment.serviceBooking;

    const updated = await prisma.$transaction(async (tx) => {
      if (shouldCreditWallet) {
        await tx.user.update({
          where: { id: payment.serviceBooking!.userId },
          data: { wallet: { increment: payment.amount } },
        });
      }
      return tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
    });

    if (shouldCreditWallet) {
      notifyUser(payment.serviceBooking!.userId, 'Refund processed', `₹${payment.amount} has been credited to your wallet.`, { bookingId: id });
    }

    res.status(200).json(updated);
  } catch (error: any) {
    console.error('Error refunding payment:', error.message);
    res.status(500).json({ error: 'Failed to refund payment' });
  }
};

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  'MECHANIC_ASSIGNED', 'MECHANIC_ACCEPTED', 'MECHANIC_ON_THE_WAY', 'ARRIVED', 'WORK_STARTED',
];
const ASSIGNED_BOOKING_STATUSES: BookingStatus[] = ['MECHANIC_ASSIGNED', 'MECHANIC_ACCEPTED'];
const IN_PROGRESS_BOOKING_STATUSES: BookingStatus[] = ['MECHANIC_ON_THE_WAY', 'ARRIVED', 'WORK_STARTED'];

export const getServiceDashboard = async (req: Request, res: Response) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalBookings, todayBookings, pendingBookings, activeBookings, assignedBookings,
      inProgressBookings, completedBookings,
      cancelledBookings, rejectedBookings, revenueResult, todayRevenueResult,
      techniciansOnline, techniciansOffline, availableMechanics, distinctCustomers, ratingAgg,
      topServicesRaw, topMechanicsRaw,
    ] = await Promise.all([
      prisma.serviceBooking.count(),
      prisma.serviceBooking.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.serviceBooking.count({ where: { status: { in: ['PENDING', 'CONFIRMED'] } } }),
      prisma.serviceBooking.count({ where: { status: { in: ACTIVE_BOOKING_STATUSES } } }),
      prisma.serviceBooking.count({ where: { status: { in: ASSIGNED_BOOKING_STATUSES } } }),
      prisma.serviceBooking.count({ where: { status: { in: IN_PROGRESS_BOOKING_STATUSES } } }),
      prisma.serviceBooking.count({ where: { status: 'COMPLETED' } }),
      prisma.serviceBooking.count({ where: { status: 'CANCELLED' } }),
      prisma.serviceBooking.count({ where: { status: 'REJECTED' } }),
      prisma.serviceBooking.aggregate({ where: { status: 'COMPLETED' }, _sum: { finalAmount: true } }),
      prisma.serviceBooking.aggregate({ where: { status: 'COMPLETED', completedAt: { gte: startOfToday } }, _sum: { finalAmount: true } }),
      prisma.serviceTechnician.count({ where: { isOnline: true, isActive: true } }),
      prisma.serviceTechnician.count({ where: { isOnline: false, isActive: true } }),
      prisma.serviceTechnician.count({
        where: {
          isOnline: true, isActive: true, status: 'APPROVED',
          bookings: { none: { status: { in: ACTIVE_BOOKING_STATUSES } } },
        },
      }),
      prisma.serviceBooking.groupBy({ by: ['userId'] }),
      prisma.serviceReview.aggregate({ _avg: { rating: true } }),
      prisma.serviceBooking.groupBy({
        by: ['packageId'],
        where: { status: 'COMPLETED' },
        _count: { _all: true },
        _sum: { finalAmount: true },
        orderBy: { _count: { packageId: 'desc' } },
        take: 5,
      }),
      prisma.serviceBooking.groupBy({
        by: ['technicianId'],
        where: { status: 'COMPLETED', technicianId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { technicianId: 'desc' } },
        take: 5,
      }),
    ]);

    const packageIds = topServicesRaw.map((p) => p.packageId);
    const packages = await prisma.servicePackage.findMany({ where: { id: { in: packageIds } } });
    const packageMap = new Map(packages.map((p) => [p.id, p]));
    const topServices = topServicesRaw.map((p) => ({
      packageId: p.packageId,
      name: packageMap.get(p.packageId)?.name || 'Unknown',
      bookings: p._count._all,
      revenue: p._sum.finalAmount || 0,
    }));

    const technicianIds = topMechanicsRaw.map((t) => t.technicianId).filter((id): id is string => !!id);
    const technicians = await prisma.serviceTechnician.findMany({ where: { id: { in: technicianIds } }, include: { user: true } });
    const technicianMap = new Map(technicians.map((t) => [t.id, t]));
    const topMechanics = topMechanicsRaw
      .filter((t) => t.technicianId)
      .map((t) => ({
        technicianId: t.technicianId,
        name: technicianMap.get(t.technicianId!)?.user.name || 'Unknown',
        rating: technicianMap.get(t.technicianId!)?.rating || 0,
        completedJobs: t._count._all,
      }));

    res.status(200).json({
      totalBookings,
      todayBookings,
      pendingBookings,
      activeBookings,
      assignedBookings,
      inProgressBookings,
      completedBookings,
      cancelledBookings,
      rejectedBookings,
      revenue: revenueResult._sum.finalAmount || 0,
      todayRevenue: todayRevenueResult._sum.finalAmount || 0,
      techniciansOnline,
      techniciansOffline,
      availableMechanics,
      totalCustomers: distinctCustomers.length,
      averageRating: ratingAgg._avg.rating || 0,
      topServices,
      topMechanics,
    });
  } catch (error: any) {
    console.error('Error fetching service dashboard:', error.message);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};
