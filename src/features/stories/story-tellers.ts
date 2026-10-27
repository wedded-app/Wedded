import type { Story, StoryGroup } from '@/data/stories';
import type { VendorPhoto } from '@/data/vendor-media';
import type { VendorProfile } from '@/data/vendors';
import { localized } from '@/i18n/localized';

// What the story viewer (/story) plays: whose slides, in what order.

export type Slide = {
  id: string;
  kind: 'photo' | 'video';
  url: string;
  blurhash: string | null;
  caption: string | null;
  /** When a posted story went up, for "3 hours ago". */
  postedAt: string | null;
  /** The posted story itself, to delete it. */
  story: Story | null;
};

/** Whoever's slides are playing: a poster's stories, or a vendor's photos. */
export type Teller = {
  key: string;
  name: string;
  /** "Photographer · Fremont" for a vendor's photos. */
  place: string | null;
  avatarUrl: string | null;
  vendor: { id: string; slug: string; category: string | null; city: string } | null;
  personId: string | null;
  isMine: boolean;
  isSample: boolean;
  /** Posted stories: marked watched as they play, and can be reported. */
  live: boolean;
  slides: Slide[];
};

export function fromGroup(group: StoryGroup, someone: string): Teller {
  return {
    key: group.key,
    name: group.name ?? someone,
    place: null,
    avatarUrl: null,
    vendor: group.vendor
      ? { id: group.vendor.id, slug: group.vendor.slug, category: null, city: '' }
      : null,
    personId: group.vendor ? null : group.authorId,
    isMine: group.isMine,
    isSample: group.isSample,
    live: true,
    slides: group.stories.map((story) => ({
      id: story.id,
      kind: story.kind,
      url: story.url,
      blurhash: null,
      caption: story.caption,
      postedAt: story.createdAt,
      story,
    })),
  };
}

/** A vendor's own photos as one teller (their page's highlights), or none without photos. */
export function vendorTeller(
  v: VendorProfile | null | undefined,
  photos: VendorPhoto[] | undefined,
): Teller[] {
  if (!v || !photos?.length) return [];
  const category = v.categories[0] ? localized(v.categories[0].name) : null;
  const caption = (v.tagline ?? v.bio)?.trim() || null;
  return [
    {
      key: v.slug,
      name: localized(v.name),
      place: [category, v.city].filter(Boolean).join(' · '),
      avatarUrl: photos[0].url.small,
      vendor: { id: v.id, slug: v.slug, category, city: v.city },
      personId: null,
      isMine: false,
      isSample: v.isSample,
      live: false,
      slides: photos.map((photo) => ({
        id: photo.id,
        kind: 'photo',
        url: photo.url.large,
        blurhash: photo.blurhash,
        caption,
        postedAt: null,
        story: null,
      })),
    },
  ];
}
