// Checks the shape of an inquiry from the app. The database (create_inquiry)
// checks everything that needs data: the profile, the vendor, the events, the
// date and the limits.

export const GUEST_BANDS = [
  'under_50',
  '50_100',
  '100_250',
  '250_500',
  '500_plus',
  'not_sure',
] as const;
export const CONTACTS = ['call', 'text', 'whatsapp', 'email'] as const;

export type GuestBand = (typeof GUEST_BANDS)[number];
export type Contact = (typeof CONTACTS)[number];

export type InquiryInput = {
  vendorId: string;
  /** Events it's for; empty means "Not sure". */
  eventSlugs: string[];
  /** YYYY-MM-DD, or null for "Not sure yet". */
  eventDate: string | null;
  /** HH:MM (24-hour), optional. */
  startTime: string | null;
  guestBand: GuestBand;
  /** City or venue. */
  location: string;
  message: string;
  preferredContact: Contact;
  /** Answers to the category's own questions (catering preference, ghori...). */
  details: Record<string, unknown>;
  /** Name and phone default to the profile; the form lets people edit them. */
  name: string | null;
  phone: string | null;
  /** They saw "You already asked on …" and chose to send again. */
  sendAgain: boolean;
};

export type ParseResult = { ok: true; value: InquiryInput } | { ok: false; field: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE = /^\+[1-9]\d{7,14}$/;

function text(value: unknown, min: number, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length >= min && trimmed.length <= max ? trimmed : null;
}

function isRealDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function parseInquiry(body: unknown): ParseResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, field: 'body' };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.vendorId !== 'string' || !UUID.test(b.vendorId)) {
    return { ok: false, field: 'vendorId' };
  }

  const eventSlugs = b.eventSlugs ?? [];
  if (
    !Array.isArray(eventSlugs) ||
    eventSlugs.length > 10 ||
    !eventSlugs.every((slug) => typeof slug === 'string' && SLUG.test(slug))
  ) {
    return { ok: false, field: 'eventSlugs' };
  }

  const eventDate = b.eventDate ?? null;
  if (
    eventDate !== null &&
    (typeof eventDate !== 'string' || !DATE.test(eventDate) || !isRealDate(eventDate))
  ) {
    return { ok: false, field: 'eventDate' };
  }

  const startTime = b.startTime ?? null;
  if (startTime !== null && (typeof startTime !== 'string' || !TIME.test(startTime))) {
    return { ok: false, field: 'startTime' };
  }

  if (!GUEST_BANDS.includes(b.guestBand as GuestBand)) return { ok: false, field: 'guestBand' };

  const location = text(b.location, 1, 120);
  if (location === null) return { ok: false, field: 'location' };

  const message = text(b.message, 1, 2000);
  if (message === null) return { ok: false, field: 'message' };

  if (!CONTACTS.includes(b.preferredContact as Contact)) {
    return { ok: false, field: 'preferredContact' };
  }

  const details = b.details ?? {};
  if (
    typeof details !== 'object' ||
    details === null ||
    Array.isArray(details) ||
    JSON.stringify(details).length > 4000
  ) {
    return { ok: false, field: 'details' };
  }

  let name: string | null = null;
  if (b.name !== undefined && b.name !== null) {
    name = text(b.name, 1, 80);
    if (name === null) return { ok: false, field: 'name' };
  }

  let phone: string | null = null;
  if (b.phone !== undefined && b.phone !== null) {
    if (typeof b.phone !== 'string' || !PHONE.test(b.phone)) return { ok: false, field: 'phone' };
    phone = b.phone;
  }

  return {
    ok: true,
    value: {
      vendorId: b.vendorId,
      eventSlugs: eventSlugs as string[],
      eventDate: eventDate as string | null,
      startTime: startTime as string | null,
      guestBand: b.guestBand as GuestBand,
      location,
      message,
      preferredContact: b.preferredContact as Contact,
      details: details as Record<string, unknown>,
      name,
      phone,
      sendAgain: b.sendAgain === true,
    },
  };
}
