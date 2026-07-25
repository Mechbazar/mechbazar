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
}
