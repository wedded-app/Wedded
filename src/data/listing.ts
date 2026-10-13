/**
 * Vendors edit their own listing (C6c, #194): the fields a vendor's people
 * keep up to date themselves (see the listing_self_edit migration). The name,
 * address, vendor types and publishing stay with the founders.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import { insightKeys } from './business-insights';
import { vendorKeys } from './vendors';

export type PriceDisplay = 'hidden' | 'starting_at' | 'range' | 'packages' | 'contact';
export type PriceUnit = 'event' | 'hour' | 'person' | 'plate' | 'hand' | 'turban' | 'day';
export type ContactMethod = 'call' | 'text' | 'whatsapp' | 'email' | 'instagram';
export type ListingLanguage = 'en' | 'pa' | 'hi' | 'ur';
export type ServiceRadius = 10 | 25 | 50 | 100 | 250;

export type Listing = {
  name: string;
  slug: string;
  status: string;
  city: string;
  tagline: string | null;
  taglinePa: string | null;
  bio: string | null;
  bioPa: string | null;
  priceDisplay: PriceDisplay | null;
  priceFrom: number | null;
  priceTo: number | null;
  priceUnit: PriceUnit | null;
  priceNote: string | null;
  /** E.164, US numbers */
  callPhone: string | null;
  textPhone: string | null;
  /** E.164, any country */
  whatsappPhone: string | null;
  preferredContact: ContactMethod | null;
  /** Without the @ */
  instagramHandle: string | null;
  websiteUrl: string | null;
  languages: ListingLanguage[];
  yearsInBusiness: number | null;
  teamSize: number | null;
  serviceRadiusMiles: ServiceRadius | null;
  willTravel: boolean;
  travelNote: string | null;
  officeHours: string | null;
};

/** What a vendor can change; null clears a field. */
export type ListingChanges = Partial<Omit<Listing, 'name' | 'slug' | 'status' | 'city'>>;
export type ListingField = keyof ListingChanges;

export const listingKeys = {
  mine: (vendorId: string) => ['listing', vendorId] as const,
};

/** The listing as the database returns it, with gaps filled. */
export function toListing(raw: Record<string, unknown>): Listing {
  const listing = raw as unknown as Listing;
  return {
    ...listing,
    languages: Array.isArray(raw.languages) ? (raw.languages as ListingLanguage[]) : [],
    willTravel: raw.willTravel === true,
  };
}

/**
 * Only the fields that differ from what's saved, so a save never overwrites
 * something it didn't mean to touch. Text is compared trimmed, and an empty
 * text box counts as cleared.
 */
export function listingChanges(saved: Listing, draft: ListingChanges): ListingChanges {
  const changes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(draft) as [ListingField, unknown][]) {
    const normal = typeof value === 'string' ? value.trim() || null : (value ?? null);
    const before = saved[key] ?? null;
    const same = Array.isArray(normal)
      ? Array.isArray(before) && normal.join() === before.join()
      : normal === before;
    if (!same) changes[key] = normal;
  }
  return changes as ListingChanges;
}

export type ListingProblem = {
  /** The field to show the message under, when the database named one */
  field: ListingField | null;
  kind: 'invalid' | 'notAllowed' | 'failed';
};

const FIELDS: ListingField[] = [
  'tagline',
  'taglinePa',
  'bio',
  'bioPa',
  'priceDisplay',
  'priceFrom',
  'priceTo',
  'priceUnit',
  'priceNote',
  'callPhone',
  'textPhone',
  'whatsappPhone',
  'preferredContact',
  'instagramHandle',
  'websiteUrl',
  'languages',
  'yearsInBusiness',
  'teamSize',
  'serviceRadiusMiles',
  'willTravel',
  'travelNote',
  'officeHours',
];

/** Turn a refused save into a field and a kind of message. */
export function listingProblem(error: unknown): ListingProblem {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const invalid = /invalid_field:(\w+)/.exec(message);
  if (invalid) {
    const field = FIELDS.find((f) => f === invalid[1]) ?? null;
    return { field, kind: 'invalid' };
  }
  if (message.includes('not_allowed') || message.includes('not_editable')) {
    return { field: null, kind: 'notAllowed' };
  }
  return { field: null, kind: 'failed' };
}

/** The vendor's editable listing, drafts included. */
export function useMyListing(vendorId: string) {
  return useQuery({
    queryKey: listingKeys.mine(vendorId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_listing', { p_vendor_id: vendorId });
      if (error) throw error;
      return toListing(data as Record<string, unknown>);
    },
    enabled: vendorId.length > 0,
  });
}

/**
 * Save some fields (pass listingChanges(saved, draft)). On success the
 * listing, the public page and the checklist all refresh.
 */
export function useUpdateListing(vendorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (changes: ListingChanges) => {
      const { data, error } = await supabase.rpc('update_my_listing', {
        p_vendor_id: vendorId,
        p_changes: changes,
      });
      if (error) throw new Error(error.message);
      return toListing(data as Record<string, unknown>);
    },
    onSuccess: (listing) => {
      queryClient.setQueryData(listingKeys.mine(vendorId), listing);
      void queryClient.invalidateQueries({ queryKey: vendorKeys.profile(listing.slug) });
      void queryClient.invalidateQueries({ queryKey: insightKeys.checklist(vendorId) });
    },
  });
}
