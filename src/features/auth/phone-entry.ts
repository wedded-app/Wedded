/**
 * The phone sign-in screen's number box: a country code pill beside it, the
 * digits spaced as they're typed, and the E.164 number to send the code to.
 */
import { normalizePhone, toLatinDigits } from './about-you-validation';

export type Country = {
  /** ISO code; the name is `phoneSignIn.countries.<code>` in i18n. */
  code: string;
  /** Calling code without the +. */
  dial: string;
  flag: string;
};

// Where the families are and where their relatives call from. Country codes
// aren't wedding data (cultures, events, vendor types), so they live here.
export const COUNTRIES: readonly Country[] = [
  { code: 'US', dial: '1', flag: '🇺🇸' },
  { code: 'CA', dial: '1', flag: '🇨🇦' },
  { code: 'IN', dial: '91', flag: '🇮🇳' },
  { code: 'PK', dial: '92', flag: '🇵🇰' },
  { code: 'GB', dial: '44', flag: '🇬🇧' },
  { code: 'AE', dial: '971', flag: '🇦🇪' },
  { code: 'AU', dial: '61', flag: '🇦🇺' },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];

/** The most digits a number can have after its country code (E.164 allows 15 in all). */
function maxDigits(dial: string): number {
  return dial === '1' ? 10 : 15 - dial.length;
}

/**
 * The digits from what's in the box now, given the digits before the edit.
 * Spaces are only for show: deleting one deletes the digit before it, and a
 * pasted or autofilled "+1 (916) 555-0100" keeps just the number.
 */
export function nextPhoneDigits(previous: string, text: string, dial: string): string {
  let digits = toLatinDigits(text).replace(/\D/g, '');
  const shown = formatPhoneDigits(previous, dial);
  if (digits === previous && text.length < shown.length) {
    digits = digits.slice(0, -1);
  }
  if (dial === '1' && digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, maxDigits(dial));
}

/** US and Canadian numbers spaced as they're typed ("916 555 0100"); others as typed. */
export function formatPhoneDigits(digits: string, dial: string): string {
  if (dial !== '1') return digits;
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)].filter(Boolean).join(' ');
}

/** The number in E.164, or null while it isn't a whole, real-looking number yet. */
export function phoneToE164(digits: string, dial: string): string | null {
  if (!digits) return null;
  return dial === '1' ? normalizePhone(digits) : normalizePhone(`+${dial}${digits}`);
}
