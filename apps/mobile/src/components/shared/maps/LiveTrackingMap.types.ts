export interface TrackingMarker {
  latitude: number;
  longitude: number;
  title: string;
  // Only affects the pin's color -- omit for the default (red) pin.
  color?: string;
}

export interface LiveTrackingMapProps {
  // First marker is treated as the map's center/region anchor (matches the
  // previous behavior of always centering on the rider/technician).
  markers: TrackingMarker[];
  height?: number;
  // Google's encoded polyline format (routing.service.ts's getRoute returns
  // this directly from the Directions API) -- decoded client-side, not
  // server-side, since both platform implementations already have a maps SDK
  // capable of it.
  routePolyline?: string | null;
  routeColor?: string;
}
