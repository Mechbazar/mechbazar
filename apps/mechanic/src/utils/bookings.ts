// ServiceBooking.status values relevant to a technician (Prisma BookingStatus
// enum). PENDING/CONFIRMED/REJECTED never reach this app's own bookings list
// with technicianId set to us -- technicianId is only set once a booking is
// auto- or admin-assigned, and getMyBookings is scoped to technicianId.
// completionOtp is always stripped server-side from a technician's own view.
export type Booking = {
  id: string;
  bookingNumber: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  scheduledDate: string;
  estimatedCost: number;
  additionalCost: number;
  finalAmount: number;
  issueDescription?: string | null;
  vehicleType: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleRegistrationNumber?: string | null;
  approvalStatus?: string | null;
  approvalNote?: string | null;
  cancelReason?: string | null;
  category: { name: string };
  package: { name: string };
  timeSlot: { label: string };
  address: { line1: string; line2?: string | null; city: string; state: string; pincode: string; lat?: number | null; lng?: number | null };
  user: { name?: string | null; phone: string };
  payment?: { method: string; amount: number } | null;
};

const ONGOING_STATUSES = new Set(['MECHANIC_ON_THE_WAY', 'ARRIVED', 'WORK_STARTED']);

export const isNew = (b: Booking) => b.status === 'MECHANIC_ASSIGNED';
export const isAccepted = (b: Booking) => b.status === 'MECHANIC_ACCEPTED';
export const isOngoing = (b: Booking) => ONGOING_STATUSES.has(b.status);
export const isTerminal = (b: Booking) => b.status === 'COMPLETED' || b.status === 'CANCELLED';
export const isCompletedBooking = (b: Booking) => b.status === 'COMPLETED';
export const isCancelledBooking = (b: Booking) => b.status === 'CANCELLED';

// "Active" for Home-screen purposes covers every stage from acceptance
// through ongoing work -- a freshly assigned-but-not-yet-accepted job is
// deliberately excluded, since it needs an Accept/Reject decision first, not
// a "continue" action.
export const isActiveForTechnician = (b: Booking) => isAccepted(b) || isOngoing(b);

export const isCompletedToday = (b: Booking) => {
  if (b.status !== 'COMPLETED') return false;
  const ref = new Date(b.completedAt || b.updatedAt);
  const now = new Date();
  return (
    ref.getFullYear() === now.getFullYear() &&
    ref.getMonth() === now.getMonth() &&
    ref.getDate() === now.getDate()
  );
};
