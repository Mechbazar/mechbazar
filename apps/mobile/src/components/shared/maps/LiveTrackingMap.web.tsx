import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import MapPlaceholder from '../MapPlaceholder';
import { GOOGLE_MAPS_API_KEY, MAPS_ENABLED } from '../../../config/maps';
import { LiveTrackingMapProps } from './LiveTrackingMap.types';

// Web implementation -- previously order/service tracking on the web build
// just showed "Live map is available on the mobile app" instead of a map.

const mapContainerStyle = { width: '100%', height: '100%' };
const mapOptions = { streetViewControl: false, mapTypeControl: false, fullscreenControl: false };

function colorToSymbol(color?: string): google.maps.Symbol | undefined {
  if (!color) return undefined;
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#FFFFFF',
    strokeWeight: 2,
    scale: 8,
  };
}

export default function LiveTrackingMap({ markers, height = 200 }: LiveTrackingMapProps) {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY, id: 'mechbazar-google-maps' });

  if (!MAPS_ENABLED) {
    return <MapPlaceholder label={markers[0]?.title || 'Live tracking'} height={height} />;
  }
  if (!isLoaded) {
    return <View style={[styles.wrapper, { height }]} />;
  }

  const anchor = markers[0];
  const center = { lat: anchor.latitude, lng: anchor.longitude };

  return (
    <View style={[styles.wrapper, { height }]}>
      <GoogleMap mapContainerStyle={mapContainerStyle} center={center} zoom={14} options={mapOptions}>
        {markers.map((m, i) => (
          <MarkerF key={i} position={{ lat: m.latitude, lng: m.longitude }} title={m.title} icon={colorToSymbol(m.color)} />
        ))}
      </GoogleMap>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderRadius: 12, overflow: 'hidden' },
});
