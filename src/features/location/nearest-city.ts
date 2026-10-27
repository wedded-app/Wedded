import type { City, Place } from '@/data/places';

const EARTH_RADIUS_MILES = 3958.8;

/** Further than this from every city we know means outside Northern California. */
export const MAX_MILES_TO_A_CITY = 75;

/** Great-circle distance in miles. */
export function milesBetween(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(toLatitude - fromLatitude);
  const dLng = toRadians(toLongitude - fromLongitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(fromLatitude)) * Math.cos(toRadians(toLatitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

/** The closest of our cities to a point, and how far it is. */
export function nearestCity(
  cities: City[],
  latitude: number,
  longitude: number,
): { city: City; miles: number } | null {
  let best: { city: City; miles: number } | null = null;
  for (const city of cities) {
    const miles = milesBetween(latitude, longitude, city.latitude, city.longitude);
    if (!best || miles < best.miles) best = { city, miles };
  }
  return best;
}

/**
 * The town to fill in for "Where?" on an ask or a request: the closest of our
 * cities to where they're searching (a city, ZIP or area code), so it isn't
 * the profile's city when they're planning somewhere else (#352).
 */
export function townNear(place: Place | null, cities: City[]): string | null {
  const nearest = place && nearestCity(cities, place.latitude, place.longitude);
  return nearest && nearest.miles <= MAX_MILES_TO_A_CITY ? nearest.city.name : null;
}
