import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import MapPlaceholder from '../MapPlaceholder';
import { MAPS_ENABLED_NATIVE } from '../../../config/maps';
import { LiveTrackingMapProps } from './LiveTrackingMap.types';
import { decodePolyline } from './decodePolyline';

// Native implementation -- see AddressMapPicker.tsx for the platform-split
// convention this follows. Replaces the old inline
// `Platform.OS !== 'web' && require('react-native-maps')` guard that used to
// live directly in DeliveryTrackingScreen.tsx / ServiceTrackingScreen.tsx.
// Gated on MAPS_ENABLED_NATIVE, not the web MAPS_ENABLED -- see config/maps.ts.

export default function LiveTrackingMap({ markers, height = 200, routePolyline, routeColor }: LiveTrackingMapProps) {
  if (!MAPS_ENABLED_NATIVE) {
    return <MapPlaceholder label={markers[0]?.title || 'Live tracking'} height={height} />;
  }

  const anchor = markers[0];
  const region = {
    latitude: anchor.latitude,
    longitude: anchor.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };
  const routeCoords = routePolyline ? decodePolyline(routePolyline) : null;

  return (
    <View style={[styles.wrapper, { height }]}>
      <MapView provider={PROVIDER_GOOGLE} style={StyleSheet.absoluteFill} initialRegion={region} region={region}>
        {markers.map((m, i) => (
          <Marker key={i} coordinate={{ latitude: m.latitude, longitude: m.longitude }} title={m.title} pinColor={m.color} />
        ))}
        {routeCoords && routeCoords.length > 1 && (
          <Polyline coordinates={routeCoords} strokeColor={routeColor || '#DA3830'} strokeWidth={4} />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderRadius: 12, overflow: 'hidden' },
});
