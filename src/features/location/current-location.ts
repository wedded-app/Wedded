import * as Location from 'expo-location';

import type { City } from '@/data/places';

import { MAX_MILES_TO_A_CITY, nearestCity } from './nearest-city';

export type LocateResult =
  | { kind: 'found'; city: City }
  | { kind: 'denied' }
  | { kind: 'outside' }
  | { kind: 'unavailable' };

/** True when they already said yes, so the explanation screen can be skipped. */
export async function hasLocationPermission(): Promise<boolean> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === 'granted';
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * "Use my current location" (vision S22a/S22b). Asks the phone once, with low
 * accuracy (about a kilometre), and turns the answer into the nearest of our
 * cities. Only that city is used and remembered, never the phone's position,
 * which is what the permission text promises.
 */
export async function locateNearestCity(cities: City[]): Promise<LocateResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { kind: 'denied' };

    let position = await Location.getLastKnownPositionAsync({
      maxAge: 10 * 60 * 1000,
      requiredAccuracy: 3000,
    });
    if (!position) {
      position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
        15000,
      );
    }
    if (!position) return { kind: 'unavailable' };

    const nearest = nearestCity(cities, position.coords.latitude, position.coords.longitude);
    if (!nearest || nearest.miles > MAX_MILES_TO_A_CITY) return { kind: 'outside' };
    return { kind: 'found', city: nearest.city };
  } catch {
    // Location services off, or no fix indoors
    return { kind: 'unavailable' };
  }
}
