import { useCallback } from 'react';
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import MapPlaceholder from './MapPlaceholder';
import { GOOGLE_MAPS_API_KEY, MAPS_ENABLED } from '../../config/maps';

interface AddressMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (coords: { latitude: number; longitude: number }) => void;
  height?: number;
}

// Editable draggable-marker picker, ported from
// apps/vendor/src/components/maps/AddressMapPicker.tsx. Used in admin edit
// forms (Vendors, Warehouses, Suppliers, Technicians) where an operator
// needs to set/correct a lat/lng, as opposed to LocationMapView which is
// read-only display.

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };
const mapContainerStyle = { width: '100%', height: '100%' };
const mapOptions = { streetViewControl: false, mapTypeControl: false, fullscreenControl: false };

export default function AddressMapPicker({ latitude, longitude, onChange, height = 220 }: AddressMapPickerProps) {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY, id: 'mechbazar-google-maps' });

  const handleClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng) onChange({ latitude: e.latLng.lat(), longitude: e.latLng.lng() });
    },
    [onChange]
  );

  const handleDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng) onChange({ latitude: e.latLng.lat(), longitude: e.latLng.lng() });
    },
    [onChange]
  );

  if (!MAPS_ENABLED || !isLoaded) {
    return <MapPlaceholder label="Set location on map" height={height} />;
  }

  const center = latitude != null && longitude != null ? { lat: latitude, lng: longitude } : DEFAULT_CENTER;
  const zoom = latitude != null && longitude != null ? 16 : 4;

  return (
    <div style={{ height, borderRadius: 12, overflow: 'hidden' }}>
      <GoogleMap mapContainerStyle={mapContainerStyle} center={center} zoom={zoom} onClick={handleClick} options={mapOptions}>
        {latitude != null && longitude != null && (
          <MarkerF position={{ lat: latitude, lng: longitude }} draggable onDragEnd={handleDragEnd} />
        )}
      </GoogleMap>
    </div>
  );
}
