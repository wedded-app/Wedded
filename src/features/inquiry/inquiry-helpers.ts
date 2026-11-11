import { useQuery } from '@tanstack/react-query';

import type { GuestBand } from '@/data/inquiries';
import { asLocalizedText, type LocalizedText } from '@/i18n/localized';
import { supabase } from '@/lib/supabase';

import type { QuestionSet } from './details';

export const GUEST_BANDS: GuestBand[] = [
  'under_50',
  '50_100',
  '100_250',
  '250_500',
  '500_plus',
  'not_sure',
];

/** A calendar date as YYYY-MM-DD from the phone's own day (never via UTC, so it can't shift). */
export function toDateString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** YYYY-MM-DD back to a Date at local midnight, for the picker. */
export function fromDateString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** "Sat, Jun 12, 2027". */
export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(fromDateString(value));
}

/**
 * The dates from My Wedding for the events a family is asking about: each
 * event's own day (in the order they picked), and the date to start the form
 * with: the earliest of those days. The wedding day is used only when they're
 * asking about wedding-day events (or haven't picked one): a Roka is months
 * earlier, so it never gets the wedding date. Otherwise the date starts
 * empty for them to pick. Days already past are left out.
 */
export function planDatesFor(
  eventSlugs: string[],
  eventDates: Record<string, string> | undefined,
  weddingDate: string | null,
  weddingDaySlugs: string[],
  today: string = toDateString(new Date()),
): { start: string | null; dates: { slug: string; date: string }[] } {
  const dates = eventSlugs
    .filter((slug) => (eventDates?.[slug] ?? '') >= today)
    .map((slug) => ({ slug, date: eventDates?.[slug] as string }));
  const earliest = dates.map((d) => d.date).sort()[0];
  if (earliest) return { start: earliest, dates };
  const onWeddingDay = eventSlugs.every((slug) => weddingDaySlugs.includes(slug));
  const start = onWeddingDay && weddingDate && weddingDate >= today ? weddingDate : null;
  return { start, dates };
}

export type InquiryVendor = {
  id: string;
  slug: string;
  name: LocalizedText;
  city: string;
  category: LocalizedText | null;
  /** The primary category's own questions (categories.inquiry_questions). */
  questionSet: QuestionSet;
  callPhone: string | null;
  textPhone: string | null;
  whatsappPhone: string | null;
  /** Events the vendor says they serve, to show those chips first. */
  eventSlugs: string[];
  /** Its kinds (categories.slug), primary first: which of the family's events it's for. */
  categorySlugs: string[];
  /** A hall's answers to the questions Ask would otherwise put to the family. */
  hall: HallAnswers;
};

/** What a hall said (venue_policies, venue_rooms); each is missing when it didn't say. */
export type HallAnswers = {
  /** The biggest room's seats. */
  seats?: number;
  /** yes, no or optional */
  inHouseCatering?: string;
  /** yes, approved_list or no */
  outsideCatering?: string;
  /** full_bar, beer_wine, byob or dry */
  alcoholPolicy?: string;
  /** Corkage in dollars, with byob. */
  corkage?: number;
  ghoriAllowed?: boolean;
  dholOutsideAllowed?: boolean;
};

async function fetchInquiryVendor(vendorId: string): Promise<InquiryVendor | null> {
  const { data, error } = await supabase
    .from('vendors')
    .select(
      'id, slug, name, base_city:cities(name), vendor_contacts(kind, value), vendor_categories(position, category:categories(slug, name, inquiry_questions)), vendor_events(event_slug), venue_policies(in_house_catering, outside_catering, alcohol_policy, corkage_cents, ghori_allowed, dhol_outside_allowed), venue_rooms(seated)',
    )
    .eq('id', vendorId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const categories = [...data.vendor_categories].sort((a, b) => a.position - b.position);
  const primary = categories[0];
  const policies = data.venue_policies;
  const seats = data.venue_rooms.flatMap((room) => (room.seated === null ? [] : [room.seated]));
  const contact = (kind: string) =>
    data.vendor_contacts.find((c) => c.kind === kind)?.value ?? null;
  return {
    id: data.id,
    slug: data.slug,
    name: { en: data.name },
    city: data.base_city.name,
    category: primary ? asLocalizedText(primary.category?.name) : null,
    questionSet: (primary?.category?.inquiry_questions ?? null) as QuestionSet,
    callPhone: contact('call'),
    textPhone: contact('text'),
    whatsappPhone: contact('whatsapp'),
    eventSlugs: data.vendor_events.map((row) => row.event_slug),
    categorySlugs: categories.flatMap((link) => (link.category ? [link.category.slug] : [])),
    hall: {
      seats: seats.length > 0 ? Math.max(...seats) : undefined,
      inHouseCatering: policies?.in_house_catering ?? undefined,
      outsideCatering: policies?.outside_catering ?? undefined,
      alcoholPolicy: policies?.alcohol_policy ?? undefined,
      corkage: policies?.corkage_cents == null ? undefined : policies.corkage_cents / 100,
      ghoriAllowed: policies?.ghori_allowed ?? undefined,
      dholOutsideAllowed: policies?.dhol_outside_allowed ?? undefined,
    },
  };
}

/**
 * Which event chips the form shows before "Other events" is tapped: the
 * chosen ones (e.g. Reception, passed from results) first, then the events
 * the vendor serves, each in ceremony order. With neither, or once expanded,
 * every event shows.
 */
export function eventChips<T extends { slug: string }>(
  all: T[],
  chosen: string[],
  served: string[],
  expanded: boolean,
): { shown: T[]; hasMore: boolean } {
  const first = [
    ...all.filter((event) => chosen.includes(event.slug)),
    ...all.filter((event) => !chosen.includes(event.slug) && served.includes(event.slug)),
  ];
  if (expanded || first.length === 0) return { shown: all, hasMore: false };
  return { shown: first, hasMore: first.length < all.length };
}

/** The vendor being asked, for the form's mini-card and the sent screen. Null if not listed. */
export function useInquiryVendor(vendorId: string) {
  return useQuery({
    queryKey: ['inquiry-vendor', vendorId],
    queryFn: () => fetchInquiryVendor(vendorId),
    enabled: vendorId.length > 0,
  });
}
