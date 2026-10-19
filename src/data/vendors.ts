/**
 * Vendor data for browsing: category counts and one vendor's profile. Only
 * published vendors come back: row level security hides the rest. Listings
 * come from useVendorSearch() in src/data/search.ts, which sorts by distance.
 */
import { useQueries, useQuery } from '@tanstack/react-query';

import type { PriceUnit } from '@/components/vendor-card';
import { asLocalizedText, type LocalizedText } from '@/i18n/localized';
import { supabase } from '@/lib/supabase';

export const vendorKeys = {
  all: ['vendors'] as const,
  categoryCounts: () => [...vendorKeys.all, 'category-counts'] as const,
  profile: (slug: string) => [...vendorKeys.all, 'profile', slug] as const,
  founding: () => [...vendorKeys.all, 'founding'] as const,
};

async function fetchCategoryVendorCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('categories')
    .select('slug, vendor_categories(count)');
  if (error) throw error;
  return Object.fromEntries(data.map((row) => [row.slug, row.vendor_categories[0]?.count ?? 0]));
}

/** How many published vendors each category has, by category slug. */
export function useCategoryVendorCounts() {
  return useQuery({ queryKey: vendorKeys.categoryCounts(), queryFn: fetchCategoryVendorCounts });
}

// Profile (S9) ------------------------------------------------------------

const PRICE_UNITS: readonly PriceUnit[] = [
  'event',
  'hour',
  'person',
  'plate',
  'hand',
  'turban',
  'day',
];

export type VendorPrice =
  | { kind: 'starting_at'; amount: number; unit?: PriceUnit }
  | { kind: 'range'; from: number; to: number; unit?: PriceUnit }
  | { kind: 'packages' }
  | { kind: 'contact' };

/** Hall facts from venue_policies and venue_rooms; each is missing when the hall didn't say. */
export type HallFacts = {
  /** The biggest room's seats. */
  seatedCapacity?: number;
  /** yes, approved_list or no */
  outsideCatering?: string;
  /** full_bar, beer_wine, byob or dry */
  alcoholPolicy?: string;
  /** Corkage fee in dollars, with byob. */
  corkage?: number;
  ghoriAllowed?: boolean;
  /** "01:00", 24-hour. */
  curfew?: string;
  parkingSpaces?: number;
};

export type VendorProfile = {
  id: string;
  slug: string;
  name: LocalizedText;
  tagline: string | null;
  bio: string | null;
  city: string;
  /** Only halls, shops and gurdwaras have one; home-based vendors never do. */
  addressLine: string | null;
  serviceRadiusMiles: number;
  willTravel: boolean;
  travelNote: string | null;
  callPhone: string | null;
  textPhone: string | null;
  whatsappPhone: string | null;
  instagramHandle: string | null;
  websiteUrl: string | null;
  /** The languages they speak, in the founders' order. */
  languages: LocalizedText[];
  /** Null when pricing is hidden. */
  price: VendorPrice | null;
  priceNote: string | null;
  foundingNumber: number | null;
  /** A demo sample, not a real business: show the Sample tag. */
  isSample: boolean;
  facts: HallFacts;
  /** Up to 3, primary first. */
  categories: { slug: string; name: LocalizedText; groupSlug: string }[];
};

/** The listed price in whole dollars (the database keeps cents). */
function priceOf(row: {
  price_display: string;
  price_from_cents: number | null;
  price_to_cents: number | null;
  price_unit: string | null;
}): VendorPrice | null {
  const unit = PRICE_UNITS.find((u) => u === row.price_unit);
  const from = row.price_from_cents === null ? null : row.price_from_cents / 100;
  const to = row.price_to_cents === null ? null : row.price_to_cents / 100;
  switch (row.price_display) {
    case 'starting_at':
      return from ? { kind: 'starting_at', amount: from, unit } : null;
    case 'range':
      return from && to ? { kind: 'range', from, to, unit } : null;
    case 'packages':
      return { kind: 'packages' };
    case 'contact':
      return { kind: 'contact' };
    default:
      return null;
  }
}

type PolicyRow = {
  outside_catering: string | null;
  alcohol_policy: string | null;
  corkage_cents: number | null;
  ghori_allowed: boolean | null;
  music_curfew: string | null;
  parking_spaces: number | null;
};

function factsOf(policies: PolicyRow | null, rooms: { seated: number | null }[]): HallFacts {
  const seats = rooms.flatMap((room) => (room.seated === null ? [] : [room.seated]));
  return {
    seatedCapacity: seats.length > 0 ? Math.max(...seats) : undefined,
    outsideCatering: policies?.outside_catering ?? undefined,
    alcoholPolicy: policies?.alcohol_policy ?? undefined,
    corkage: policies?.corkage_cents == null ? undefined : policies.corkage_cents / 100,
    ghoriAllowed: policies?.ghori_allowed ?? undefined,
    // "01:00:00" from the database; the screens take "01:00"
    curfew: policies?.music_curfew?.slice(0, 5) ?? undefined,
    parkingSpaces: policies?.parking_spaces ?? undefined,
  };
}

async function fetchVendor(slug: string): Promise<VendorProfile | null> {
  const { data, error } = await supabase
    .from('vendors')
    .select(
      'id, slug, name, tagline, bio, base_city:cities(name), public_address, service_radius_miles, will_travel, travel_fee_note, vendor_contacts(kind, value), vendor_languages(language:languages(name, sort_order)), price_display, price_from_cents, price_to_cents, price_unit, price_note, founding_number, is_sample, venue_policies(outside_catering, alcohol_policy, corkage_cents, ghori_allowed, music_curfew, parking_spaces), venue_rooms(seated), vendor_categories(position, category:categories(slug, name, group_slug))',
    )
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const contact = (kind: string) =>
    data.vendor_contacts.find((c) => c.kind === kind)?.value ?? null;
  return {
    id: data.id,
    slug: data.slug,
    name: { en: data.name },
    tagline: data.tagline,
    bio: data.bio,
    city: data.base_city.name,
    addressLine: data.public_address,
    serviceRadiusMiles: data.service_radius_miles,
    willTravel: data.will_travel,
    travelNote: data.travel_fee_note,
    callPhone: contact('call'),
    textPhone: contact('text'),
    whatsappPhone: contact('whatsapp'),
    instagramHandle: contact('instagram'),
    websiteUrl: contact('website'),
    languages: [...data.vendor_languages]
      .sort((a, b) => a.language.sort_order - b.language.sort_order)
      .map((l) => asLocalizedText(l.language.name) ?? { en: '' }),
    price: priceOf(data),
    priceNote: data.price_note,
    foundingNumber: data.founding_number,
    isSample: data.is_sample,
    facts: factsOf(data.venue_policies, data.venue_rooms),
    categories: [...data.vendor_categories]
      .sort((a, b) => a.position - b.position)
      .map((link) => ({
        slug: link.category.slug,
        name: asLocalizedText(link.category.name) ?? { en: link.category.slug },
        groupSlug: link.category.group_slug,
      })),
  };
}

/** Several vendors' profiles at once, in the order given (Compare). */
export function useVendors(slugs: string[]) {
  return useQueries({
    queries: slugs.map((slug) => ({
      queryKey: vendorKeys.profile(slug),
      queryFn: () => fetchVendor(slug),
      enabled: slug.length > 0,
    })),
  });
}

/** One published vendor's profile, or null when no published vendor has that slug. */
export function useVendor(slug: string) {
  return useQuery({
    queryKey: vendorKeys.profile(slug),
    queryFn: () => fetchVendor(slug),
    enabled: slug.length > 0,
  });
}

// Founding Wall -------------------------------------------------------------

export type FoundingVendor = {
  slug: string;
  foundingNumber: number;
  name: LocalizedText;
  city: string;
  /** A demo sample, not a real business: show the Sample tag. */
  isSample: boolean;
  /** Their primary category. */
  category: LocalizedText | null;
};

async function fetchFoundingVendors(): Promise<FoundingVendor[]> {
  const { data, error } = await supabase
    .from('vendors')
    .select(
      'slug, name, base_city:cities(name), founding_number, is_sample, vendor_categories(position, category:categories(slug, name))',
    )
    .not('founding_number', 'is', null)
    .order('founding_number');
  if (error) throw error;
  return data.flatMap((row) => {
    if (row.founding_number === null) return [];
    const primary = [...row.vendor_categories].sort((a, b) => a.position - b.position)[0];
    return [
      {
        slug: row.slug,
        foundingNumber: row.founding_number,
        name: { en: row.name },
        city: row.base_city.name,
        isSample: row.is_sample,
        category: primary ? asLocalizedText(primary.category.name) : null,
      },
    ];
  });
}

/** Published vendors with a founding number, in the order they joined. */
export function useFoundingVendors() {
  return useQuery({ queryKey: vendorKeys.founding(), queryFn: fetchFoundingVendors });
}
