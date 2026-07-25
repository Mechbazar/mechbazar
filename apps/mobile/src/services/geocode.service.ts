import { API_BASE_URL } from './api';

// Single home for all address<->coordinate lookups in this app. Everything
// here proxies through the backend's /api/geocode/* routes (see
// apps/backend/src/services/geocoding.service.ts) instead of calling Google
// directly or using on-device geocoding -- keeps exactly one Google API key
// (server-side) doing this work, and lets every screen degrade the same way
// (typed `ok: false`) when the backend's key is unset or Google is down.
//
// Device GPS reads (locationService.getCurrentLocation) are NOT duplicated
// here -- reading the phone's own GPS sensor isn't geocoding, it has no
// backend equivalent, and stays in location.service.ts.

export interface GeocodeComponents {
  line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

export interface GeocodeSuccess {
  ok: true;
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId: string;
  components: GeocodeComponents;
}

export interface GeocodeFailure {
  ok: false;
  reason: 'disabled' | 'not_found' | 'error' | 'timeout' | 'network';
  message?: string;
}

export type GeocodeResult = GeocodeSuccess | GeocodeFailure;

export interface AutocompletePrediction {
  placeId: string;
  description: string;
}

export type AutocompleteResult =
  | { ok: true; predictions: AutocompletePrediction[] }
  | GeocodeFailure;

// Backend /api/geocode/* routes are deliberately public (see
// geocode.routes.ts) -- token is optional here because the Home screen's
// "Deliver to <city>" bar reverse-geocodes before a guest has ever logged
// in. Screens that do have a token (address forms) still pass it; it's
// simply not required.
const authHeaders = (token?: string | null): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

async function getJson(url: string, token?: string | null): Promise<any> {
  const res = await fetch(url, { headers: authHeaders(token) });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    return { ok: false, reason: data?.reason || 'error', message: data?.error };
  }
  return data;
}

export async function reverseGeocode(token: string | null | undefined, lat: number, lng: number): Promise<GeocodeResult> {
  try {
    return await getJson(`${API_BASE_URL}/geocode/reverse?lat=${lat}&lng=${lng}`, token);
  } catch (err) {
    console.error('reverseGeocode failed', err);
    return { ok: false, reason: 'network' };
  }
}

export async function forwardGeocode(token: string | null | undefined, address: string): Promise<GeocodeResult> {
  try {
    return await getJson(`${API_BASE_URL}/geocode/search?address=${encodeURIComponent(address)}`, token);
  } catch (err) {
    console.error('forwardGeocode failed', err);
    return { ok: false, reason: 'network' };
  }
}

export async function autocomplete(
  token: string | null | undefined,
  input: string,
  opts?: { sessionToken?: string; country?: string }
): Promise<AutocompleteResult> {
  try {
    const params = new URLSearchParams({ input });
    if (opts?.sessionToken) params.set('sessionToken', opts.sessionToken);
    if (opts?.country) params.set('country', opts.country);
    return await getJson(`${API_BASE_URL}/geocode/autocomplete?${params.toString()}`, token);
  } catch (err) {
    console.error('autocomplete failed', err);
    return { ok: false, reason: 'network' };
  }
}

export async function placeDetails(
  token: string | null | undefined,
  placeId: string,
  opts?: { sessionToken?: string }
): Promise<GeocodeResult> {
  try {
    const params = opts?.sessionToken ? `?sessionToken=${encodeURIComponent(opts.sessionToken)}` : '';
    return await getJson(`${API_BASE_URL}/geocode/place/${encodeURIComponent(placeId)}${params}`, token);
  } catch (err) {
    console.error('placeDetails failed', err);
    return { ok: false, reason: 'network' };
  }
}

// One random token per autocomplete "session" (first keystroke through place
// selection) -- Google bills Autocomplete + Details together as a single
// session when a matching sessiontoken is passed on both calls, instead of
// billing Autocomplete per-keystroke.
export function createSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
