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

/** Hall facts from vendors.details; each is missing when the vendor didn't say. */
export type HallFacts = {
  seatedCapacity?: number;
  /** yes, approved_list or no */
  outsideCatering?: string;
  /** byob, full_bar or none */
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
  /** Vendor-written pairs: show with vendorText(en, pa, locale). */
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
  /** Language codes: en, pa, hi, ur. */
  languages: string[];
  /** Null when pricing is hidden. */
  price: VendorPrice | null;
  priceNote: string | null;
  foundingNumber: number | null;
  facts: HallFacts;
  /** Up to 3, primary first. */
  categories: { slug: string; name: LocalizedText; groupSlug: string }[];
};

function priceOf(row: {
  price_display: string;
  price_from: number | null;
  price_to: number | null;
  price_unit: string | null;
}): VendorPrice | null {
  const unit = PRICE_UNITS.find((u) => u === row.price_unit);
  switch (row.price_display) {
    case 'starting_at':
      return row.price_from ? { kind: 'starting_at', amount: row.price_from, unit } : null;
    case 'range':
      return row.price_from && row.price_to
        ? { kind: 'range', from: row.price_from, to: row.price_to, unit }
        : null;
    case 'packages':
      return { kind: 'packages' };
    case 'contact':
      return { kind: 'contact' };
    default:
      return null;
  }
}

function factsOf(details: unknown): HallFacts {
  if (typeof details !== 'object' || details === null || Array.isArray(details)) return {};
  const d = details as Record<string, unknown>;
  const num = (value: unknown) => (typeof value === 'number' ? value : undefined);
  const str = (value: unknown) => (typeof value === 'string' ? value : undefined);
  return {
    seatedCapacity: num(d.seated_capacity),
    outsideCatering: str(d.outside_catering),
    alcoholPolicy: str(d.alcohol_policy),
    corkage: num(d.corkage),
    ghoriAllowed: typeof d.ghori_allowed === 'boolean' ? d.ghori_allowed : undefined,
    curfew: str(d.curfew),
    parkingSpaces: num(d.parking_spaces),
  };
}

async function fetchVendor(slug: string): Promise<VendorProfile | null> {
  const { data, error } = await supabase
    .from('vendors')
    .select(
      'id, slug, name, tagline, bio, city, address_line, service_radius_miles, will_travel, travel_note, call_phone, text_phone, whatsapp_phone, instagram_handle, website_url, languages, price_display, price_from, price_to, price_unit, price_note, founding_number, details, vendor_categories(position, category:categories(slug, name, group_slug))',
    )
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    slug: data.slug,
    name: { en: data.name },
    tagline: data.tagline,
    bio: data.bio,
    city: data.city,
    addressLine: data.address_line,
    serviceRadiusMiles: data.service_radius_miles,
    willTravel: data.will_travel,
    travelNote: data.travel_note,
    callPhone: data.call_phone,
    textPhone: data.text_phone,
    whatsappPhone: data.whatsapp_phone,
    instagramHandle: data.instagram_handle,
    websiteUrl: data.website_url,
    languages: data.languages,
    price: priceOf(data),
    priceNote: data.price_note,
    foundingNumber: data.founding_number,
    facts: factsOf(data.details),
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
  /** Their primary category. */
  category: LocalizedText | null;
};

async function fetchFoundingVendors(): Promise<FoundingVendor[]> {
  const { data, error } = await supabase
    .from('vendors')
    .select(
      'slug, name, city, founding_number, vendor_categories(position, category:categories(slug, name))',
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
        city: row.city,
        category: primary ? asLocalizedText(primary.category.name) : null,
      },
    ];
  });
}

/** Published vendors with a founding number, in the order they joined. */
export function useFoundingVendors() {
  return useQuery({ queryKey: vendorKeys.founding(), queryFn: fetchFoundingVendors });
}
