import { UserVehicle, VehicleType } from '../types/product';
import { API_BASE_URL } from './api';

const authHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

const mapBackendVehicle = (v: any): UserVehicle => ({
  id: v.id,
  nickname: v.nickname || undefined,
  vehicleType: v.vehicleType === 'BIKE' ? VehicleType.BIKE : VehicleType.CAR,
  brand: v.brand,
  model: v.model,
  year: v.year || '',
  fuelType: v.fuelType || '',
  engine: v.engine || '',
  transmission: v.transmission || '',
  trim: v.trim || '',
  registrationNumber: v.registrationNumber || undefined,
  isDefault: v.isDefault,
});

export interface NewVehicleInput {
  vehicleType: VehicleType;
  brand: string;
  model: string;
  year?: string;
  fuelType?: string;
  engine?: string;
  transmission?: string;
  trim?: string;
  registrationNumber?: string;
  nickname?: string;
  isDefault?: boolean;
}

export const fetchMyVehicles = async (token: string): Promise<UserVehicle[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/customers/me/vehicles`, { headers: authHeaders(token) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(mapBackendVehicle);
  } catch (err) {
    console.error('fetchMyVehicles failed', err);
    return [];
  }
};

export const createMyVehicle = async (
  token: string,
  input: NewVehicleInput
): Promise<{ vehicle?: UserVehicle; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/customers/me/vehicles`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || 'Failed to save vehicle' };
    return { vehicle: mapBackendVehicle(data) };
  } catch (err) {
    console.error('createMyVehicle failed', err);
    return { error: 'Network error while saving vehicle' };
  }
};

export const updateMyVehicle = async (
  token: string,
  id: string,
  input: Partial<NewVehicleInput>
): Promise<{ vehicle?: UserVehicle; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/customers/me/vehicles/${id}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || 'Failed to update vehicle' };
    return { vehicle: mapBackendVehicle(data) };
  } catch (err) {
    console.error('updateMyVehicle failed', err);
    return { error: 'Network error while updating vehicle' };
  }
};

export const deleteMyVehicle = async (token: string, id: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/customers/me/vehicles/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error || 'Failed to delete vehicle' };
    }
    return { ok: true };
  } catch (err) {
    console.error('deleteMyVehicle failed', err);
    return { ok: false, error: 'Network error while deleting vehicle' };
  }
};
