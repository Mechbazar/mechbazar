import { emitToJob, emitToAdmins } from '../realtime/gateway';
import { SERVER_EVENTS } from '../realtime/events';
import { STATUS_MESSAGE, buildTimeline } from '../services/jobState';

// Legacy (scheduled/"Garage") bookings don't go through jobState.ts's
// transitionJob state machine -- that machine's OTP gate on WORK_STARTED
// doesn't apply to this flow, which has no start-OTP concept at all, only a
// completion OTP checked ad hoc in updateMyBookingStatus. So this is a thin,
// independent broadcaster reusing the same event names/copy/timeline builder
// as jobState.ts's broadcastJobStatus, rather than routing legacy mutations
// through transitionJob and fighting its gating semantics.
interface BroadcastableBooking {
  id: string;
  bookingNumber: string;
  status: string;
  isEmergency: boolean;
  technicianId: string | null;
  technician?: {
    id: string;
    rating: number;
    totalJobs: number;
    user?: { name: string | null } | null;
  } | null;
  [key: string]: unknown; // buildTimeline reads timestamp columns off this
}

export function broadcastBookingStatus(booking: BroadcastableBooking, previousStatus: string | null = null): void {
  const at = new Date().toISOString();
  const payload = {
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber,
    status: booking.status,
    previousStatus,
    at,
    message: STATUS_MESSAGE[booking.status as keyof typeof STATUS_MESSAGE] || '',
    technician: booking.technician
      ? {
          id: booking.technician.id,
          name: booking.technician.user?.name ?? null,
          rating: booking.technician.rating,
          totalJobs: booking.technician.totalJobs,
          photoUrl: `/api/services/bookings/${booking.id}/technician-photo`,
        }
      : null,
  };

  emitToJob(booking.id, SERVER_EVENTS.JOB_STATUS, payload);
  emitToJob(booking.id, SERVER_EVENTS.JOB_TIMELINE, { bookingId: booking.id, steps: buildTimeline(booking) });
  emitToAdmins(SERVER_EVENTS.ADMIN_JOB_UPDATE, {
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber,
    status: booking.status,
    technicianId: booking.technicianId,
    isEmergency: booking.isEmergency,
    at,
  });
}
