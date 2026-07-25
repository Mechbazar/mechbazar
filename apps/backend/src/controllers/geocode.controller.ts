import { Request, Response } from 'express';
import { reverseGeocode, forwardGeocode, placesAutocomplete, placeDetails } from '../services/geocoding.service';

// Thin proxy over services/geocoding.service.ts -- lets every frontend call
// the backend instead of embedding a raw, quota-metered Google Places/
// Geocoding key in more client bundles. Any authenticated role may call
// these (see geocode.routes.ts); there's nothing user-specific here.

function degradedStatus(reason: 'disabled' | 'not_found' | 'error' | 'timeout'): number {
  if (reason === 'not_found') return 404;
  if (reason === 'timeout') return 504;
  return 503;
}

// Every check below uses `'reason' in result` rather than `!result.ok` --
// this repo's tsconfig (strict: false + module/target nodenext/esnext)
// doesn't narrow the GeocodeResult/AutocompleteResult unions on a plain
// boolean discriminant check, only on an `in` check.

export const getReverseGeocode = async (req: Request, res: Response): Promise<void> => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: 'lat and lng query params are required and must be numbers' });
    return;
  }

  const result = await reverseGeocode(lat, lng);
  if ('reason' in result) {
    res.status(degradedStatus(result.reason)).json({ error: 'Geocoding is currently unavailable', reason: result.reason });
    return;
  }
  res.status(200).json(result);
};

export const getForwardGeocode = async (req: Request, res: Response): Promise<void> => {
  const address = String(req.query.address || '').trim();
  if (!address) {
    res.status(400).json({ error: 'address query param is required' });
    return;
  }

  const result = await forwardGeocode(address);
  if ('reason' in result) {
    res.status(degradedStatus(result.reason)).json({ error: 'Geocoding is currently unavailable', reason: result.reason });
    return;
  }
  res.status(200).json(result);
};

export const getAutocomplete = async (req: Request, res: Response): Promise<void> => {
  const input = String(req.query.input || '').trim();
  if (!input) {
    res.status(400).json({ error: 'input query param is required' });
    return;
  }
  const sessionToken = req.query.sessionToken ? String(req.query.sessionToken) : undefined;
  const country = req.query.country ? String(req.query.country) : undefined;

  const result = await placesAutocomplete(input, { sessionToken, country });
  if ('reason' in result) {
    res.status(degradedStatus(result.reason)).json({ error: 'Place autocomplete is currently unavailable', reason: result.reason });
    return;
  }
  res.status(200).json(result);
};

export const getPlaceDetails = async (req: Request, res: Response): Promise<void> => {
  const placeId = String(req.params.placeId || '').trim();
  if (!placeId) {
    res.status(400).json({ error: 'placeId route param is required' });
    return;
  }
  const sessionToken = req.query.sessionToken ? String(req.query.sessionToken) : undefined;

  const result = await placeDetails(placeId, { sessionToken });
  if ('reason' in result) {
    res.status(degradedStatus(result.reason)).json({ error: 'Place details are currently unavailable', reason: result.reason });
    return;
  }
  res.status(200).json(result);
};
