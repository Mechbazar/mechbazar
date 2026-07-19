import * as Location from 'expo-location';
import { technicianService } from '@mechbazar/shared';

// One-shot permission + ping helper. Called on an interval by HomeScreen
// while the technician is online — there's no backend support for
// continuous background tracking, so this only updates while the app is
// open and foregrounded.
export async function pingLocationOnce(): Promise<void> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    let granted = status === 'granted';
    if (!granted) {
      const req = await Location.requestForegroundPermissionsAsync();
      granted = req.status === 'granted';
    }
    if (!granted) return;

    const position = await Location.getCurrentPositionAsync({});
    await technicianService.updateLocation(position.coords.latitude, position.coords.longitude);
  } catch (error) {
    console.error('Location ping failed:', error);
  }
}
