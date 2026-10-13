import type {
  ListingLanguage,
  Listing,
  ContactMethod,
  PriceDisplay,
  PriceUnit,
  ServiceRadius,
} from '@/data/listing';
import { normalizePhone } from '@/features/auth/about-you-validation';

/** Every field a vendor can change themselves. */
export type EditableListing = Omit<Listing, 'name' | 'slug' | 'status' | 'city'>;

/** The listing editor's sections, in reading order. */
export type ListingSection = 'about' | 'price' | 'contact' | 'languages';
export const LISTING_SECTIONS: ListingSection[] = ['about', 'price', 'contact', 'languages'];

/** Which section a page checklist item is fixed in (photos and the cover aren't here yet). */
export function sectionFor(key: string): ListingSection | null {
  switch (key) {
    case 'tagline':
    case 'bio':
    case 'bioPa':
      return 'about';
    case 'price':
      return 'price';
    case 'contact':
    case 'instagram':
      return 'contact';
    case 'languages':
      return 'languages';
    default:
      return null;
  }
}

/** What the editor holds: text for what people type, '' for blank. */
export type ListingDraft = {
  tagline: string;
  taglinePa: string;
  bio: string;
  bioPa: string;
  priceDisplay: PriceDisplay;
  priceFrom: string;
  priceTo: string;
  priceUnit: PriceUnit | null;
  priceNote: string;
  callPhone: string;
  textPhone: string;
  whatsappPhone: string;
  preferredContact: ContactMethod | null;
  instagramHandle: string;
  websiteUrl: string;
  languages: ListingLanguage[];
  yearsInBusiness: string;
  teamSize: string;
  serviceRadiusMiles: ServiceRadius | null;
  willTravel: boolean;
  travelNote: string;
  officeHours: string;
};

export const TAGLINE_MAX = 120;
export const BIO_MAX = 2000;

export function listingToDraft(listing: Listing): ListingDraft {
  const text = (value: string | null) => value ?? '';
  const number = (value: number | null) => (value === null ? '' : String(value));
  return {
    tagline: text(listing.tagline),
    taglinePa: text(listing.taglinePa),
    bio: text(listing.bio),
    bioPa: text(listing.bioPa),
    priceDisplay: listing.priceDisplay ?? 'contact',
    priceFrom: number(listing.priceFrom),
    priceTo: number(listing.priceTo),
    priceUnit: listing.priceUnit,
    priceNote: text(listing.priceNote),
    callPhone: text(listing.callPhone),
    textPhone: text(listing.textPhone),
    whatsappPhone: text(listing.whatsappPhone),
    preferredContact: listing.preferredContact,
    instagramHandle: text(listing.instagramHandle),
    websiteUrl: text(listing.websiteUrl),
    languages: listing.languages ?? [],
    yearsInBusiness: number(listing.yearsInBusiness),
    teamSize: number(listing.teamSize),
    serviceRadiusMiles: listing.serviceRadiusMiles,
    willTravel: listing.willTravel ?? false,
    travelNote: text(listing.travelNote),
    officeHours: text(listing.officeHours),
  };
}

export type DraftProblem = {
  field: keyof EditableListing;
  /** A key under business.listing.problems */
  kind:
    | 'taglineLong'
    | 'bioLong'
    | 'priceFrom'
    | 'priceTo'
    | 'priceUnit'
    | 'phone'
    | 'languages'
    | 'number';
};

/** Whole numbers above 0 from what was typed, or null for blank; NaN when it isn't one. */
function wholeNumber(text: string): number | null {
  const trimmed = text.trim().replace(/[$,\s]/g, '');
  if (!trimmed) return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

const valid = (n: number | null) => n === null || (Number.isInteger(n) && n > 0);

/**
 * The fields that changed, ready for useUpdateListing (null clears one), or
 * the first problem to fix, in the order the screen shows them.
 */
export function draftChanges(
  listing: Listing,
  draft: ListingDraft,
): { changes: Partial<EditableListing>; problem: DraftProblem | null } {
  const orNull = (text: string) => text.trim() || null;

  if (draft.tagline.trim().length > TAGLINE_MAX) {
    return { changes: {}, problem: { field: 'tagline', kind: 'taglineLong' } };
  }
  if (draft.taglinePa.trim().length > TAGLINE_MAX) {
    return { changes: {}, problem: { field: 'taglinePa', kind: 'taglineLong' } };
  }
  if (draft.bio.trim().length > BIO_MAX) {
    return { changes: {}, problem: { field: 'bio', kind: 'bioLong' } };
  }
  if (draft.bioPa.trim().length > BIO_MAX) {
    return { changes: {}, problem: { field: 'bioPa', kind: 'bioLong' } };
  }

  const priced = draft.priceDisplay === 'starting_at' || draft.priceDisplay === 'range';
  const priceFrom = priced ? wholeNumber(draft.priceFrom) : null;
  const priceTo = draft.priceDisplay === 'range' ? wholeNumber(draft.priceTo) : null;
  if (priced && (priceFrom === null || !valid(priceFrom))) {
    return { changes: {}, problem: { field: 'priceFrom', kind: 'priceFrom' } };
  }
  if (
    draft.priceDisplay === 'range' &&
    (priceTo === null || !valid(priceTo) || (priceFrom ?? 0) > priceTo)
  ) {
    return { changes: {}, problem: { field: 'priceTo', kind: 'priceTo' } };
  }
  if (priced && !draft.priceUnit) {
    return { changes: {}, problem: { field: 'priceUnit', kind: 'priceUnit' } };
  }

  const phones = {} as Record<'callPhone' | 'textPhone' | 'whatsappPhone', string | null>;
  for (const field of ['callPhone', 'textPhone', 'whatsappPhone'] as const) {
    const typed = draft[field].trim();
    // Unchanged numbers stay as stored, whatever form they're shown in
    if (typed === (listing[field] ?? '')) {
      phones[field] = listing[field];
      continue;
    }
    const e164 = typed ? normalizePhone(typed) : null;
    if (typed && !e164) return { changes: {}, problem: { field, kind: 'phone' } };
    phones[field] = e164;
  }

  if (draft.languages.length === 0) {
    return { changes: {}, problem: { field: 'languages', kind: 'languages' } };
  }
  const years = wholeNumber(draft.yearsInBusiness);
  if (!valid(years)) return { changes: {}, problem: { field: 'yearsInBusiness', kind: 'number' } };
  const team = wholeNumber(draft.teamSize);
  if (!valid(team)) return { changes: {}, problem: { field: 'teamSize', kind: 'number' } };

  const next: EditableListing = {
    tagline: orNull(draft.tagline),
    taglinePa: orNull(draft.taglinePa),
    bio: orNull(draft.bio),
    bioPa: orNull(draft.bioPa),
    priceDisplay: draft.priceDisplay,
    priceFrom,
    priceTo,
    priceUnit: priced ? draft.priceUnit : null,
    priceNote: orNull(draft.priceNote),
    ...phones,
    preferredContact: draft.preferredContact,
    instagramHandle: orNull(draft.instagramHandle),
    websiteUrl: orNull(draft.websiteUrl),
    languages: draft.languages,
    yearsInBusiness: years,
    teamSize: team,
    serviceRadiusMiles: draft.serviceRadiusMiles,
    willTravel: draft.willTravel,
    travelNote: orNull(draft.travelNote),
    officeHours: orNull(draft.officeHours),
  };

  const changes: Partial<EditableListing> = {};
  for (const key of Object.keys(next) as (keyof EditableListing)[]) {
    const before = listing[key];
    const after = next[key];
    const same = Array.isArray(after)
      ? Array.isArray(before) &&
        before.length === after.length &&
        after.every((v) => (before as string[]).includes(v))
      : before === after;
    if (!same) (changes as Record<string, unknown>)[key] = after;
  }
  return { changes, problem: null };
}
