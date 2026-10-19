/**
 * The vendor file for scripts/import-vendors.ts: reading and checking it, with
 * no database access, so it can be tested on its own.
 *
 * A file is one vendor object or a list of them, written flat the way a
 * founder collects a listing: the city by name, phones and languages on the
 * vendor, prices in whole dollars. The importer turns it into vendors (with
 * base_city_slug, public_address from address_line, travel_fee_note from
 * travel_note, prices in cents, provenance from source), vendor_contacts,
 * vendor_languages and vendor_private (founder_notes from notes). Plus:
 *   latitude, longitude  the public map point. Leave both out to use the
 *                        city's centre point (always, for home-based vendors).
 *   categories           category slugs, primary first (1 to 3)
 *   events               event slugs they serve
 *   private              { email, checks_email, street_address, owner_name,
 *                          notes, latitude, longitude }: never shown in the app
 *   links                [{ "vendor": "<slug>", "kind": "approved_caterer" | "worked_at"
 *                          | "often_works_with" | "partner" }] from this vendor (a
 *                        venue, or the first of two vendors) to another. Only
 *                        list links both sides confirmed.
 * Phone numbers can be typed any way: "(530) 555-0101" is stored as +15305550101.
 * Running it again updates the vendor. A field left out keeps its value; set
 * it to null to clear it.
 */
import { normalizePhone } from '../src/features/auth/about-you-validation';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const TEXT_LIMITS = {
  name: 80,
  tagline: 120,
  bio: 2000,
  city: 80,
  address_line: 200,
  travel_note: 300,
  office_hours: 200,
  price_note: 300,
} as const;

const CHOICES = {
  status: ['draft', 'published', 'hidden', 'retired'],
  address_visibility: ['public', 'city_only', 'on_request'],
  preferred_contact: ['call', 'text', 'whatsapp', 'instagram'],
  price_display: ['hidden', 'starting_at', 'range', 'packages', 'contact'],
  price_unit: ['event', 'hour', 'person', 'plate', 'hand', 'turban', 'day'],
  source: ['founder', 'claimed', 'self_signup'],
} as const;

const RADII = [10, 25, 50, 100, 250];

/**
 * Hall facts the profile shows as chips, and what each must be. The importer
 * moves them into venue_policies and the hall's main room (set_hall_facts);
 * other details keys stay in vendors.details.
 */
const DETAIL_CHECKS: Record<string, (value: unknown) => boolean> = {
  seated_capacity: (v) => Number.isInteger(v) && (v as number) > 0,
  in_house_catering: (v) => ['yes', 'no', 'optional'].includes(v as string),
  outside_catering: (v) => ['yes', 'approved_list', 'no'].includes(v as string),
  alcohol_policy: (v) => ['full_bar', 'beer_wine', 'byob', 'dry'].includes(v as string),
  corkage: (v) => Number.isInteger(v) && (v as number) >= 0,
  ghori_allowed: (v) => typeof v === 'boolean',
  dhol_outside_allowed: (v) => typeof v === 'boolean',
  curfew: (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
  parking_spaces: (v) => Number.isInteger(v) && (v as number) > 0,
  security_required: (v) => typeof v === 'boolean',
};

export const HALL_FACT_KEYS = Object.keys(DETAIL_CHECKS);

const VENDOR_KEYS = new Set([
  'slug',
  ...Object.keys(TEXT_LIMITS),
  ...Object.keys(CHOICES),
  'service_radius_miles',
  'will_travel',
  'call_phone',
  'text_phone',
  'whatsapp_phone',
  'instagram_handle',
  'website_url',
  'languages',
  'price_from',
  'price_to',
  'years_in_business',
  'team_size',
  'founding_number',
  'is_sample',
  'last_verified_at',
  'details',
  'latitude',
  'longitude',
  'categories',
  'events',
  'private',
  'links',
  'menus',
]);
const PRIVATE_KEYS = new Set([
  'email',
  'checks_email',
  'street_address',
  'owner_name',
  'notes',
  'latitude',
  'longitude',
]);

export type VendorRow = Record<string, unknown> & { slug: string; name: string; city: string };

export type VendorPrivate = {
  email?: string;
  checks_email?: boolean;
  street_address?: string;
  owner_name?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
};

export const LINK_KINDS = ['approved_caterer', 'worked_at', 'often_works_with', 'partner'] as const;
export type VendorLink = { vendor: string; kind: (typeof LINK_KINDS)[number] };

export type VendorInput = {
  /** Columns for public.vendors, cleaned (phones in E.164, text trimmed), without location. */
  row: VendorRow;
  /** The public point, or null to use the city's centre point. */
  point: { latitude: number; longitude: number } | null;
  categories: string[];
  events: string[];
  private: VendorPrivate | null;
  links: VendorLink[];
  /** Replaces the vendor's menus when given (null: leave them as they are). */
  menus: VendorMenu[] | null;
};

/** A section of dishes as the file gives it; each dish becomes a menu_items row. */
export type VendorMenuSection = {
  title: string;
  items: { name: string; description?: string; diet?: string[] }[];
};

/** A menu as the file gives it, in whole dollars; the database checks the dishes. */
export type VendorMenu = {
  name: string;
  description?: string;
  cuisine?: string;
  diet?: string[];
  price_from?: number;
  price_unit?: 'person' | 'plate' | 'event';
  min_guests?: number;
  sections: VendorMenuSection[];
};

const MENU_DIETS = ['veg', 'non_veg', 'jhatka', 'halal', 'jain', 'eggless', 'vegan', 'gluten_free'];

export type ParseResult = { vendors: VendorInput[]; errors: string[]; warnings: string[] };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function inCalifornia(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    latitude >= 32 &&
    latitude <= 42.1 &&
    longitude >= -124.5 &&
    longitude <= -114
  );
}

function slugList(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) return null;
  return value.map((item) => item.trim());
}

function parseOne(raw: unknown, label: string, errors: string[], warnings: string[]) {
  const fail = (message: string) => errors.push(`${label}: ${message}`);
  if (!isObject(raw)) {
    fail('each vendor must be an object { ... }.');
    return null;
  }

  for (const key of Object.keys(raw)) {
    if (!VENDOR_KEYS.has(key)) warnings.push(`${label}: "${key}" is not a vendor field; skipped.`);
  }

  const row: Record<string, unknown> = {};

  const slug = typeof raw.slug === 'string' ? raw.slug.trim() : '';
  if (!SLUG.test(slug)) fail('slug must be lowercase words joined by dashes, like "sunrise-hall".');
  row.slug = slug;

  for (const [key, limit] of Object.entries(TEXT_LIMITS)) {
    const value = raw[key];
    if (value === undefined) continue;
    if (value === null) {
      row[key] = null;
    } else if (typeof value !== 'string' || value.trim().length === 0) {
      fail(`${key} must be text (or left out).`);
    } else if (value.trim().length > limit) {
      fail(`${key} is ${value.trim().length} characters; the limit is ${limit}.`);
    } else {
      row[key] = value.trim();
    }
  }
  if (!row.name) fail('name is required.');
  if (!row.city) fail('city is required.');

  for (const [key, allowed] of Object.entries(CHOICES)) {
    const value = raw[key];
    if (value === undefined || value === null) continue;
    if (!(allowed as readonly string[]).includes(value as string)) {
      fail(`${key} must be one of: ${allowed.join(', ')}.`);
    } else {
      row[key] = value;
    }
  }

  const visibility = row.address_visibility ?? 'city_only';
  if (row.address_line && visibility !== 'public') {
    fail('address_line is shown to everyone, so it needs "address_visibility": "public".');
  }

  for (const key of ['call_phone', 'text_phone', 'whatsapp_phone']) {
    const value = raw[key];
    if (value === undefined) continue;
    if (value === null) {
      row[key] = null;
      continue;
    }
    const phone = typeof value === 'string' ? normalizePhone(value) : null;
    if (!phone) fail(`${key} "${String(value)}" is not a phone number.`);
    else if (key !== 'whatsapp_phone' && !phone.startsWith('+1')) {
      fail(`${key} must be a US or Canada number.`);
    } else row[key] = phone;
  }

  if (raw.instagram_handle === null) row.instagram_handle = null;
  else if (raw.instagram_handle !== undefined) {
    const handle = String(raw.instagram_handle)
      .trim()
      .replace(/^@/, '')
      .replace(/^https?:\/\/(www\.)?instagram\.com\//, '')
      .replace(/\/.*$/, '');
    if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) fail('instagram_handle is not an Instagram name.');
    else row.instagram_handle = handle;
  }

  if (raw.website_url === null) row.website_url = null;
  else if (raw.website_url !== undefined) {
    if (typeof raw.website_url !== 'string' || !/^https?:\/\/\S+$/.test(raw.website_url.trim())) {
      fail('website_url must start with https://');
    } else row.website_url = raw.website_url.trim();
  }

  if (raw.service_radius_miles !== undefined) {
    if (!RADII.includes(raw.service_radius_miles as number)) {
      fail(`service_radius_miles must be one of ${RADII.join(', ')} (250 = all of NorCal).`);
    } else row.service_radius_miles = raw.service_radius_miles;
  }

  for (const key of ['will_travel', 'is_sample']) {
    if (raw[key] === undefined) continue;
    if (typeof raw[key] !== 'boolean') fail(`${key} must be true or false.`);
    else row[key] = raw[key];
  }

  if (raw.languages !== undefined) {
    const languages = slugList(raw.languages);
    // Which codes exist is checked against the languages table on import
    if (!languages || languages.length === 0 || !languages.every((l) => /^[a-z]{2}$/.test(l))) {
      fail('languages must be a list of language codes, like ["en", "pa"].');
    } else row.languages = [...new Set(languages)];
  }

  for (const key of [
    'price_from',
    'price_to',
    'years_in_business',
    'team_size',
    'founding_number',
  ]) {
    const value = raw[key];
    if (value === undefined) continue;
    if (value === null) {
      row[key] = null;
      continue;
    }
    const min = key === 'years_in_business' ? 0 : 1;
    if (!Number.isInteger(value) || (value as number) < min) {
      fail(`${key} must be a whole number${min === 1 ? ' above 0' : ''}.`);
    } else row[key] = value;
  }

  const display = row.price_display ?? 'contact';
  if (display === 'starting_at' && !(row.price_from && row.price_unit)) {
    fail('"starting_at" prices need price_from and price_unit.');
  }
  if (display === 'range') {
    if (!(row.price_from && row.price_to && row.price_unit)) {
      fail('"range" prices need price_from, price_to and price_unit.');
    } else if ((row.price_to as number) < (row.price_from as number)) {
      fail('price_to is lower than price_from.');
    }
  }

  if (raw.last_verified_at !== undefined) {
    if (
      typeof raw.last_verified_at !== 'string' ||
      Number.isNaN(Date.parse(raw.last_verified_at))
    ) {
      fail('last_verified_at must be a date like "2026-10-15".');
    } else row.last_verified_at = raw.last_verified_at;
  }

  if (raw.details !== undefined) {
    if (!isObject(raw.details)) fail('details must be an object { ... }.');
    else {
      for (const [key, value] of Object.entries(raw.details)) {
        const check = DETAIL_CHECKS[key];
        if (!check) warnings.push(`${label}: details.${key} is not shown in the app yet; kept.`);
        else if (!check(value))
          fail(`details.${key} has a value the app can't show: ${JSON.stringify(value)}.`);
      }
      row.details = raw.details;
    }
  }

  let point: VendorInput['point'] = null;
  if (raw.latitude !== undefined || raw.longitude !== undefined) {
    if (!inCalifornia(raw.latitude, raw.longitude)) {
      fail('latitude and longitude must both be numbers in California, like 39.1404, -121.6169.');
    } else if (visibility !== 'public') {
      fail(
        'latitude and longitude are a public map point: only for vendors with a public address. Leave them out to use the city centre.',
      );
    } else point = { latitude: raw.latitude as number, longitude: raw.longitude as number };
  }

  const categories = raw.categories === undefined ? null : slugList(raw.categories);
  if (!categories || categories.length < 1 || categories.length > 3) {
    fail('categories must list 1 to 3 category slugs, primary first.');
  } else if (new Set(categories).size !== categories.length) {
    fail('categories lists the same category twice.');
  }

  const events = raw.events === undefined ? [] : slugList(raw.events);
  if (!events) fail('events must be a list of event slugs.');

  let privateInfo: VendorPrivate | null = null;
  if (raw.private !== undefined && raw.private !== null) {
    if (!isObject(raw.private)) fail('private must be an object { ... }.');
    else {
      const p = raw.private;
      privateInfo = {};
      for (const key of Object.keys(p)) {
        if (!PRIVATE_KEYS.has(key))
          warnings.push(`${label}: private.${key} is not a field; skipped.`);
      }
      if (p.email !== undefined) {
        const email = String(p.email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('private.email is not an email.');
        else privateInfo.email = email;
      }
      if (p.checks_email !== undefined) {
        if (typeof p.checks_email !== 'boolean')
          fail('private.checks_email must be true or false.');
        else privateInfo.checks_email = p.checks_email;
      }
      for (const key of ['street_address', 'owner_name', 'notes'] as const) {
        if (p[key] === undefined) continue;
        if (typeof p[key] !== 'string' || p[key].trim().length === 0) {
          fail(`private.${key} must be text.`);
        } else privateInfo[key] = p[key].trim();
      }
      if (p.latitude !== undefined || p.longitude !== undefined) {
        if (!inCalifornia(p.latitude, p.longitude)) {
          fail('private.latitude and private.longitude must both be numbers in California.');
        } else {
          privateInfo.latitude = p.latitude as number;
          privateInfo.longitude = p.longitude as number;
        }
      }
    }
  }

  const links: VendorLink[] = [];
  if (raw.links !== undefined) {
    if (!Array.isArray(raw.links)) fail('links must be a list.');
    else {
      for (const link of raw.links) {
        if (
          !isObject(link) ||
          typeof link.vendor !== 'string' ||
          !(LINK_KINDS as readonly string[]).includes(link.kind as string)
        ) {
          fail(`each link needs "vendor" (a slug) and "kind" (${LINK_KINDS.join(', ')}).`);
        } else if (link.vendor === slug) {
          fail('a vendor cannot link to itself.');
        } else {
          links.push({ vendor: link.vendor.trim(), kind: link.kind as VendorLink['kind'] });
        }
      }
    }
  }

  let menus: VendorMenu[] | null = null;
  if (raw.menus !== undefined) {
    if (!Array.isArray(raw.menus)) fail('menus must be a list.');
    else {
      menus = [];
      raw.menus.forEach((menu, i) => {
        const where = `menus[${i + 1}]`;
        if (!isObject(menu) || typeof menu.name !== 'string' || !menu.name.trim()) {
          fail(`${where} needs a name.`);
          return;
        }
        if (
          menu.price_from !== undefined &&
          !(Number.isInteger(menu.price_from) && (menu.price_from as number) > 0)
        ) {
          fail(`${where}.price_from must be a whole number above 0.`);
        }
        if (
          menu.price_from !== undefined &&
          !['person', 'plate', 'event'].includes(menu.price_unit as string)
        ) {
          fail(`${where} with a price needs "price_unit": "plate", "person" or "event".`);
        }
        if (
          menu.min_guests !== undefined &&
          !(Number.isInteger(menu.min_guests) && (menu.min_guests as number) > 0)
        ) {
          fail(`${where}.min_guests must be a whole number above 0.`);
        }
        const diet = menu.diet === undefined ? [] : menu.diet;
        if (!Array.isArray(diet) || !diet.every((d) => MENU_DIETS.includes(d as string))) {
          fail(`${where}.diet must be a list from ${MENU_DIETS.join(', ')}.`);
        }
        const sections = menu.sections === undefined ? [] : menu.sections;
        if (
          !Array.isArray(sections) ||
          !sections.every(
            (s) =>
              isObject(s) &&
              typeof s.title === 'string' &&
              Array.isArray(s.items) &&
              s.items.every((item) => isObject(item) && typeof item.name === 'string'),
          )
        ) {
          fail(`${where}.sections must be [{ "title": "...", "items": [{ "name": "..." }] }].`);
        }
        menus!.push({
          ...(menu as VendorMenu),
          name: menu.name.trim(),
          sections: sections as VendorMenuSection[],
        });
      });
    }
  }

  return {
    row: row as VendorRow,
    point,
    categories: categories ?? [],
    events: events ?? [],
    private: privateInfo,
    links,
    menus,
  };
}

/** Check a parsed vendor file. Nothing should be written unless errors is empty. */
export function parseVendorFile(json: unknown): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const list = Array.isArray(json) ? json : [json];
  if (list.length === 0) errors.push('The file has no vendors.');

  const vendors: VendorInput[] = [];
  list.forEach((raw, index) => {
    const name = isObject(raw) && typeof raw.slug === 'string' ? raw.slug : `vendor ${index + 1}`;
    const before = errors.length;
    const vendor = parseOne(raw, name, errors, warnings);
    if (vendor && errors.length === before) vendors.push(vendor);
  });

  const seen = new Map<string, string>();
  for (const vendor of vendors) {
    if (seen.has(vendor.row.slug)) errors.push(`${vendor.row.slug}: listed twice in the file.`);
    seen.set(vendor.row.slug, vendor.row.slug);
  }
  const numbers = vendors.map((v) => v.row.founding_number).filter((n) => n !== undefined);
  if (new Set(numbers).size !== numbers.length) {
    errors.push('Two vendors in the file have the same founding_number.');
  }

  return { vendors, errors, warnings };
}
