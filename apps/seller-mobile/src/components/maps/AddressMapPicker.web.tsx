import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import MapPlaceholder from './MapPlaceholder';
import { GOOGLE_MAPS_API_KEY, MAPS_ENABLED } from '../../config/maps';
import { AddressMapPickerProps } from './AddressMapPicker.types';

// Web implementation -- react-native-maps has no web target, so the web
// build (`expo export -p web`) uses the Google Maps JavaScript API directly
// via @react-google-maps/api instead, mirroring apps/mobile's identical split.

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };
const mapContainerStyle = { width: '100%', height: '100%' };
const mapOptions = { streetViewControl: false, mapTypeControl: false, fullscreenControl: false };

export default function AddressMapPicker({ latitude, longitude, onChange, height = 200 }: AddressMapPickerProps) {
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
    return <MapPlaceholder label="Confirm store location on map" height={height} />;
  }

  const center = latitude != null && longitude != null ? { lat: latitude, lng: longitude } : DEFAULT_CENTER;
  const zoom = latitude != null && longitude != null ? 16 : 4;

  return (
    <View style={[styles.wrapper, { height }]}>
      <GoogleMap mapContainerStyle={mapContainerStyle} center={center} zoom={zoom} onClick={handleClick} options={mapOptions}>
        {latitude != null && longitude != null && (
          <MarkerF position={{ lat: latitude, lng: longitude }} draggable onDragEnd={handleDragEnd} />
        )}
      </GoogleMap>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderRadius: 12, overflow: 'hidden' },
});
