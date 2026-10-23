import type { DateStatus } from '@/data/availability';
import type { ReplyAnswer } from '@/data/inquiries';
import { type Reel, type ReelVendor, reelVendors } from '@/data/reels';

/**
 * What the booking strip at the bottom of a reel says (the final look,
 * 2026-10-23: every reel is one tap from booking). Worked out here from the
 * family's plan, the inquiries they sent and their chats, so the screen only
 * draws it.
 */

/** One of the family's events, its name already in their language. */
export type StripEvent = { slug: string; name: string };

/** Where the family stands with a vendor, from their inquiries and chats. */
export type VendorStanding = 'asked' | 'replied' | 'booked';

/** The parts of an inquiry the strip needs (useMyInquiries' rows). */
export type SentInquiry = {
  vendor_id: string;
  status: string;
  followUpAnswer: ReplyAnswer | null;
};

/** The parts of a chat the strip needs (useConversations' rows). */
export type FamilyChat = {
  side: 'family' | 'vendor';
  vendor: { id: string };
  lastMessage: { senderRole: string } | null;
};

export type StripFacts = {
  /** The family's events in ceremony order. */
  events: StripEvent[];
  /** Each event's own day, yyyy-mm-dd. */
  eventDates: Record<string, string>;
  weddingDate: string | null;
  /** Who they booked, keyed "event/category" (an account's plan only). */
  bookedVendors: Record<string, { slug: string; name: string }>;
  /** By vendor id. */
  standings: Record<string, VendorStanding>;
  /** The businesses this person runs: no strip on their own reels. */
  myVendorIds: string[];
};

/** Before anything has loaded, or signed out: no plan, nothing asked. */
export const NO_FACTS: StripFacts = {
  events: [],
  eventDates: {},
  weddingDate: null,
  bookedVendors: {},
  standings: {},
  myVendorIds: [],
};

export type StripState =
  | { kind: 'none' }
  /** A family's reel: the vendors they tagged. */
  | { kind: 'see'; vendors: ReelVendor[]; eventSlug: string | null }
  /** The family booked this vendor (for `event`, when the plan says which). */
  | { kind: 'booked'; vendor: ReelVendor; event: StripEvent | null }
  /** The family asked this vendor; `replied` once the vendor wrote back. */
  | { kind: 'asked'; vendor: ReelVendor; replied: boolean }
  /** Not asked yet: Ask, and whether they're free on the family's likely event. */
  | {
      kind: 'book';
      vendor: ReelVendor;
      event: StripEvent | null;
      /** The day to check the vendor's calendar for; null checks nothing. */
      date: string | null;
      /** The event Ask opens with. */
      askEvent: string | null;
    };

const RANK: Record<VendorStanding, number> = { asked: 1, replied: 2, booked: 3 };

/**
 * Each vendor the family asked, and how far it got: an inquiry that went (or
 * is going) is "asked"; it becomes "replied" when the vendor's message is
 * the last in the family's chat with them, or the family said they got back
 * ("Yes, still deciding"); "booked" when the family said "Yes, we booked them".
 * Inquiries that failed to send don't count.
 */
export function vendorStandings(
  inquiries: SentInquiry[],
  chats: FamilyChat[],
): Record<string, VendorStanding> {
  const standings: Record<string, VendorStanding> = {};
  const raise = (vendorId: string, standing: VendorStanding) => {
    const now = standings[vendorId];
    if (!now || RANK[standing] > RANK[now]) standings[vendorId] = standing;
  };
  for (const inquiry of inquiries) {
    if (!inquiry.vendor_id || inquiry.status === 'failed') continue;
    raise(
      inquiry.vendor_id,
      inquiry.followUpAnswer === 'booked'
        ? 'booked'
        : inquiry.followUpAnswer === 'deciding'
          ? 'replied'
          : 'asked',
    );
  }
  for (const chat of chats) {
    if (chat.side !== 'family' || chat.lastMessage?.senderRole !== 'vendor') continue;
    if (standings[chat.vendor.id] === 'asked') standings[chat.vendor.id] = 'replied';
  }
  return standings;
}

/** The reel's own event when the family has it, else their first event. */
export function likelyEvent(reelEvent: string | null, events: StripEvent[]): StripEvent | null {
  return events.find((event) => event.slug === reelEvent) ?? events[0] ?? null;
}

/**
 * The event the family booked this vendor for: the reel's own when it's one
 * of them, else the first in ceremony order. Null when they didn't book them
 * (or booked them for an event that's no longer in the plan: `found` says
 * they're booked all the same).
 */
export function bookedFor(
  vendorSlug: string,
  reelEvent: string | null,
  facts: Pick<StripFacts, 'bookedVendors' | 'events'>,
): { found: boolean; event: StripEvent | null } {
  const slugs = Object.entries(facts.bookedVendors)
    .filter(([, vendor]) => vendor.slug === vendorSlug)
    .map(([key]) => key.split('/')[0]);
  if (slugs.length === 0) return { found: false, event: null };
  const mine = facts.events.filter((event) => slugs.includes(event.slug));
  return {
    found: true,
    event: mine.find((event) => event.slug === reelEvent) ?? mine[0] ?? null,
  };
}

/** What the strip on this reel says. */
export function stripState(
  reel: Pick<Reel, 'vendor' | 'tags' | 'eventSlug'>,
  facts: StripFacts,
): StripState {
  const vendor = reel.vendor;
  if (!vendor) {
    // A family's reel: book one of the vendors they tagged
    const vendors = reelVendors(reel);
    return vendors.length > 0
      ? { kind: 'see', vendors, eventSlug: reel.eventSlug }
      : { kind: 'none' };
  }
  if (facts.myVendorIds.includes(vendor.id)) return { kind: 'none' };

  const booked = bookedFor(vendor.slug, reel.eventSlug, facts);
  const standing = facts.standings[vendor.id];
  if (booked.found || standing === 'booked') {
    return { kind: 'booked', vendor, event: booked.event };
  }
  if (standing === 'asked' || standing === 'replied') {
    return { kind: 'asked', vendor, replied: standing === 'replied' };
  }
  const event = likelyEvent(reel.eventSlug, facts.events);
  return {
    kind: 'book',
    vendor,
    event,
    date: event ? (facts.eventDates[event.slug] ?? facts.weddingDate) : null,
    askEvent: event?.slug ?? reel.eventSlug,
  };
}

/** The line under "Book …": which words, and the dot's colour. */
export type FreeLine = {
  key: 'free' | 'booked' | 'held' | 'partly' | 'askEvent' | 'askAbout';
  tone: 'free' | 'busy' | 'maybe' | null;
};

/**
 * "Free on your Mehndi", booked, held or partly free, from the vendor's
 * calendar. With no recent calendar ("unknown") or no date it says nothing
 * about being free, only what Ask is for.
 */
export function freeLine(status: DateStatus | undefined, hasEvent: boolean): FreeLine {
  if (hasEvent) {
    switch (status) {
      case 'open':
        return { key: 'free', tone: 'free' };
      case 'booked':
        return { key: 'booked', tone: 'busy' };
      case 'held':
        return { key: 'held', tone: 'maybe' };
      case 'partly':
        return { key: 'partly', tone: 'maybe' };
      default:
        return { key: 'askEvent', tone: null };
    }
  }
  return { key: 'askAbout', tone: null };
}
