import * as Location from 'expo-location';
import { riderService } from '@mechbazar/shared';

// One-shot permission + ping helper. Called on an interval by HomeScreen
// while the rider is online — there's no backend support for continuous
// background tracking (no ping endpoint existed before this build, and
// still no background-task wiring), so this only updates while the app is
// open and foregrounded.
//
// Returns whether the ping actually reached the server, so callers can warn
// the rider once instead of silently leaving them "Available" with location
// sharing permission denied (the toggle itself doesn't depend on this and
// would otherwise flip on with no indication nothing is being shared).
export async function pingLocationOnce(): Promise<{ ok: boolean; permissionDenied: boolean }> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    let granted = status === 'granted';
    if (!granted) {
      const req = await Location.requestForegroundPermissionsAsync();
      granted = req.status === 'granted';
    }
    if (!granted) return { ok: false, permissionDenied: true };

    const position = await Location.getCurrentPositionAsync({});
    await riderService.updateLocation(position.coords.latitude, position.coords.longitude);
    return { ok: true, permissionDenied: false };
  } catch (error) {
    console.error('Location ping failed:', error);
    return { ok: false, permissionDenied: false };
  }
}
