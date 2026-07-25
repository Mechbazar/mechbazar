import { API_URL } from '../config/api';

// Single home for all address<->coordinate lookups in this app, mirroring
// apps/vendor/src/services/geocode.service.ts. Proxies through the backend's
// /api/geocode/* routes instead of calling Google directly, so exactly one
// Google API key (server-side) does this work.

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

// Backend /api/geocode/* routes are public (see apps/backend/src/routes/geocode.routes.ts).
async function getJson(url: string): Promise<any> {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    return { ok: false, reason: data?.reason || 'error', message: data?.error };
  }
  return data;
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
  try {
    return await getJson(`${API_URL}/geocode/reverse?lat=${lat}&lng=${lng}`);
  } catch (err) {
    console.error('reverseGeocode failed', err);
    return { ok: false, reason: 'network' };
  }
}

export async function forwardGeocode(address: string): Promise<GeocodeResult> {
  try {
    return await getJson(`${API_URL}/geocode/search?address=${encodeURIComponent(address)}`);
  } catch (err) {
    console.error('forwardGeocode failed', err);
    return { ok: false, reason: 'network' };
  }
}

export async function autocomplete(
  input: string,
  opts?: { sessionToken?: string; country?: string }
): Promise<AutocompleteResult> {
  try {
    const params = new URLSearchParams({ input });
    if (opts?.sessionToken) params.set('sessionToken', opts.sessionToken);
    if (opts?.country) params.set('country', opts.country);
    return await getJson(`${API_URL}/geocode/autocomplete?${params.toString()}`);
  } catch (err) {
    console.error('autocomplete failed', err);
    return { ok: false, reason: 'network' };
  }
}

export async function placeDetails(placeId: string, opts?: { sessionToken?: string }): Promise<GeocodeResult> {
  try {
    const params = opts?.sessionToken ? `?sessionToken=${encodeURIComponent(opts.sessionToken)}` : '';
    return await getJson(`${API_URL}/geocode/place/${encodeURIComponent(placeId)}${params}`);
  } catch (err) {
    console.error('placeDetails failed', err);
    return { ok: false, reason: 'network' };
  }
}

// One random token per autocomplete "session" -- Google bills Autocomplete +
// Details together as a single session when a matching sessiontoken is
// passed on both calls, instead of billing Autocomplete per-keystroke.
export function createSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
