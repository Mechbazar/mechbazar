import { env } from '../config/env';
import { haversineKm, MAPS_ENABLED } from './geocoding.service';

// Route + ETA for the mechanic -> customer leg of a live job.
//
// Follows the same contract as geocoding.service.ts: never throws, always
// returns a typed result, and degrades rather than failing. The degradation
// here is meaningful rather than cosmetic -- when the Directions API is
// unavailable (no key, quota exhausted, timeout) we still return an ETA, from
// straight-line distance and a conservative urban average speed. A customer
// watching a mechanic drive towards them needs *an* ETA; a blank card is worse
// than an approximate number that is labelled as approximate, which is why
// `source` is part of the result and is surfaced in the UI.

const DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';

// Indian city driving average, deliberately pessimistic. Used only by the
// fallback path. 22 km/h is roughly Bengaluru/Delhi peak-hour arterial speed;
// over-promising arrival time on an emergency job is the worse failure.
const FALLBACK_AVG_SPEED_KMPH = 22;
// Straight-line distance systematically understates road distance. 1.35 is the
// commonly used circuity factor for dense Indian road networks.
const ROAD_CIRCUITY_FACTOR = 1.35;

export interface RouteResult {
  ok: true;
  /** Seconds, traffic-aware when Directions was reachable. */
  etaSeconds: number;
  /** Metres along the route. */
  distanceM: number;
  /** Encoded polyline for the map overlay; null on the fallback path. */
  polyline: string | null;
  source: 'directions' | 'haversine';
}

export type RouteOutcome = RouteResult | { ok: false; reason: string };

interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Straight-line ETA. Always available, no network call. Exported because the
 * dispatch engine uses it to rank candidate mechanics -- ranking N candidates
 * must not cost N Directions calls.
 */
export function estimateRouteOffline(from: LatLng, to: LatLng): RouteResult {
  const straightKm = haversineKm(from.lat, from.lng, to.lat, to.lng);
  const roadKm = straightKm * ROAD_CIRCUITY_FACTOR;
  return {
    ok: true,
    etaSeconds: Math.max(60, Math.round((roadKm / FALLBACK_AVG_SPEED_KMPH) * 3600)),
    distanceM: Math.round(roadKm * 1000),
    polyline: null,
    source: 'haversine',
  };
}

/**
 * Traffic-aware driving route. Falls back to estimateRouteOffline on any
 * failure, so callers never have to branch on availability.
 */
export async function getRoute(from: LatLng, to: LatLng): Promise<RouteResult> {
  if (!MAPS_ENABLED) return estimateRouteOffline(from, to);

  try {
    const params = new URLSearchParams({
      origin: `${from.lat},${from.lng}`,
      destination: `${to.lat},${to.lng}`,
      mode: 'driving',
      // `departure_time=now` is what unlocks duration_in_traffic. Without it
      // Google returns free-flow duration, which on an Indian arterial at
      // 6pm is not a number anyone should show a stranded customer.
      departure_time: 'now',
      key: env.GOOGLE_MAPS_SERVER_API_KEY,
    });

    const res = await fetch(`${DIRECTIONS_URL}?${params.toString()}`, {
      signal: AbortSignal.timeout(env.GOOGLE_MAPS_TIMEOUT_MS),
    });
    const data: any = await res.json();

    if (data.status !== 'OK' || !data.routes?.[0]?.legs?.[0]) {
      // ZERO_RESULTS is normal (an island, a bad pin); anything else is worth
      // a log line because it usually means billing or key restrictions.
      if (data.status !== 'ZERO_RESULTS') {
        console.error('[routing.service] Directions non-OK:', data.status, data.error_message);
      }
      return estimateRouteOffline(from, to);
    }

    const leg = data.routes[0].legs[0];
    return {
      ok: true,
      etaSeconds: leg.duration_in_traffic?.value ?? leg.duration?.value ?? estimateRouteOffline(from, to).etaSeconds,
      distanceM: leg.distance?.value ?? estimateRouteOffline(from, to).distanceM,
      polyline: data.routes[0].overview_polyline?.points ?? null,
      source: 'directions',
    };
  } catch (err: any) {
    if (err?.name !== 'TimeoutError' && err?.name !== 'AbortError') {
      console.error('[routing.service] getRoute error:', err?.message || err);
    }
    return estimateRouteOffline(from, to);
  }
}
