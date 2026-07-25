import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import MapPlaceholder from '../MapPlaceholder';
import { MAPS_ENABLED } from '../../../config/maps';
import { LiveTrackingMapProps } from './LiveTrackingMap.types';

// Native implementation -- see AddressMapPicker.tsx for the platform-split
// convention this follows. Replaces the old inline
// `Platform.OS !== 'web' && require('react-native-maps')` guard that used to
// live directly in DeliveryTrackingScreen.tsx / ServiceTrackingScreen.tsx.

export default function LiveTrackingMap({ markers, height = 200 }: LiveTrackingMapProps) {
  if (!MAPS_ENABLED) {
    return <MapPlaceholder label={markers[0]?.title || 'Live tracking'} height={height} />;
  }

  const anchor = markers[0];
  const region = {
    latitude: anchor.latitude,
    longitude: anchor.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  return (
    <View style={[styles.wrapper, { height }]}>
      <MapView provider={PROVIDER_GOOGLE} style={StyleSheet.absoluteFill} initialRegion={region} region={region}>
        {markers.map((m, i) => (
          <Marker key={i} coordinate={{ latitude: m.latitude, longitude: m.longitude }} title={m.title} pinColor={m.color} />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderRadius: 12, overflow: 'hidden' },
});
