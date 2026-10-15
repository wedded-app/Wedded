/**
 * Search that sets up a plan (Thumbtack, via Tanveer: "if you search wedding
 * they set up a plan for you"). Reads what someone typed, like "punjabi
 * wedding in yuba city for 300 people on june 12 2027", and picks out what
 * the first questions ask: where the family is from, their faith, the events,
 * how many guests, where and when. Everything it recognises comes from the
 * database (backgrounds, faiths, each tradition's event names, cities); only
 * the words that mean "a wedding" and the month names are written here.
 * Runs on the device.
 */
import type { GuestBand } from '@/data/inquiries';
import type { LocalizedText } from '@/i18n/localized';

type Named = { slug: string; name: LocalizedText };
/** An event and every name a tradition gives it (Mayun, Maiyan / Vatna...). */
export type NamedEvent = { slug: string; names: string[] };
type NamedCity = { slug: string; name: string; areaCode: string; aliases: string[] };

export type PlanHint = {
  backgrounds: string[];
  faiths: string[];
  events: string[];
  guestBand: GuestBand | null;
  /** The city's slug, and the area code to search around. */
  city: { slug: string; areaCode: string } | null;
  /** yyyy-mm-dd */
  date: string | null;
};

/** Words that mean someone is planning a wedding, in English, Punjabi and Urdu/Hindi spellings. */
const WEDDING_WORDS = [
  'wedding',
  'weddings',
  'marriage',
  'shaadi',
  'shadi',
  'viah',
  'vivah',
  'biyah',
  'byah',
];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const GUEST_WORDS = 'people|persons|guests?|ppl|pax';

/** Lower case, punctuation as spaces, padded so " term " finds whole words. */
function clean(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/[.,!?;:()"“”'’/+&-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

function hasTerm(text: string, term: string): boolean {
  const t = clean(term).trim();
  return [...t].length >= 3 && text.includes(` ${t} `);
}

/** "Chunni Chadai + Kurmai / Sagai" is three names: each part of a name can be typed alone. */
function nameParts(name: string): string[] {
  return [name, ...name.split(/[/+,&]| or /)].map((part) => part.trim()).filter(Boolean);
}

export function guestBand(count: number): GuestBand {
  if (count < 50) return 'under_50';
  if (count <= 100) return '50_100';
  if (count <= 250) return '100_250';
  if (count <= 500) return '250_500';
  return '500_plus';
}

function guestsIn(text: string): GuestBand | null {
  const withWord = text.match(new RegExp(` (\\d{2,4}) ?(?:${GUEST_WORDS}) `));
  const forCount = text.match(/ for (?:about |around |like )?(\d{2,4}) /);
  const raw = withWord?.[1] ?? forCount?.[1];
  if (!raw) return null;
  const count = Number(raw);
  // "for 2027" is a year, not a guest count
  if (!withWord && count >= 1900) return null;
  return count >= 5 && count <= 5000 ? guestBand(count) : null;
}

function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 6/12/2027, June 12 2027, June 12th 2027, 12 June 2027. Two-digit years mean 20xx. */
function dateIn(raw: string): string | null {
  const numeric = raw.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b/);
  if (numeric) {
    const year = Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]);
    return isoDate(year, Number(numeric[1]), Number(numeric[2]));
  }
  const text = clean(raw);
  const month = `(${MONTHS.join('|')})[a-z]*`;
  const monthFirst = text.match(new RegExp(` ${month} (\\d{1,2})(?:st|nd|rd|th)? (\\d{4}) `));
  if (monthFirst) {
    return isoDate(Number(monthFirst[3]), MONTHS.indexOf(monthFirst[1]) + 1, Number(monthFirst[2]));
  }
  const dayFirst = text.match(new RegExp(` (\\d{1,2})(?:st|nd|rd|th)? ${month} (\\d{4}) `));
  if (dayFirst) {
    return isoDate(Number(dayFirst[3]), MONTHS.indexOf(dayFirst[2]) + 1, Number(dayFirst[1]));
  }
  return null;
}

function matching(text: string, items: Named[]): string[] {
  return items
    .filter((item) => [item.slug, item.name.en].some((term) => term && hasTerm(text, term)))
    .map((item) => item.slug);
}

/**
 * What a search says about the wedding, or null when it isn't about planning
 * one. It counts as planning when it says "wedding" (or shaadi, viah),
 * or names an event plus one more detail. "mehndi" alone is someone looking
 * for a mehndi artist, so it stays a plain search.
 */
export function planFromQuery(
  raw: string,
  data: { backgrounds: Named[]; faiths: Named[]; events: NamedEvent[]; cities: NamedCity[] },
): PlanHint | null {
  const text = clean(raw);
  if (!text.trim()) return null;

  const events = data.events
    .filter((event) => event.names.flatMap(nameParts).some((name) => hasTerm(text, name)))
    .map((event) => event.slug);
  const city =
    [...data.cities]
      .filter((c) =>
        [c.name, ...c.aliases].some((name) => text.includes(` ${clean(name).trim()} `)),
      )
      .sort((a, b) => b.name.length - a.name.length)[0] ?? null;
  const hint: PlanHint = {
    backgrounds: matching(text, data.backgrounds),
    faiths: matching(text, data.faiths),
    events,
    guestBand: guestsIn(text),
    city: city ? { slug: city.slug, areaCode: city.areaCode } : null,
    date: dateIn(raw),
  };

  const saysWedding = WEDDING_WORDS.some((word) => text.includes(` ${word} `));
  const details =
    (hint.backgrounds.length > 0 || hint.faiths.length > 0 ? 1 : 0) +
    (hint.guestBand ? 1 : 0) +
    (hint.city ? 1 : 0) +
    (hint.date ? 1 : 0);
  return saysWedding || (events.length > 0 && details > 0) ? hint : null;
}
