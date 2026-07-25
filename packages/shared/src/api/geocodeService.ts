import { getApiBaseUrl } from './client';

// Single home for address<->coordinate lookups shared by apps/seller-mobile
// (and any other RN app under this package) -- mirrors
// apps/mobile/src/services/geocode.service.ts, proxying through the
// backend's public /api/geocode/* routes instead of calling Google directly
// or duplicating this logic per-app.

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

// Plain fetch, not apiClient -- these routes are public (no auth required)
// and apiClient's baseURL already includes the app's own timeout/interceptor
// behavior tuned for authenticated endpoints, not this cross-app proxy.
async function getJson(path: string): Promise<any> {
  const res = await fetch(`${getApiBaseUrl()}${path}`);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    return { ok: false, reason: data?.reason || 'error', message: data?.error };
  }
  return data;
}

export const geocodeService = {
  reverseGeocode: async (lat: number, lng: number): Promise<GeocodeResult> => {
    try {
      return await getJson(`/geocode/reverse?lat=${lat}&lng=${lng}`);
    } catch (err) {
      console.error('reverseGeocode failed', err);
      return { ok: false, reason: 'network' };
    }
  },

  forwardGeocode: async (address: string): Promise<GeocodeResult> => {
    try {
      return await getJson(`/geocode/search?address=${encodeURIComponent(address)}`);
    } catch (err) {
      console.error('forwardGeocode failed', err);
      return { ok: false, reason: 'network' };
    }
  },

  autocomplete: async (input: string, opts?: { sessionToken?: string; country?: string }): Promise<AutocompleteResult> => {
    try {
      const params = new URLSearchParams({ input });
      if (opts?.sessionToken) params.set('sessionToken', opts.sessionToken);
      if (opts?.country) params.set('country', opts.country);
      return await getJson(`/geocode/autocomplete?${params.toString()}`);
    } catch (err) {
      console.error('autocomplete failed', err);
      return { ok: false, reason: 'network' };
    }
  },

  placeDetails: async (placeId: string, opts?: { sessionToken?: string }): Promise<GeocodeResult> => {
    try {
      const params = opts?.sessionToken ? `?sessionToken=${encodeURIComponent(opts.sessionToken)}` : '';
      return await getJson(`/geocode/place/${encodeURIComponent(placeId)}${params}`);
    } catch (err) {
      console.error('placeDetails failed', err);
      return { ok: false, reason: 'network' };
    }
  },
};

// One random token per autocomplete "session" -- Google bills Autocomplete +
// Details together as a single session when a matching sessiontoken is
// passed on both calls, instead of billing Autocomplete per-keystroke.
export function createSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
