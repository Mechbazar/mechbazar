import { useEffect, useRef, useCallback } from 'react';
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import MapPlaceholder from './MapPlaceholder';
import { GOOGLE_MAPS_API_KEY, MAPS_ENABLED } from '../../config/maps';

export interface LocationMapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  /** Google Maps' stock colored-pin icons -- no custom asset needed. */
  color?: 'red' | 'blue' | 'green' | 'yellow';
}

interface LocationMapViewProps {
  markers: LocationMapMarker[];
  height?: number;
  emptyLabel?: string;
}

const mapContainerStyle = { width: '100%', height: '100%' };
const mapOptions = { streetViewControl: false, mapTypeControl: false, fullscreenControl: true };

const PIN_COLOR: Record<NonNullable<LocationMapMarker['color']>, string> = {
  red: 'red-dot.png',
  blue: 'blue-dot.png',
  green: 'green-dot.png',
  yellow: 'yellow-dot.png',
};

// Read-only map for admin: one or more fixed pins with no drag/edit
// behavior, used for entity detail views (a vendor's or technician's saved
// location) and order/delivery tracking (destination + live rider position).
// Distinct from AddressMapPicker, which is for editing a single coordinate.
export default function LocationMapView({ markers, height = 220, emptyLabel = 'No location set' }: LocationMapViewProps) {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY, id: 'mechbazar-google-maps' });
  const mapRef = useRef<google.maps.Map | null>(null);

  const fitBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map || markers.length === 0) return;
    if (markers.length === 1) {
      map.panTo({ lat: markers[0].lat, lng: markers[0].lng });
      map.setZoom(16);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
    map.fitBounds(bounds, 48);
  }, [markers]);

  useEffect(() => {
    fitBounds();
  }, [fitBounds]);

  if (!MAPS_ENABLED || !isLoaded) {
    return <MapPlaceholder label={markers.length > 0 ? 'Map view unavailable' : emptyLabel} height={height} />;
  }

  if (markers.length === 0) {
    return <MapPlaceholder label={emptyLabel} height={height} />;
  }

  const center = { lat: markers[0].lat, lng: markers[0].lng };

  return (
    <div style={{ height, borderRadius: 12, overflow: 'hidden' }}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={16}
        options={mapOptions}
        onLoad={(map) => {
          mapRef.current = map;
          fitBounds();
        }}
      >
        {markers.map((m) => (
          <MarkerF
            key={m.id}
            position={{ lat: m.lat, lng: m.lng }}
            title={m.label}
            icon={m.color ? `https://maps.google.com/mapfiles/ms/icons/${PIN_COLOR[m.color]}` : undefined}
          />
        ))}
      </GoogleMap>
    </div>
  );
}
