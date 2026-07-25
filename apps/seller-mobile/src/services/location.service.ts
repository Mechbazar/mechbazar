import * as Location from 'expo-location';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

// Only what the store-location picker needs (see components/maps/) --
// mirrors apps/mobile/src/services/location.service.ts, minus getDistance
// which nothing here uses.
export async function getCurrentLocation(): Promise<LocationCoordinates | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: location.coords.latitude, longitude: location.coords.longitude };
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
}
