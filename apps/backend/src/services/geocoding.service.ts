import { env } from '../config/env';

// Google Maps Platform integration seam (server-side only).
//
// MAPS_ENABLED mirrors apps/mobile/src/config/maps.ts's client-side pattern:
// every function below checks it first and returns a typed "unavailable"
// result instead of throwing when the key is unset, so a missing/misconfigured
// key degrades this feature only -- it never crashes the backend or blocks
// unrelated requests. Callers (geocode.controller.ts, and any future
// controller that wants server-side geocoding) should treat every function
// here as fallible and fall back to existing behavior (e.g. keep accepting
// client-supplied lat/lng without server-side reverse geocoding) on `ok: false`.

export const MAPS_ENABLED = !!env.GOOGLE_MAPS_SERVER_API_KEY;

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const PLACE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

export type GeocodeFailure = { ok: false; reason: 'disabled' | 'not_found' | 'error' | 'timeout'; message?: string };

export type GeocodeSuccess = {
  ok: true;
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId: string;
  components: { city?: string; state?: string; pincode?: string; country?: string };
};

export type GeocodeResult = GeocodeSuccess | GeocodeFailure;

export type AutocompleteResult =
  | { ok: true; predictions: { placeId: string; description: string }[] }
  | GeocodeFailure;

type GoogleAddressComponent = { long_name: string; short_name: string; types: string[] };

function extractComponents(components: GoogleAddressComponent[]): GeocodeSuccess['components'] {
  const find = (type: string) => components.find((c) => c.types.includes(type))?.long_name;
  return {
    city: find('locality') || find('administrative_area_level_2'),
    state: find('administrative_area_level_1'),
    pincode: find('postal_code'),
    country: find('country'),
  };
}

async function googleFetch(url: string, params: Record<string, string>): Promise<any> {
  const search = new URLSearchParams({ ...params, key: env.GOOGLE_MAPS_SERVER_API_KEY });
  const res = await fetch(`${url}?${search.toString()}`, {
    signal: AbortSignal.timeout(env.GOOGLE_MAPS_TIMEOUT_MS),
  });
  return res.json();
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
  if (!MAPS_ENABLED) return { ok: false, reason: 'disabled' };
  try {
    const data = await googleFetch(GEOCODE_URL, { latlng: `${lat},${lng}` });
    if (data.status === 'ZERO_RESULTS') return { ok: false, reason: 'not_found' };
    if (data.status !== 'OK' || !data.results?.[0]) {
      console.error('[geocoding.service] reverseGeocode non-OK status:', data.status, data.error_message);
      return { ok: false, reason: 'error', message: data.error_message };
    }
    const result = data.results[0];
    return {
      ok: true,
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      components: extractComponents(result.address_components),
    };
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return { ok: false, reason: 'timeout' };
    console.error('[geocoding.service] reverseGeocode error:', err);
    return { ok: false, reason: 'error', message: err?.message };
  }
}

export async function forwardGeocode(address: string): Promise<GeocodeResult> {
  if (!MAPS_ENABLED) return { ok: false, reason: 'disabled' };
  try {
    const data = await googleFetch(GEOCODE_URL, { address });
    if (data.status === 'ZERO_RESULTS') return { ok: false, reason: 'not_found' };
    if (data.status !== 'OK' || !data.results?.[0]) {
      console.error('[geocoding.service] forwardGeocode non-OK status:', data.status, data.error_message);
      return { ok: false, reason: 'error', message: data.error_message };
    }
    const result = data.results[0];
    return {
      ok: true,
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      components: extractComponents(result.address_components),
    };
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return { ok: false, reason: 'timeout' };
    console.error('[geocoding.service] forwardGeocode error:', err);
    return { ok: false, reason: 'error', message: err?.message };
  }
}

export async function placesAutocomplete(
  input: string,
  opts?: { sessionToken?: string; country?: string }
): Promise<AutocompleteResult> {
  if (!MAPS_ENABLED) return { ok: false, reason: 'disabled' };
  try {
    const data = await googleFetch(AUTOCOMPLETE_URL, {
      input,
      ...(opts?.sessionToken && { sessiontoken: opts.sessionToken }),
      ...(opts?.country && { components: `country:${opts.country}` }),
    });
    if (data.status === 'ZERO_RESULTS') return { ok: true, predictions: [] };
    if (data.status !== 'OK') {
      console.error('[geocoding.service] placesAutocomplete non-OK status:', data.status, data.error_message);
      return { ok: false, reason: 'error', message: data.error_message };
    }
    return {
      ok: true,
      predictions: (data.predictions || []).map((p: any) => ({ placeId: p.place_id, description: p.description })),
    };
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return { ok: false, reason: 'timeout' };
    console.error('[geocoding.service] placesAutocomplete error:', err);
    return { ok: false, reason: 'error', message: err?.message };
  }
}

export async function placeDetails(placeId: string, opts?: { sessionToken?: string }): Promise<GeocodeResult> {
  if (!MAPS_ENABLED) return { ok: false, reason: 'disabled' };
  try {
    const data = await googleFetch(PLACE_DETAILS_URL, {
      place_id: placeId,
      fields: 'geometry,formatted_address,address_component,place_id',
      ...(opts?.sessionToken && { sessiontoken: opts.sessionToken }),
    });
    if (data.status === 'NOT_FOUND' || data.status === 'INVALID_REQUEST') return { ok: false, reason: 'not_found' };
    if (data.status !== 'OK' || !data.result) {
      console.error('[geocoding.service] placeDetails non-OK status:', data.status, data.error_message);
      return { ok: false, reason: 'error', message: data.error_message };
    }
    const result = data.result;
    return {
      ok: true,
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      components: extractComponents(result.address_components || []),
    };
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return { ok: false, reason: 'timeout' };
    console.error('[geocoding.service] placeDetails error:', err);
    return { ok: false, reason: 'error', message: err?.message };
  }
}

// Small-scale distance calc -- no PostGIS at this scale, just Haversine.
// Moved here from utils/geo.ts (re-exported there) so it lives with the rest
// of this project's geo/location code instead of being reimplemented again.
export const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
