import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, MapPressEvent, MarkerDragStartEndEvent } from 'react-native-maps';
import MapPlaceholder from '../MapPlaceholder';
import { MAPS_ENABLED_NATIVE } from '../../../config/maps';
import { AddressMapPickerProps } from './AddressMapPicker.types';

// Native implementation (iOS/Android) -- Metro resolves the bare
// './AddressMapPicker' import to this file on those platforms and to
// AddressMapPicker.web.tsx on web, same convention as services/phoneAuth.ts
// / phoneAuth.web.ts elsewhere in this app. Gated on MAPS_ENABLED_NATIVE, not
// the web MAPS_ENABLED -- see config/maps.ts for why they're separate keys.

const DEFAULT_REGION = { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 8, longitudeDelta: 8 };
const PIN_DELTA = 0.01;

export default function AddressMapPicker({ latitude, longitude, onChange, height = 200 }: AddressMapPickerProps) {
  if (!MAPS_ENABLED_NATIVE) {
    return <MapPlaceholder label="Confirm pin location on map" height={height} />;
  }

  const region =
    latitude != null && longitude != null
      ? { latitude, longitude, latitudeDelta: PIN_DELTA, longitudeDelta: PIN_DELTA }
      : DEFAULT_REGION;

  const handlePress = (e: MapPressEvent) => {
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
    onChange({ latitude: lat, longitude: lng });
  };

  const handleDragEnd = (e: MarkerDragStartEndEvent) => {
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
    onChange({ latitude: lat, longitude: lng });
  };

  return (
    <View style={[styles.wrapper, { height }]}>
      <MapView provider={PROVIDER_GOOGLE} style={StyleSheet.absoluteFill} region={region} onPress={handlePress}>
        {latitude != null && longitude != null && (
          <Marker coordinate={{ latitude, longitude }} draggable onDragEnd={handleDragEnd} />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderRadius: 12, overflow: 'hidden' },
});
