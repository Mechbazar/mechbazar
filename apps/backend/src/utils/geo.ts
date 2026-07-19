import { Prisma, VehicleType } from '@prisma/client';

// Small-scale nearest-technician search -- no PostGIS at this scale, just
// Haversine distance over the (small) set of currently online technicians.
export const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

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
