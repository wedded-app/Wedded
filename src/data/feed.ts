/**
 * The Discover feed: vendors' photos as posts, newest first, the way people
 * already scroll Instagram. One post per vendor holds all their photos (a
 * swipeable carousel), with the vendor's name, type, city, a line about them
 * and their price. Home picks its cover and event card photos from it.
 */
import { useQuery } from '@tanstack/react-query';

import { asLocalizedText, type LocalizedText } from '@/i18n/localized';
import { supabase } from '@/lib/supabase';

import { photoUrl, type VendorPhoto } from './vendor-media';
import type { VendorPrice } from './vendors';

export type FeedPost = {
  vendorId: string;
  slug: string;
  name: LocalizedText;
  /** The vendor's own words (tagline, else the start of the bio). */
  caption: string | null;
  city: string;
  foundingNumber: number | null;
  /** A demo sample, not a real business: show the Sample tag. */
  isSample: boolean;
  category: { slug: string; name: LocalizedText; groupSlug: string } | null;
  price: VendorPrice | null;
  photos: VendorPhoto[];
};

type Row = {
  id: string;
  storage_path: string;
  width: number;
  height: number;
  blurhash: string | null;
  is_cover: boolean;
  sort_order: number;
  event_slug: string | null;
  credit_text: string | null;
  created_at: string;
  vendor: {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    bio: string | null;
    city: string;
    founding_number: number | null;
    is_sample: boolean;
    price_display: string;
    price_from: number | null;
    price_to: number | null;
    price_unit: string | null;
    vendor_categories: {
      position: number;
      category: { slug: string; name: unknown; group_slug: string };
    }[];
  };
};

const PRICE_UNITS = ['event', 'hour', 'person', 'plate', 'hand', 'turban', 'day'] as const;

function priceOf(v: Row['vendor']): VendorPrice | null {
  const unit = PRICE_UNITS.find((u) => u === v.price_unit);
  if (v.price_display === 'starting_at' && v.price_from) {
    return { kind: 'starting_at', amount: v.price_from, unit };
  }
  if (v.price_display === 'range' && v.price_from && v.price_to) {
    return { kind: 'range', from: v.price_from, to: v.price_to, unit };
  }
  if (v.price_display === 'packages') return { kind: 'packages' };
  if (v.price_display === 'contact') return { kind: 'contact' };
  return null;
}

async function fetchFeed(): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .from('vendor_media')
    .select(
      `id, storage_path, width, height, blurhash, is_cover, sort_order, event_slug, credit_text, created_at,
       vendor:vendors!vendor_media_vendor_id_fkey!inner(id, slug, name, tagline, bio, city,
         founding_number, is_sample, price_display, price_from, price_to, price_unit, status,
         vendor_categories(position, category:categories(slug, name, group_slug)))`,
    )
    .eq('vendor.status', 'published')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw error;

  const posts = new Map<string, FeedPost>();
  for (const row of data as unknown as Row[]) {
    const v = row.vendor;
    let post = posts.get(v.id);
    if (!post) {
      const primary = [...v.vendor_categories].sort((a, b) => a.position - b.position)[0];
      post = {
        vendorId: v.id,
        slug: v.slug,
        name: { en: v.name },
        caption: v.tagline ?? v.bio,
        city: v.city,
        foundingNumber: v.founding_number,
        isSample: v.is_sample,
        category: primary
          ? {
              slug: primary.category.slug,
              name: asLocalizedText(primary.category.name) ?? { en: primary.category.slug },
              groupSlug: primary.category.group_slug,
            }
          : null,
        price: priceOf(v),
        photos: [],
      };
      posts.set(v.id, post);
    }
    post.photos.push({
      id: row.id,
      width: row.width,
      height: row.height,
      blurhash: row.blurhash,
      isCover: row.is_cover,
      eventSlug: row.event_slug,
      credit: row.credit_text,
      url: {
        small: photoUrl(row.storage_path, 'small'),
        medium: photoUrl(row.storage_path, 'medium'),
        large: photoUrl(row.storage_path, 'large'),
      },
    });
  }

  // Cover first within a post; founding vendors lead, then newest photos.
  return [...posts.values()]
    .map((post) => ({
      ...post,
      photos: post.photos.sort((a, b) => Number(b.isCover) - Number(a.isCover)),
    }))
    .sort((a, b) => Number(b.foundingNumber != null) - Number(a.foundingNumber != null));
}

/** Every vendor with photos, as feed posts. Fresh for five minutes. */
export function useFeed() {
  return useQuery({
    queryKey: ['feed'],
    queryFn: fetchFeed,
    staleTime: 5 * 60 * 1000,
  });
}
