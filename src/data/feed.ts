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
import { priceOf, type VendorPrice } from './vendors';

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

async function fetchFeed(): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .from('vendor_media')
    .select(
      `id, storage_path, width, height, blurhash, is_cover, sort_order, event_slug, credit_text, created_at,
       vendor:vendors!vendor_media_vendor_id_fkey!inner(id, slug, name, tagline, bio, base_city:cities(name),
         founding_number, is_sample, price_display, price_from_cents, price_to_cents, price_unit, status,
         vendor_categories(position, category:categories(slug, name, group_slug)))`,
    )
    .eq('vendor.status', 'published')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw error;

  const posts = new Map<string, FeedPost>();
  for (const row of data) {
    const v = row.vendor;
    let post = posts.get(v.id);
    if (!post) {
      const primary = [...v.vendor_categories].sort((a, b) => a.position - b.position)[0];
      post = {
        vendorId: v.id,
        slug: v.slug,
        name: { en: v.name },
        caption: v.tagline ?? v.bio,
        city: v.base_city.name,
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
