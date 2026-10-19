/**
 * The guest list's plain logic (#308): head counts, turning a phone contact
 * into a guest, and search.
 */
import type { Guest, GuestDraft, Rsvp } from '@/data/guests';
import { isValidEmail, normalizePhone } from '@/features/auth/about-you-validation';

type Translate = (key: string, options?: Record<string, string | number>) => string;

/**
 * People on the list (a household counts everyone in it), those invited to
 * at least one event, and how many are coming to at least one.
 */
export function guestTotals(guests: Guest[]): { people: number; invited: number; coming: number } {
  let people = 0;
  let invited = 0;
  let coming = 0;
  for (const guest of guests) {
    people += guest.partySize;
    if (guest.invites.length > 0) invited += guest.partySize;
    coming += Math.max(0, ...guest.invites.map((invite) => invite.coming ?? 0));
  }
  return { people, invited, coming };
}

/** "48 invited · 31 coming", or how many are on the list before anyone's invited; null when empty. */
export function totalsLine(guests: Guest[], t: Translate): string | null {
  const { people, invited, coming } = guestTotals(guests);
  if (people === 0) return null;
  if (invited === 0) return t('guests.onList', { count: people });
  return t('guests.totals', { invited, coming });
}

/** A contact as the phone gives it (expo-contacts' fullName, phones and emails). */
export type PhoneContact = {
  fullName: string | null;
  phones?: { label?: string; number?: string }[];
  emails?: { address?: string }[];
};

const MOBILE = /mobile|cell|iphone/i;

/**
 * The guest to save from a contact: the name, the first mobile number that is
 * a real number (else any), and the first email that looks right. Null for a
 * contact without a name. Nothing else about the contact is kept.
 */
export function contactToGuest(contact: PhoneContact): Required<GuestDraft> | null {
  const name = (contact.fullName ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!name) return null;
  const phones = [...(contact.phones ?? [])].sort(
    (a, b) => Number(MOBILE.test(b.label ?? '')) - Number(MOBILE.test(a.label ?? '')),
  );
  const phone = phones.map((p) => normalizePhone(p.number ?? '')).find((p) => p !== null) ?? null;
  const email =
    (contact.emails ?? [])
      .map((e) => (e.address ?? '').trim().toLowerCase())
      .find((address) => isValidEmail(address)) ?? null;
  return { name, phone, email, partySize: 1 };
}

/** Whether a row matches the search: part of the name or second line, or the digits of a number. */
export function matchesSearch(query: string, name: string, detail?: string | null): boolean {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  if (name.toLowerCase().includes(text) || detail?.toLowerCase().includes(text)) return true;
  const digits = text.replace(/\D/g, '');
  return digits.length >= 3 && !!detail && detail.replace(/\D/g, '').includes(digits);
}

/** "Coming (4)", "Not coming" or "No answer yet". */
export function answerLabel(rsvp: Rsvp, coming: number | null, t: Translate): string {
  if (rsvp === 'yes') return t('guests.answer.yes', { count: coming ?? 1 });
  return rsvp === 'no' ? t('guests.answer.no') : t('guests.answer.pending');
}
