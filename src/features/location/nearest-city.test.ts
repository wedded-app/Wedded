import type { City } from '@/data/places';

import { milesBetween, nearestCity } from './nearest-city';

const city = (name: string, latitude: number, longitude: number): City => ({
  slug: name.toLowerCase().replace(/ /g, '-'),
  name,
  label: name,
  areaCode: '000',
  nicknames: [],
  latitude,
  longitude,
});

// US Census 2024 points, as in public.cities
const yubaCity = city('Yuba City', 39.129842, -121.641549);
const sacramento = city('Sacramento', 38.566826, -121.468571);
const fremont = city('Fremont', 37.528095, -121.984003);

describe('milesBetween', () => {
  it('matches known distances', () => {
    expect(milesBetween(39.129842, -121.641549, 38.566826, -121.468571)).toBeCloseTo(40, -1);
    expect(milesBetween(39.1, -121.6, 39.1, -121.6)).toBe(0);
  });
});

describe('nearestCity', () => {
  it('finds the closest city and how far it is', () => {
    const result = nearestCity([sacramento, yubaCity, fremont], 39.14, -121.62);
    expect(result?.city.name).toBe('Yuba City');
    expect(result?.miles).toBeLessThan(2);
  });

  it('says how far the closest city is, even when that is far away', () => {
    const newYork = nearestCity([sacramento, yubaCity, fremont], 40.75, -73.99);
    expect(newYork?.miles).toBeGreaterThan(2000);
  });

  it('returns nothing without cities', () => {
    expect(nearestCity([], 39, -121)).toBeNull();
  });
});
