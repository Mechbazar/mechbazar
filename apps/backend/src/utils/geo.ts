import { Prisma, VehicleType } from '@prisma/client';
import { haversineKm } from '../services/geocoding.service';

// Small-scale nearest-technician search -- no PostGIS at this scale, just
// Haversine distance over the (small) set of currently online technicians.
// haversineKm itself now lives in services/geocoding.service.ts (the new
// home for this project's Google Maps/geo integration); re-exported here so
// this module's existing import surface (used by service.controller.ts)
// doesn't need to change.
export { haversineKm };

// Shared by createBooking's auto-assign and rejectBookingJob's auto-reassign
// (excludeTechnicianId keeps a rejecting technician out of their own retry).
export const findNearestApprovedTechnician = async (
  tx: Prisma.TransactionClient,
  vehicleType: VehicleType,
  lat: number | null | undefined,
  lng: number | null | undefined,
  excludeTechnicianId?: string
) => {
  const candidates = await tx.serviceTechnician.findMany({
    where: {
      isOnline: true,
      isActive: true,
      status: 'APPROVED',
      specializations: { has: vehicleType },
      currentLat: { not: null },
      currentLng: { not: null },
      ...(excludeTechnicianId ? { id: { not: excludeTechnicianId } } : {}),
    },
  });
  if (candidates.length === 0) return null;
  if (lat == null || lng == null) return candidates[0];

  let nearest = candidates[0];
  let nearestDist = haversineKm(lat, lng, nearest.currentLat!, nearest.currentLng!);
  for (const candidate of candidates.slice(1)) {
    const dist = haversineKm(lat, lng, candidate.currentLat!, candidate.currentLng!);
    if (dist < nearestDist) {
      nearest = candidate;
      nearestDist = dist;
    }
  }
  return nearest;
};
