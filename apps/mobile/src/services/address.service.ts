import { ServiceAddress } from '../types/service';
import { API_BASE_URL } from './api';

const authHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

export const fetchMyAddresses = async (token: string): Promise<ServiceAddress[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/customers/me/addresses`, { headers: authHeaders(token) });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('fetchMyAddresses failed', err);
    return [];
  }
};

export interface NewAddressInput {
  title: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  lat?: number | null;
  lng?: number | null;
  isDefault?: boolean;
}

export const createMyAddress = async (
  token: string,
  input: NewAddressInput
): Promise<{ address?: ServiceAddress; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/customers/me/addresses`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || 'Failed to save address' };
    return { address: data };
  } catch (err) {
    console.error('createMyAddress failed', err);
    return { error: 'Network error while saving address' };
  }
};

export const updateMyAddress = async (
  token: string,
  id: string,
  input: Partial<NewAddressInput>
): Promise<{ address?: ServiceAddress; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/customers/me/addresses/${id}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || 'Failed to update address' };
    return { address: data };
  } catch (err) {
    console.error('updateMyAddress failed', err);
    return { error: 'Network error while updating address' };
  }
};

export const deleteMyAddress = async (
  token: string,
  id: string
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/customers/me/addresses/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error || 'Failed to delete address' };
    }
    return { ok: true };
  } catch (err) {
    console.error('deleteMyAddress failed', err);
    return { ok: false, error: 'Network error while deleting address' };
  }
};
