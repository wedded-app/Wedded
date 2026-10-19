/**
 * Add or update vendors from a JSON file (vision §7: the seed script that
 * "upserts by slug"; how the real hall and every founding vendor go in).
 *
 *   npm run vendors:import -- <file.json> [--local] [--dry-run]
 *
 * The file format is in scripts/vendor-file.ts and the README, with an example
 * in docs/examples/vendor.example.json. Everything is checked first (the
 * file, then category, event, city and linked vendor slugs, and founding
 * numbers against the database); nothing is written unless it all passes.
 * --dry-run stops after the checks.
 *
 * For each vendor it upserts the vendors row by slug (its base city is the
 * listed city it names, or the nearest one to its point), its contacts and
 * languages, vendor_private, and replaces its categories, events and, when
 * "links" is given, the links it makes (both sides confirmed: only list links
 * you checked with both).
 * Photos go in separately with npm run photos:upload.
 *
 * --local uses the local Supabase (`supabase status`). Otherwise set
 * SUPABASE_URL and SUPABASE_SECRET_KEY (the service role key; never commit it).
 */
import { readFileSync } from 'node:fs';

import type { SupabaseClient } from '@supabase/supabase-js';

import { connect, fail } from './connect';
import { parseVendorFile, type VendorInput } from './vendor-file';

function point(latitude: number, longitude: number): string {
  return `SRID=4326;POINT(${longitude} ${latitude})`;
}

type City = { slug: string; name: string; nicknames: string[]; latitude: number; longitude: number };

/** The file's contact fields and the vendor_contacts kind each becomes. */
const CONTACT_KINDS = {
  call_phone: 'call',
  text_phone: 'text',
  whatsapp_phone: 'whatsapp',
  instagram_handle: 'instagram',
  website_url: 'website',
} as const;
const CONTACT_ORDER = ['call', 'text', 'whatsapp', 'email', 'instagram', 'tiktok', 'facebook', 'website'];
const PROVENANCE: Record<string, string> = {
  founder: 'founder_entered',
  claimed: 'claimed',
  self_signup: 'self_signup',
};

/** Whole dollars from the file as cents; undefined (left out) and null (cleared) pass through. */
function cents(value: unknown): number | null | undefined {
  return typeof value === 'number' ? Math.round(value * 100) : (value as null | undefined);
}

/** The vendors row for a file's vendor: everything but contacts and languages, renamed. */
function vendorRecord(row: VendorInput['row'], citySlug: string, location: string) {
  const { city: _city, address_line, travel_note, price_from, price_to, source, ...rest } =
    row as Record<string, unknown>;
  const record: Record<string, unknown> = {
    ...rest,
    base_city_slug: citySlug,
    location,
    public_address: address_line,
    travel_fee_note: travel_note,
    price_from_cents: cents(price_from),
    price_to_cents: cents(price_to),
    provenance: typeof source === 'string' ? PROVENANCE[source] : undefined,
  };
  for (const key of [...Object.keys(CONTACT_KINDS), 'preferred_contact', 'languages']) {
    delete record[key];
  }
  return record;
}

/** Miles between two points, near enough for picking the nearest city. */
function miles(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = Math.PI / 180;
  const x = (b.longitude - a.longitude) * rad * Math.cos(((a.latitude + b.latitude) / 2) * rad);
  const y = (b.latitude - a.latitude) * rad;
  return Math.hypot(x, y) * 3959;
}

function findCity(cities: City[], name: string): City | undefined {
  const wanted = name.trim().toLowerCase();
  return cities.find(
    (city) =>
      city.name.toLowerCase() === wanted ||
      city.slug === wanted ||
      city.nicknames.some((alias) => alias.toLowerCase() === wanted),
  );
}

async function selectAll<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
): Promise<T[]> {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) fail(`Could not read ${table}: ${error.message}`);
  return data as T[];
}

/** Checks that need the database. Returns the map point for each vendor. */
async function checkAgainstDatabase(supabase: SupabaseClient, vendors: VendorInput[]) {
  const [cities, categories, events, languages] = await Promise.all([
    selectAll<City>(supabase, 'cities', 'slug, name, nicknames, latitude, longitude'),
    selectAll<{ slug: string }>(supabase, 'categories', 'slug'),
    selectAll<{ slug: string }>(supabase, 'events', 'slug'),
    selectAll<{ code: string }>(supabase, 'languages', 'code'),
  ]);
  const languageCodes = new Set(languages.map((l) => l.code));
  const categorySlugs = new Set(categories.map((c) => c.slug));
  const eventSlugs = new Set(events.map((e) => e.slug));
  const fileSlugs = new Set(vendors.map((v) => v.row.slug));

  const linkSlugs = [...new Set(vendors.flatMap((v) => v.links.map((l) => l.vendor)))];
  const numbers = vendors.map((v) => v.row.founding_number).filter((n) => typeof n === 'number');
  const [{ data: linked, error: linkError }, { data: founders, error: foundingError }] =
    await Promise.all([
      supabase.from('vendors').select('slug').in('slug', linkSlugs),
      supabase
        .from('vendors')
        .select('id, slug, founding_number, is_sample')
        .in('founding_number', numbers),
    ]);
  if (linkError || foundingError)
    fail(`Could not read vendors: ${(linkError ?? foundingError)!.message}`);
  const existing = new Set((linked ?? []).map((row) => row.slug as string));

  const errors: string[] = [];
  const points = new Map<string, string>();
  const citySlugs = new Map<string, string>();
  // Sample vendors hand their founding number to the real vendor taking it
  const releaseFromSamples: { id: string; slug: string; number: number }[] = [];
  for (const vendor of vendors) {
    const { slug, city, founding_number } = vendor.row;
    const say = (message: string) => errors.push(`${slug}: ${message}`);

    const match = findCity(cities, city);
    if (vendor.point) {
      const at = vendor.point;
      points.set(slug, point(at.latitude, at.longitude));
      const base = match ?? [...cities].sort((a, b) => miles(at, a) - miles(at, b))[0];
      citySlugs.set(slug, base.slug);
    } else {
      if (match) {
        points.set(slug, point(match.latitude, match.longitude));
        citySlugs.set(slug, match.slug);
      } else {
        say(
          `"${city}" is not in the cities list, so there's no centre point. Use a listed city name, or give latitude and longitude (public address only).`,
        );
      }
    }
    for (const category of vendor.categories) {
      if (!categorySlugs.has(category)) say(`no category "${category}".`);
    }
    for (const event of vendor.events) {
      if (!eventSlugs.has(event)) say(`no event "${event}".`);
    }
    for (const code of (vendor.row.languages as string[] | undefined) ?? []) {
      if (!languageCodes.has(code)) say(`no language "${code}".`);
    }
    for (const link of vendor.links) {
      if (!existing.has(link.vendor) && !fileSlugs.has(link.vendor)) {
        say(`links to "${link.vendor}", which is not a vendor yet.`);
      }
    }
    const taken = (founders ?? []).find(
      (row) => row.founding_number === founding_number && row.slug !== slug,
    );
    if (taken?.is_sample) {
      releaseFromSamples.push({ id: taken.id, slug: taken.slug, number: taken.founding_number });
    } else if (taken) {
      say(`founding number ${founding_number} already belongs to ${taken.slug}.`);
    }
  }
  return { errors, points, citySlugs, releaseFromSamples };
}

type Checked = Awaited<ReturnType<typeof checkAgainstDatabase>>;

async function write(supabase: SupabaseClient, vendors: VendorInput[], checked: Checked) {
  const { points, citySlugs, releaseFromSamples } = checked;
  const ids = new Map<string, string>();

  for (const sample of releaseFromSamples) {
    const { error } = await supabase
      .from('vendors')
      .update({ founding_number: null })
      .eq('id', sample.id);
    if (error) fail(`Could not free founding number ${sample.number}: ${error.message}`);
    console.log(`  Sample vendor ${sample.slug} gave up founding number ${sample.number}.`);
  }

  for (const vendor of vendors) {
    const { slug } = vendor.row;
    const { data, error } = await supabase
      .from('vendors')
      .upsert(vendorRecord(vendor.row, citySlugs.get(slug)!, points.get(slug)!), {
        onConflict: 'slug',
      })
      .select('id, status, founding_number')
      .single();
    if (error) fail(`Could not save ${slug}: ${error.message}`);
    const id = data.id as string;
    ids.set(slug, id);

    // Contacts: a field left out keeps its contact, null removes it
    for (const [field, kind] of Object.entries(CONTACT_KINDS)) {
      const value = vendor.row[field];
      if (value === undefined) continue;
      const { error: contactError } =
        value === null
          ? await supabase.from('vendor_contacts').delete().eq('vendor_id', id).eq('kind', kind)
          : await supabase.from('vendor_contacts').upsert(
              { vendor_id: id, kind, value, sort_order: CONTACT_ORDER.indexOf(kind) + 1 },
              { onConflict: 'vendor_id,kind' },
            );
      if (contactError) fail(`Could not save ${slug}'s ${field}: ${contactError.message}`);
    }
    const preferred = vendor.row.preferred_contact;
    if (preferred !== undefined) {
      await supabase.from('vendor_contacts').update({ is_preferred: false }).eq('vendor_id', id);
      if (preferred !== null) {
        const { error: preferredError } = await supabase
          .from('vendor_contacts')
          .update({ is_preferred: true })
          .eq('vendor_id', id)
          .eq('kind', preferred as string);
        if (preferredError) fail(`Could not save ${slug}'s preferred contact: ${preferredError.message}`);
      }
    }
    const spoken = vendor.row.languages as string[] | undefined;
    if (spoken !== undefined) {
      await supabase.from('vendor_languages').delete().eq('vendor_id', id);
      const { error: languageError } = await supabase
        .from('vendor_languages')
        .insert(spoken.map((language_code) => ({ vendor_id: id, language_code })));
      if (languageError) fail(`Could not save ${slug}'s languages: ${languageError.message}`);
    }

    if (vendor.private) {
      const { latitude, longitude, notes, ...rest } = vendor.private;
      const exact =
        latitude !== undefined && longitude !== undefined
          ? point(latitude, longitude)
          : vendor.point
            ? point(vendor.point.latitude, vendor.point.longitude)
            : undefined;
      const { error: privateError } = await supabase
        .from('vendor_private')
        .upsert({
          vendor_id: id,
          ...rest,
          ...(notes !== undefined ? { founder_notes: notes } : {}),
          ...(exact ? { exact_location: exact } : {}),
        });
      if (privateError) fail(`Could not save ${slug}'s private details: ${privateError.message}`);
    }

    // Replace categories: delete first, since positions must stay unique.
    const { error: clearError } = await supabase
      .from('vendor_categories')
      .delete()
      .eq('vendor_id', id);
    if (clearError) fail(`Could not update ${slug}'s categories: ${clearError.message}`);
    const { error: categoryError } = await supabase.from('vendor_categories').insert(
      vendor.categories.map((category_slug, index) => ({
        vendor_id: id,
        category_slug,
        position: index + 1,
      })),
    );
    if (categoryError) fail(`Could not save ${slug}'s categories: ${categoryError.message}`);

    const { error: eventClearError } = await supabase
      .from('vendor_events')
      .delete()
      .eq('vendor_id', id);
    if (eventClearError) fail(`Could not update ${slug}'s events: ${eventClearError.message}`);
    if (vendor.events.length > 0) {
      const { error: eventError } = await supabase
        .from('vendor_events')
        .insert(vendor.events.map((event_slug) => ({ vendor_id: id, event_slug })));
      if (eventError) fail(`Could not save ${slug}'s events: ${eventError.message}`);
    }

    if (vendor.menus) {
      const { error: menuClearError } = await supabase
        .from('vendor_menus')
        .delete()
        .eq('vendor_id', id);
      if (menuClearError) fail(`Could not update ${slug}'s menus: ${menuClearError.message}`);
      if (vendor.menus.length > 0) {
        const { error: menuError } = await supabase
          .from('vendor_menus')
          .insert(vendor.menus.map((menu, i) => ({ ...menu, vendor_id: id, sort_order: i + 1 })));
        if (menuError) fail(`Could not save ${slug}'s menus: ${menuError.message}`);
      }
    }

    const number = data.founding_number ? `, founding #${data.founding_number}` : '';
    console.log(`  ${slug} (${data.status}${number})`);
  }

  // Links last, so they can point at vendors added earlier in the same file.
  const linking = vendors.filter((vendor) => vendor.links.length > 0);
  if (linking.length === 0) return;
  const { data: targets, error: targetError } = await supabase
    .from('vendors')
    .select('id, slug')
    .in('slug', [...new Set(linking.flatMap((v) => v.links.map((l) => l.vendor)))]);
  if (targetError) fail(`Could not read linked vendors: ${targetError.message}`);
  const targetIds = new Map((targets ?? []).map((row) => [row.slug as string, row.id as string]));

  for (const vendor of linking) {
    const id = ids.get(vendor.row.slug)!;
    const { error: clearError } = await supabase
      .from('vendor_links')
      .delete()
      .eq('from_vendor_id', id);
    if (clearError) fail(`Could not update ${vendor.row.slug}'s links: ${clearError.message}`);
    const { error } = await supabase.from('vendor_links').insert(
      vendor.links.map((link) => ({
        from_vendor_id: id,
        to_vendor_id: targetIds.get(link.vendor),
        kind: link.kind,
        from_confirmed_at: new Date().toISOString(),
        to_confirmed_at: new Date().toISOString(),
      })),
    );
    if (error) fail(`Could not save ${vendor.row.slug}'s links: ${error.message}`);
    console.log(`  ${vendor.row.slug}: ${vendor.links.length} link(s)`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((arg) => !arg.startsWith('--'));
  if (!file) fail('Usage: npm run vendors:import -- <file.json> [--local] [--dry-run]');

  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`Could not read ${file}: ${(error as Error).message}`);
  }

  const { vendors, errors, warnings } = parseVendorFile(json);
  for (const warning of warnings) console.warn(`Note: ${warning}`);
  if (errors.length > 0) fail(`Nothing was saved. Fix these first:\n- ${errors.join('\n- ')}`);

  const supabase = connect(args.includes('--local'));
  const checked = await checkAgainstDatabase(supabase, vendors);
  if (checked.errors.length > 0) {
    fail(`Nothing was saved. Fix these first:\n- ${checked.errors.join('\n- ')}`);
  }

  for (const sample of checked.releaseFromSamples) {
    console.log(
      `Note: sample vendor ${sample.slug} will give up founding number ${sample.number}.`,
    );
  }
  if (args.includes('--dry-run')) {
    console.log(`The file looks good: ${vendors.length} vendor(s). Nothing was saved (--dry-run).`);
    return;
  }
  console.log(`Saving ${vendors.length} vendor(s)…`);
  await write(supabase, vendors, checked);
  console.log('Done. Add their photos with npm run photos:upload.');
}

void main();
