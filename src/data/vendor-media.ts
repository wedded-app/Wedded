/**
 * Vendor photos (vision §6, §8 "Media"). Each photo is pre-sized: small (400
 * wide) for grids and cards, medium (1080) for the profile, large (1600) for
 * full screen. Never load a large one in a grid. They're served from the public
 * vendor-media bucket in Supabase, or from AWS CloudFront (infra/) when
 * EXPO_PUBLIC_MEDIA_URL is set; both use the same <storage_path>/<width>.webp.
 */
import { useQuery } from '@tanstack/react-query';

import type { LocalizedText } from '@/i18n/localized';
import { supabase } from '@/lib/supabase';

export type PhotoSize = 'small' | 'medium' | 'large';

const WIDTHS: Record<PhotoSize, number> = { small: 400, medium: 1080, large: 1600 };

// The WeddedMedia stack's MediaUrl, e.g. https://d123.cloudfront.net
const MEDIA_URL = process.env.EXPO_PUBLIC_MEDIA_URL?.replace(/\/+$/, '') || null;

/** Public URL of one size of a photo, from its storage_path (vendor id/photo id). */
export function photoUrl(storagePath: string, size: PhotoSize): string {
  const file = `${storagePath}/${WIDTHS[size]}.webp`;
  if (MEDIA_URL) return `${MEDIA_URL}/${file}`;
  return supabase.storage.from('vendor-media').getPublicUrl(file).data.publicUrl;
}

export type VendorPhoto = {
  id: string;
  width: number;
  height: number;
  /** For expo-image's placeholder while the photo loads. */
  blurhash: string | null;
  isCover: boolean;
  eventSlug: string | null;
  /** "Photo: Frames by Jas", from a credited vendor or free text. */
  credit: string | null;
  url: Record<PhotoSize, string>;
};

export type VenuePhoto = VendorPhoto & {
  /** Whose photo it is, for "Real weddings here" (it links to their profile). */
  vendor: { slug: string; name: LocalizedText };
};

export type PhotoRow = {
  id: string;
  storage_path: string;
  width: number;
  height: number;
  blurhash: string | null;
  is_cover: boolean;
  event_slug: string | null;
  credit_text: string | null;
  credit: { name: string } | null;
};

export function toPhoto(row: PhotoRow): VendorPhoto {
  return {
    id: row.id,
    width: row.width,
    height: row.height,
    blurhash: row.blurhash,
    isCover: row.is_cover,
    eventSlug: row.event_slug,
    credit: row.credit?.name ?? row.credit_text,
    url: {
      small: photoUrl(row.storage_path, 'small'),
      medium: photoUrl(row.storage_path, 'medium'),
      large: photoUrl(row.storage_path, 'large'),
    },
  };
}

export const PHOTO_COLUMNS =
  'id, storage_path, width, height, blurhash, is_cover, event_slug, credit_text, credit:vendors!vendor_media_credit_vendor_id_fkey(name)';

async function fetchVendorPhotos(vendorId: string): Promise<VendorPhoto[]> {
  const { data, error } = await supabase
    .from('vendor_media')
    .select(PHOTO_COLUMNS)
    .eq('vendor_id', vendorId)
    .order('is_cover', { ascending: false })
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  return data.map(toPhoto);
}

/** A vendor's photos, cover first, for the profile's cover and grid. */
export function useVendorPhotos(vendorId: string) {
  return useQuery({
    queryKey: ['vendor-photos', vendorId],
    queryFn: () => fetchVendorPhotos(vendorId),
    enabled: vendorId.length > 0,
  });
}

async function fetchRealWeddingsAt(venueId: string): Promise<VenuePhoto[]> {
  const { data, error } = await supabase
    .from('vendor_media')
    .select(`${PHOTO_COLUMNS}, vendor:vendors!vendor_media_vendor_id_fkey(slug, name)`)
    .eq('venue_vendor_id', venueId)
    .neq('vendor_id', venueId)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  return data.map((row) => ({
    ...toPhoto(row),
    vendor: {
      slug: row.vendor.slug,
      name: { en: row.vendor.name },
    },
  }));
}

/**
 * "Real weddings here" on a venue's profile: other vendors' photos taken at
 * this venue, so the hall's page fills with photos it never uploaded (§6).
 */
export function useRealWeddingsAt(venueId: string) {
  return useQuery({
    queryKey: ['real-weddings', venueId],
    queryFn: () => fetchRealWeddingsAt(venueId),
    enabled: venueId.length > 0,
  });
}
