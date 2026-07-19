import { VehicleType } from '@prisma/client';

export const VALID_VEHICLE_TYPES: VehicleType[] = [VehicleType.CAR, VehicleType.BIKE];

// Coerces an arbitrary incoming value (query param, form field) to a real
// VehicleType, falling back to `fallback` for anything that isn't exactly
// CAR/BIKE (case-insensitive) -- e.g. a typo'd "Car" or an unrelated string
// like "Truck". Used everywhere a controller used to do a bare
// `String(x).toUpperCase()` with no validation, which the enum column no
// longer tolerates silently.
export const normalizeVehicleType = (v: unknown, fallback: VehicleType = VehicleType.CAR): VehicleType => {
  const upper = String(v ?? '').toUpperCase();
  return (VALID_VEHICLE_TYPES as string[]).includes(upper) ? (upper as VehicleType) : fallback;
};

// Same coercion, but returns undefined for anything invalid/missing instead of
// defaulting -- for public read endpoints where an unrecognized filter value
// should behave like "no filter" rather than silently substituting CAR.
export const parseVehicleTypeFilter = (v: unknown): VehicleType | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const upper = String(v).toUpperCase();
  return (VALID_VEHICLE_TYPES as string[]).includes(upper) ? (upper as VehicleType) : undefined;
};
