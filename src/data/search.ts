/**
 * Vendor search (vision §8 "Location search", S6 results): one call to the
 * search_vendors database function. It returns published vendors near a
 * point, sorted by distance, and includes vendors whose own service radius
 * covers the searcher. Without a point it still returns results, with no
 * distance.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import type { PriceUnit } from '@/components/vendor-card';
import type { SearchFilters } from '@/features/search/search-filters';
import { asLocalizedText, type LocalizedText } from '@/i18n/localized';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

import { photoUrl } from './vendor-media';

type SearchFunction = Database['public']['Functions']['search_vendors'];
type Nullable<T> = { [K in keyof T]: T[K] | null };

export type VendorSearch = {
  /** Where to search from; leave both out for no location. */
  latitude?: number | null;
  longitude?: number | null;
  /** 10, 25, 50 or 100; null means anywhere. Defaults to 25. */
  maxMiles?: number | null;
  categorySlug?: string;
  eventSlug?: string;
  /** Free text: vendor names and category names or synonyms, English or Gurmukhi. */
  query?: string;
  /** Also vendors who travel beyond their radius ("Show vendors who travel to you"). */
  includeTravelers?: boolean;
  /** Guest capacity, price ceiling, language and order (the /filters sheet). */
  filters?: SearchFilters;
  /** At most 100. */
  limit?: number;
  offset?: number;
};

export type VendorResult = {
  id: string;
  slug: string;
  /** Ready for VendorCard. */
  name: LocalizedText;
  city: string;
  categorySlug: string | null;
  category: LocalizedText | null;
  startingPrice: { amount: number; unit?: PriceUnit } | null;
  foundingNumber: number | null;
  /** Null without a search point. */
  distanceMiles: number | null;
  /** False for vendors outside your radius who travel to you. Null without a point. */
  withinSearchRadius: boolean | null;
  latitude: number;
  longitude: number;
  /** Small cover photo for VendorCard, or null when they have no photos yet. */
  photoUrl: string | null;
  /** The cover's storage path, for a bigger size (photoUrl(coverPath, 'medium')). */
  coverPath: string | null;
};

const PRICE_UNITS: readonly string[] = [
  'event',
  'hour',
  'person',
  'plate',
  'hand',
  'turban',
  'day',
] satisfies PriceUnit[];

export const searchKeys = {
  all: ['vendor-search'] as const,
  search: (params: VendorSearch) => [...searchKeys.all, params] as const,
};

export async function searchVendors(params: VendorSearch): Promise<VendorResult[]> {
  // The generated types can't express null arguments; null max_miles means anywhere.
  const args = {
    lat: params.latitude ?? undefined,
    lng: params.longitude ?? undefined,
    max_miles: params.maxMiles === undefined ? 25 : params.maxMiles,
    category_slug: params.categorySlug,
    event_slug: params.eventSlug,
    query: params.query,
    include_travelers: params.includeTravelers ?? false,
    result_limit: params.limit ?? 50,
    result_offset: params.offset ?? 0,
    min_guests: params.filters?.minGuests ?? undefined,
    max_price: params.filters?.maxPrice ?? undefined,
    language: params.filters?.language ?? undefined,
    available_on: params.filters?.availableOn ?? undefined,
    sort: params.filters?.sort ?? 'distance',
  } as SearchFunction['Args'];

  const { data, error } = await supabase.rpc('search_vendors', args);
  if (error) throw error;

  // Function results come back typed as non-null; several columns can be null.
  return (data as Nullable<SearchFunction['Returns'][number]>[]).map((row) => {
    const from = row.price_from;
    const unit = row.price_unit;
    const showsPrice =
      from !== null && (row.price_display === 'starting_at' || row.price_display === 'range');
    return {
      id: row.id ?? '',
      slug: row.slug ?? '',
      name: row.name_pa ? { en: row.name ?? '', pa: row.name_pa } : { en: row.name ?? '' },
      city: row.city ?? '',
      categorySlug: row.primary_category_slug,
      category: asLocalizedText(row.primary_category_name),
      startingPrice: showsPrice
        ? {
            amount: from,
            unit: unit !== null && PRICE_UNITS.includes(unit) ? (unit as PriceUnit) : undefined,
          }
        : null,
      foundingNumber: row.founding_number,
      distanceMiles: row.distance_miles,
      withinSearchRadius: row.within_search_radius,
      latitude: row.latitude ?? 0,
      longitude: row.longitude ?? 0,
      photoUrl: row.cover_path ? photoUrl(row.cover_path, 'small') : null,
      coverPath: row.cover_path,
    };
  });
}

/** Search results for a results list; refetches when any parameter changes. */
export function useVendorSearch(
  params: VendorSearch,
  options?: {
    enabled?: boolean;
    /** Keep showing the last results while new ones load (search as you type). */
    keepPrevious?: boolean;
  },
) {
  return useQuery({
    queryKey: searchKeys.search(params),
    queryFn: () => searchVendors(params),
    enabled: options?.enabled ?? true,
    placeholderData: options?.keepPrevious ? keepPreviousData : undefined,
  });
}
