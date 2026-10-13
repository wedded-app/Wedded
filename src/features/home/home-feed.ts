/** Pure helpers behind Home's sections (kept apart from the screens so tests can load them). */
import type { Conversation } from '@/data/chat';
import type { ShortlistVendor } from '@/data/family-shortlist';
import type { FeedPost } from '@/data/feed';
import type { WeddingMember } from '@/data/wedding';
import type { WeddingSuggestion } from '@/data/wedding-suggestions';
import type { LocalizedText } from '@/i18n/localized';

export type VendorStatus = 'newReply' | 'replied' | 'waiting' | 'booked';

export type VendorStatusRow = {
  key: string;
  status: VendorStatus;
  vendor: { slug: string; name: LocalizedText; photoUrl: string | null };
  /** The chat to open, or null for a vendor booked without one. */
  conversationId: string | null;
  /** When the conversation last moved. */
  at: string | null;
  unread: number;
  /** For booked rows: the plan's events they're booked for. */
  bookedFor: string[];
};

const STATUS_RANK: Record<VendorStatus, number> = {
  newReply: 0,
  replied: 1,
  waiting: 2,
  booked: 3,
};

/**
 * "Your vendors": every vendor the family is talking to or has booked, once
 * each. A vendor who wrote last has replied (a new reply while unread), one
 * the family wrote to last is still to answer, and a vendor named in the plan
 * is booked. New replies first, then replies, then waiting, newest first in
 * each, booked last. Chats with no messages yet (Message tapped, nothing
 * sent) are left out.
 */
export function vendorStatusRows(
  conversations: Conversation[],
  bookedVendors: Record<string, { slug: string; name: string }>,
): VendorStatusRow[] {
  // Booked vendors keyed by slug, with the events from "event/category" keys
  const booked = new Map<string, { name: string; events: string[] }>();
  for (const [key, vendor] of Object.entries(bookedVendors)) {
    const event = key.split('/')[0];
    const seen = booked.get(vendor.slug);
    if (!seen) booked.set(vendor.slug, { name: vendor.name, events: [event] });
    else if (!seen.events.includes(event)) seen.events.push(event);
  }

  const rows: VendorStatusRow[] = [];
  const inChat = new Set<string>();
  for (const c of conversations) {
    if (c.side !== 'family' || !c.lastMessage) continue;
    inChat.add(c.vendor.slug);
    const bookedHere = booked.get(c.vendor.slug);
    const status: VendorStatus = bookedHere
      ? 'booked'
      : c.lastMessage.senderRole === 'vendor'
        ? c.unreadCount > 0
          ? 'newReply'
          : 'replied'
        : 'waiting';
    rows.push({
      key: c.id,
      status,
      vendor: c.vendor,
      conversationId: c.id,
      at: c.updatedAt,
      unread: c.unreadCount,
      bookedFor: bookedHere?.events ?? [],
    });
  }
  for (const [slug, vendor] of booked) {
    if (inChat.has(slug)) continue;
    rows.push({
      key: `booked-${slug}`,
      status: 'booked',
      vendor: { slug, name: { en: vendor.name }, photoUrl: null },
      conversationId: null,
      at: null,
      unread: 0,
      bookedFor: vendor.events,
    });
  }

  return rows.sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] || (b.at ?? '').localeCompare(a.at ?? ''),
  );
}

export type FamilyActivity =
  | {
      kind: 'suggested';
      key: string;
      /** Who suggested it; null when their name isn't known. */
      name: string | null;
      vendor: { slug: string; name: LocalizedText };
      eventSlug: string;
    }
  | {
      kind: 'loved';
      key: string;
      names: string[];
      vendor: { slug: string; name: LocalizedText };
    };

/**
 * "Your family": what the others have been doing, newest suggestions first
 * (your own are left out), then the vendors loved most.
 */
export function familyActivity(
  shortlist: ShortlistVendor[],
  suggestions: WeddingSuggestion[],
  members: WeddingMember[],
  limit = 3,
): FamilyActivity[] {
  const nameOf = new Map(members.map((m) => [m.userId, m]));
  const suggested: FamilyActivity[] = suggestions
    .filter((s) => s.status === 'open' && s.vendor && !nameOf.get(s.suggestedBy ?? '')?.isMe)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((s) => ({
      kind: 'suggested',
      key: `suggested-${s.id}`,
      name: firstName(nameOf.get(s.suggestedBy ?? '')?.name ?? null),
      vendor: { slug: s.vendor!.slug, name: s.vendor!.name },
      eventSlug: s.eventSlug,
    }));
  const loved: FamilyActivity[] = shortlist
    .filter((v) => v.published && v.lovedBy.length > 0)
    .sort((a, b) => b.counts.love - a.counts.love)
    .map((v) => ({
      kind: 'loved',
      key: `loved-${v.vendorId}`,
      names: v.lovedBy,
      vendor: { slug: v.slug, name: v.name },
    }));
  return [...suggested, ...loved].slice(0, limit);
}

function firstName(full: string | null): string | null {
  const first = full?.trim().split(/\s+/)[0];
  return first ? first : null;
}

/** "Mom", "Mom and Bhua", "Mom, Bhua and Simran". */
export function joinNames(names: string[], and: string): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]}`;
}

/**
 * The photo behind the top of Home: a vendor the family booked (a venue
 * first), else any venue, else any vendor with photos. Null means no photos
 * yet, so the maroon card stands in.
 */
export function heroPhoto(
  posts: FeedPost[],
  bookedSlugs: string[],
): { url: string; blurhash: string | null } | null {
  const withPhotos = posts.filter((p) => p.photos.length > 0);
  const isVenue = (p: FeedPost) => p.category?.groupSlug === 'venues';
  const isBooked = (p: FeedPost) => bookedSlugs.includes(p.slug);
  const pick =
    withPhotos.find((p) => isBooked(p) && isVenue(p)) ??
    withPhotos.find(isBooked) ??
    withPhotos.find(isVenue) ??
    withPhotos[0];
  if (!pick) return null;
  const photo = pick.photos.find((p) => p.isCover) ?? pick.photos[0];
  return { url: photo.url.large, blurhash: photo.blurhash };
}
