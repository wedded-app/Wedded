/**
 * Saved vendors (vision S15): the heart on vendor cards and profiles, and the
 * Saved tab grouped by event. Saving needs an account, so a logged-out tap
 * opens sign-in and saves once they finish (requireSignIn). A save without an
 * event (from Search or a vendor profile) asks "Save to which event?" first.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import type { PriceUnit } from '@/components/vendor-card';
import { useSession } from '@/features/auth/session';
import { asLocalizedText, type LocalizedText } from '@/i18n/localized';
import { supabase } from '@/lib/supabase';

import { photoUrl } from './vendor-media';

export const savedKeys = {
  all: ['saved'] as const,
  list: (userId: string) => [...savedKeys.all, userId] as const,
};

export type SavedVendor = {
  /** The save itself: remove it with this id. */
  id: string;
  vendorId: string;
  /** The event it's saved for; null means "Not sure yet". */
  eventSlug: string | null;
  /** What the card shows; null when the vendor is no longer listed. */
  vendor: {
    slug: string;
    name: LocalizedText;
    city: string;
    /** A demo sample, not a real business. */
    isSample: boolean;
    category: LocalizedText | null;
    startingPrice: { amount: number; unit?: PriceUnit } | null;
    /** Small cover photo, or null when they have none. */
    photoUrl: string | null;
  } | null;
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

function isPriceUnit(value: string | null): value is PriceUnit {
  return value !== null && PRICE_UNITS.includes(value);
}

/** The cover photo (or first photo) as a small URL. */
function coverOf(media: { storage_path: string; is_cover: boolean; sort_order: number }[]) {
  const [first] = [...media].sort(
    (a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order,
  );
  return first ? photoUrl(first.storage_path, 'small') : null;
}

async function fetchSaved(): Promise<SavedVendor[]> {
  const { data, error } = await supabase
    .from('saved_vendors')
    .select(
      'id, vendor_id, event_slug, vendor:vendors(slug, name, city, is_sample, price_display, price_from, price_unit, vendor_categories(position, category:categories(name)), vendor_media!vendor_media_vendor_id_fkey(storage_path, is_cover, sort_order))',
    )
    .order('created_at', { ascending: false });
  if (error) throw error;

  return data.map((row) => {
    const vendor = row.vendor;
    if (!vendor) {
      return { id: row.id, vendorId: row.vendor_id, eventSlug: row.event_slug, vendor: null };
    }
    const primary = [...vendor.vendor_categories].sort((a, b) => a.position - b.position)[0];
    const from = vendor.price_from;
    const showsPrice =
      from !== null && (vendor.price_display === 'starting_at' || vendor.price_display === 'range');
    return {
      id: row.id,
      vendorId: row.vendor_id,
      eventSlug: row.event_slug,
      vendor: {
        slug: vendor.slug,
        photoUrl: coverOf(vendor.vendor_media),
        name: { en: vendor.name },
        city: vendor.city,
        isSample: vendor.is_sample,
        category: primary ? asLocalizedText(primary.category?.name) : null,
        startingPrice: showsPrice
          ? { amount: from, unit: isPriceUnit(vendor.price_unit) ? vendor.price_unit : undefined }
          : null,
      },
    };
  });
}

/** The signed-in person's saves, newest first. Disabled when signed out. */
export function useSavedVendors() {
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  return useQuery({
    queryKey: savedKeys.list(userId),
    queryFn: fetchSaved,
    enabled: userId.length > 0,
  });
}

/** The events this vendor is saved for (null = Not sure yet); empty when not saved. */
export function useSavedEventsFor(vendorId: string): (string | null)[] {
  const { data } = useSavedVendors();
  return (data ?? []).filter((save) => save.vendorId === vendorId).map((save) => save.eventSlug);
}

/**
 * Save and remove. `toggleSave` is what a heart button calls:
 * - with an event (from an event page or results): saves or removes the
 *   vendor for that event
 * - without one: removes every save of the vendor, or asks which event to
 *   save for
 * Logged out, it opens sign-in first and then saves.
 */
export function useSaveVendor() {
  const queryClient = useQueryClient();
  const { requireSignIn } = useSession();
  const { data: saves } = useSavedVendors();

  const refresh = () => queryClient.invalidateQueries({ queryKey: savedKeys.all });

  const add = useMutation({
    mutationFn: async ({ vendorId, eventSlug }: { vendorId: string; eventSlug: string | null }) => {
      const { error } = await supabase
        .from('saved_vendors')
        .insert({ vendor_id: vendorId, event_slug: eventSlug });
      // 23505: already saved for that event (a double tap). Nothing to do.
      if (error && error.code !== '23505') throw error;
    },
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: async (saveId: string) => {
      const { error } = await supabase.from('saved_vendors').delete().eq('id', saveId);
      if (error) throw error;
    },
    onSettled: refresh,
  });

  function toggleSave(vendorId: string, eventSlug?: string | null) {
    const matching = (saves ?? []).filter(
      (save) =>
        save.vendorId === vendorId && (eventSlug === undefined || save.eventSlug === eventSlug),
    );
    requireSignIn(() => {
      if (matching.length > 0) {
        matching.forEach((save) => remove.mutate(save.id));
      } else if (eventSlug === undefined) {
        router.push({ pathname: '/save-vendor', params: { vendorId } });
      } else {
        add.mutate({ vendorId, eventSlug });
      }
    });
  }

  return {
    toggleSave,
    /** Save for a chosen event (the "Save to which event?" screen). */
    saveFor: add.mutateAsync,
    removeSave: remove.mutate,
    saving: add.isPending,
  };
}
