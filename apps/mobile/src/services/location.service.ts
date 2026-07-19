import * as Location from 'expo-location';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodedAddress {
  name: string | null;
  street: string | null;
  city: string | null;
  region: string | null; // State
  postalCode: string | null;
  country: string | null;
  formattedAddress: string;
}

class LocationService {
  /**
   * Request foreground location permission.
   * Returns true if permission is granted, false otherwise.
   */
  async requestPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  }

  /**
   * Get the user's current coordinates.
   * Returns LocationCoordinates or null if failed.
   */
  async getCurrentLocation(): Promise<LocationCoordinates | null> {
    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        console.warn('Location permission not granted');
        return null;
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  /**
   * Reverse geocode a set of coordinates to a human-readable address.
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodedAddress | null> {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results && results.length > 0) {
        const address = results[0];
        
        // Build a nice formatted address string
        const parts = [
          address.name || address.street,
          address.district,
          address.city,
          address.region,
          address.postalCode
        ].filter(Boolean);
        
        const formattedAddress = parts.join(', ');
        
        return {
          name: address.name,
          street: address.street,
          city: address.city,
          region: address.region,
          postalCode: address.postalCode,
          country: address.country,
          formattedAddress: formattedAddress || 'Unknown Location',
        };
      }
      return null;
    } catch (error) {
      console.error('Error in reverse geocoding:', error);
      return null;
    }
  }

  /**
   * Calculate distance between two coordinates using the Haversine formula (in kilometers).
   */
  getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return parseFloat(d.toFixed(2));
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export const locationService = new LocationService();
export default locationService;
