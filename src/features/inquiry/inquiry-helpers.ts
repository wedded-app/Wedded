import { useQuery } from '@tanstack/react-query';

import type { GuestBand } from '@/data/inquiries';
import { asLocalizedText, localized, type LocalizedText } from '@/i18n/localized';
import { supabase } from '@/lib/supabase';

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

type Translate = (key: string, options?: Record<string, string | number>) => string;

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

/**
 * The suggested message (S11 item 5). It's rewritten as
 * the form changes until they edit it themselves.
 */
export function suggestedMessage(
  t: Translate,
  parts: {
    events: LocalizedText[];
    date: string | null;
    place: string;
    guests: GuestBand | null;
    /** Asking to visit a venue ("Book a tour"). */
    tour?: boolean;
    /** Each event's own day from My Wedding; with two or more, the message names each. */
    eventDates?: { event: LocalizedText; date: string }[];
  },
): string {
  const joiner = t('inquiry.auto.and');
  const events =
    parts.events.length > 0
      ? parts.events.map((event) => localized(event)).join(` ${joiner} `)
      : t('inquiry.auto.wedding');
  const knownGuests = parts.guests && parts.guests !== 'not_sure' ? parts.guests : null;
  // "Jaago on Fri, Jun 11 and Anand Karaj on Sat, Jun 12"
  if (!parts.tour && parts.eventDates && parts.eventDates.length >= 2) {
    const dates = parts.eventDates
      .map(({ event, date }) =>
        t('inquiry.auto.eventOn', { event: localized(event), date: formatDate(date) }),
      )
      .join(` ${joiner} `);
    return t(`inquiry.auto.${knownGuests ? 'datesAndGuests' : 'dates'}`, {
      dates,
      place: parts.place.trim() || t('inquiry.auto.ourCity'),
      guests: knownGuests ? t(`inquiry.guestsInMessage.${knownGuests}`) : '',
    });
  }
  const key = parts.tour
    ? 'tour'
    : parts.date
      ? knownGuests
        ? 'withDateAndGuests'
        : 'withDate'
      : knownGuests
        ? 'withGuests'
        : 'plain';
  return t(`inquiry.auto.${key}`, {
    events,
    date: parts.date ? formatDate(parts.date) : '',
    place: parts.place.trim() || t('inquiry.auto.ourCity'),
    guests: knownGuests ? t(`inquiry.guestsInMessage.${knownGuests}`) : '',
  });
}

export type InquiryVendor = {
  id: string;
  slug: string;
  name: LocalizedText;
  city: string;
  category: LocalizedText | null;
  /** The primary category's slug, which decides the category questions. */
  categorySlug: string | null;
  callPhone: string | null;
  textPhone: string | null;
  whatsappPhone: string | null;
  /** Events the vendor says they serve, to show those chips first. */
  eventSlugs: string[];
};

async function fetchInquiryVendor(vendorId: string): Promise<InquiryVendor | null> {
  const { data, error } = await supabase
    .from('vendors')
    .select(
      'id, slug, name, city, call_phone, text_phone, whatsapp_phone, vendor_categories(position, category:categories(slug, name)), vendor_events(event_slug)',
    )
    .eq('id', vendorId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const primary = [...data.vendor_categories].sort((a, b) => a.position - b.position)[0];
  return {
    id: data.id,
    slug: data.slug,
    name: { en: data.name },
    city: data.city,
    category: primary ? asLocalizedText(primary.category?.name) : null,
    categorySlug: primary?.category?.slug ?? null,
    callPhone: data.call_phone,
    textPhone: data.text_phone,
    whatsappPhone: data.whatsapp_phone,
    eventSlugs: data.vendor_events.map((row) => row.event_slug),
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
