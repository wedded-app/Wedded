/**
 * Places for the location sheet (vision S22a): area-code chips, the NorCal
 * city list for typeahead, and ZIP code lookup. All come from the database
 * (no geocoding API) and change rarely, so they're cached for a day.
 */
import { useQuery } from '@tanstack/react-query';

import { asLocalizedText, type LocalizedText } from '@/i18n/localized';
import { supabase } from '@/lib/supabase';

const DAY = 24 * 60 * 60 * 1000;
const PLACES = { staleTime: DAY, gcTime: DAY } as const;

export const placeKeys = {
  all: ['places'] as const,
  cities: () => [...placeKeys.all, 'cities'] as const,
  areaCodes: () => [...placeKeys.all, 'area-codes'] as const,
  zip: (zip: string) => [...placeKeys.all, 'zip', zip] as const,
};

/** A point to search around: what search_vendors takes. */
export type Place = {
  /** What to show on the location chip, e.g. "Yuba City", "530 · Yuba City", "ZIP 95993". */
  label: string;
  latitude: number;
  longitude: number;
};

export type City = Place & {
  slug: string;
  name: string;
  areaCode: string;
  nicknames: string[];
};

export type AreaCode = {
  code: string;
  label: LocalizedText;
  radiusMiles: number;
  latitude: number;
  longitude: number;
};

async function fetchCities(): Promise<City[]> {
  const { data, error } = await supabase
    .from('cities')
    .select('slug, name, area_code, nicknames, latitude, longitude')
    .order('name');
  if (error) throw error;
  return data.map((row) => ({
    slug: row.slug,
    name: row.name,
    label: row.name,
    areaCode: row.area_code,
    nicknames: row.nicknames,
    latitude: row.latitude,
    longitude: row.longitude,
  }));
}

/** Every NorCal city, A to Z. */
export function useCities() {
  return useQuery({ queryKey: placeKeys.cities(), queryFn: fetchCities, ...PLACES });
}

async function fetchAreaCodes(): Promise<AreaCode[]> {
  const { data, error } = await supabase
    .from('area_codes')
    .select('code, label, radius_miles, city:cities!inner(latitude, longitude)')
    .order('sort_order');
  if (error) throw error;
  return data.map((row) => ({
    code: row.code,
    label: asLocalizedText(row.label) ?? { en: row.code },
    radiusMiles: row.radius_miles,
    latitude: row.city.latitude,
    longitude: row.city.longitude,
  }));
}

/** The area-code chips (510 · East Bay, 530 · Yuba City...), in display order. */
export function useAreaCodes() {
  return useQuery({ queryKey: placeKeys.areaCodes(), queryFn: fetchAreaCodes, ...PLACES });
}

/**
 * A California ZIP code's centre point, labelled with its nearest listed city
 * when there is one ("Yuba City 95993"), or null when it isn't a California
 * ZIP (show "We're Northern California only for now").
 */
export async function findZip(zip: string): Promise<Place | null> {
  if (!/^\d{5}$/.test(zip)) return null;
  const { data, error } = await supabase
    .from('zip_codes')
    .select('zip, latitude, longitude, city:cities(name)')
    .eq('zip', zip)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const label = data.city ? `${data.city.name} ${data.zip}` : `ZIP ${data.zip}`;
  return { label, latitude: data.latitude, longitude: data.longitude };
}

/**
 * Cities matching what someone typed, best first: names that start with it,
 * then nicknames (sj, sac, yuba), then names that contain it.
 */
export function matchCities(cities: City[], typed: string, limit = 8): City[] {
  const text = typed.trim().toLowerCase();
  if (!text) return [];
  const starts = cities.filter((city) => city.name.toLowerCase().startsWith(text));
  const nicknames = cities.filter(
    (city) =>
      !starts.includes(city) && city.nicknames.some((nickname) => nickname.startsWith(text)),
  );
  const contains = cities.filter(
    (city) =>
      !starts.includes(city) && !nicknames.includes(city) && city.name.toLowerCase().includes(text),
  );
  return [...starts, ...nicknames, ...contains].slice(0, limit);
}
