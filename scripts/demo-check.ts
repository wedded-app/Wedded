/**
 * Is the November demo ready? Walks the demo path (vision §13) against a
 * database and prints a checklist: what passes, what's missing, what's wrong.
 *
 *   npm run demo:check -- --hall=<slug> [--local] [--send]
 *
 * Checks, in demo order: Reception and its vendor types; the hall first in
 * banquet halls near Yuba City with a price; its profile (founding #1, fact
 * chips, address and phone for Call and Directions, photos, "Real weddings
 * here", two approved caterers); its inquiry email; the Founding Wall; and,
 * as a throwaway signed-in family, saving the hall under Reception and
 * sending a Book a tour request. The family is created without an email and
 * deleted at the end.
 *
 * On the local database the tour request is always sent, and the booking
 * sheet is looked up in Mailpit. On the hosted one it's sent only with
 * --send, because it emails for real (to INQUIRY_TEST_INBOX while testing);
 * that also needs SUPABASE_PUBLISHABLE_KEY.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { connect, fail, settings } from './connect';

type Result = 'pass' | 'warn' | 'fail';
const results: { result: Result; text: string }[] = [];
const MARK: Record<Result, string> = { pass: '✓', warn: '!', fail: '✗' };

function report(result: Result, text: string) {
  results.push({ result, text });
  console.log(`  ${MARK[result]} ${text}`);
}

function check(ok: boolean, text: string, problem: string, level: Result = 'fail') {
  report(ok ? 'pass' : level, ok ? text : problem);
}

const YUBA_CITY = { lat: 39.1404, lng: -121.6169 };
const FACTS = [
  'seated_capacity',
  'outside_catering',
  'alcohol_policy',
  'ghori_allowed',
  'curfew',
  'parking_spaces',
];

async function checkBrowse(db: SupabaseClient, hallSlug: string) {
  console.log('\n1-2. Home → Reception → Banquet hall');
  const { data: reception } = await db
    .from('events')
    .select('name')
    .eq('slug', 'reception')
    .maybeSingle();
  check(Boolean(reception), 'Reception is an event', 'There is no Reception event');

  const { count } = await db
    .from('event_categories')
    .select('*', { count: 'exact', head: true })
    .eq('event_slug', 'reception')
    .eq('category_slug', 'banquet-hall');
  check(
    Boolean(count),
    'Banquet hall is listed under Reception',
    'Reception doesn’t list Banquet hall',
  );

  const { data: results, error } = await db.rpc('search_vendors', {
    lat: YUBA_CITY.lat,
    lng: YUBA_CITY.lng,
    max_miles: 25,
    category_slug: 'banquet-hall',
  });
  if (error) return report('fail', `Search failed: ${error.message}`);
  const position = results.findIndex((row: { slug: string }) => row.slug === hallSlug);
  check(
    position === 0,
    `The hall is first of ${results.length} banquet halls near Yuba City`,
    position < 0
      ? 'The hall is not in banquet halls within 25 mi of Yuba City'
      : `The hall is #${position + 1} near Yuba City, not first`,
    position < 0 ? 'fail' : 'warn',
  );
  const hall = results[position] as { price_display: string } | undefined;
  check(
    Boolean(hall && ['starting_at', 'range'].includes(hall.price_display)),
    'Its result card shows a starting price',
    'Its result card has no starting price',
    'warn',
  );
}

async function checkProfile(db: SupabaseClient, hallSlug: string) {
  console.log('\n3. The hall’s profile');
  const { data: hall } = await db
    .from('vendors')
    .select('id, status, is_sample, founding_number, public_address, details, vendor_contacts(kind)')
    .eq('slug', hallSlug)
    .maybeSingle();
  if (!hall) {
    report('fail', `No vendor with the slug "${hallSlug}". Add it with npm run vendors:import.`);
    return null;
  }
  check(hall.status === 'published', 'Published', `Its status is ${hall.status}, not published`);
  check(!hall.is_sample, 'A real vendor, not a sample', 'It is marked as a sample vendor', 'warn');
  check(
    hall.founding_number === 1,
    'Founding vendor #1',
    hall.founding_number
      ? `Founding vendor #${hall.founding_number}, not #1`
      : 'Not a founding vendor',
    'warn',
  );
  const details = (hall.details ?? {}) as Record<string, unknown>;
  const missing = FACTS.filter((key) => details[key] === undefined);
  check(
    missing.length === 0,
    'All six fact chips (seats, catering, alcohol, ghori, curfew, parking)',
    `Fact chips missing: ${missing.join(', ')}`,
    'warn',
  );
  check(
    (hall.vendor_contacts ?? []).some((c: { kind: string }) => c.kind === 'call'),
    'Call works (phone number set)',
    'No call phone: Call is hidden',
  );
  check(
    Boolean(hall.public_address),
    'Directions works (public address set)',
    'No public address: Directions is hidden',
  );

  const { data: photos } = await db
    .from('vendor_media')
    .select('is_cover')
    .eq('vendor_id', hall.id);
  check(
    (photos ?? []).length >= 3,
    `${photos?.length} photos in the grid`,
    `Only ${photos?.length ?? 0} photos (add theirs with npm run photos:upload)`,
    'warn',
  );
  check(
    (photos ?? []).some((photo) => photo.is_cover),
    'Has a cover photo',
    'No cover photo',
    'warn',
  );

  const { count: tagged } = await db
    .from('vendor_media')
    .select('*', { count: 'exact', head: true })
    .eq('venue_vendor_id', hall.id)
    .neq('vendor_id', hall.id);
  check(
    Boolean(tagged),
    `"Real weddings here" has ${tagged} photos`,
    '"Real weddings here" is empty (npm run photos:upload -- --samples --venue=<slug>)',
    'warn',
  );

  const { data: links } = await db
    .from('vendor_links')
    .select('vendor:vendors!vendor_links_to_vendor_id_fkey(slug, status)')
    .eq('from_vendor_id', hall.id)
    .eq('kind', 'approved_caterer')
    .not('from_confirmed_at', 'is', null)
    .not('to_confirmed_at', 'is', null);
  const caterers = (links ?? []).filter(
    (link) => (link.vendor as unknown as { status: string } | null)?.status === 'published',
  );
  check(
    caterers.length >= 2,
    `${caterers.length} approved caterers`,
    `${caterers.length} approved caterers (the demo shows two)`,
    'warn',
  );

  const { data: privateInfo } = await db
    .from('vendor_private')
    .select('email, checks_email')
    .eq('vendor_id', hall.id)
    .maybeSingle();
  check(
    Boolean(privateInfo?.email) && privateInfo?.checks_email !== false,
    'Inquiries go to the hall’s email',
    'Inquiries are relayed to the founders (no email, or they don’t check it)',
    'warn',
  );
  return hall.id as string;
}

async function checkFoundingWall(db: SupabaseClient, hallSlug: string) {
  console.log('\n5. The Founding 50');
  const { data } = await db
    .from('vendors')
    .select('slug')
    .eq('status', 'published')
    .not('founding_number', 'is', null)
    .order('founding_number')
    .limit(1);
  check(
    data?.[0]?.slug === hallSlug,
    'The hall is first on the Founding Wall',
    `${data?.[0]?.slug ?? 'Nobody'} is first on the Founding Wall`,
    'warn',
  );
}

async function checkAsFamily(admin: SupabaseClient, local: boolean, send: boolean, hallId: string) {
  console.log('\n4 and 6. As a family: Book a tour, then Save to Reception');
  const { url, publishableKey, mailpitUrl } = settings(local);
  if (!local && !send) {
    report('warn', 'Skipped sending a tour request (hosted: add --send; it emails for real)');
    return;
  }
  if (!publishableKey) {
    report('fail', 'Set SUPABASE_PUBLISHABLE_KEY (the app’s key) to act as a family');
    return;
  }

  const email = `demo-check-${Date.now()}@example.com`;
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.error)
    return report('fail', `Could not create a test family: ${created.error.message}`);
  const userId = created.data.user.id;
  try {
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (link.error) return report('fail', `Could not sign in: ${link.error.message}`);
    const family = createClient(url, publishableKey, { auth: { persistSession: false } });
    const signedIn = await family.auth.verifyOtp({
      email,
      token: link.data.properties.email_otp,
      type: 'email',
    });
    check(
      !signedIn.error,
      'Signs in with an email code',
      `Sign-in failed: ${signedIn.error?.message}`,
    );
    if (signedIn.error) return;

    const profile = await family
      .from('profiles')
      .upsert({ id: userId, full_name: 'Demo Check', city: 'Yuba City', phone: '+15305550100' });
    check(!profile.error, 'Fills in About you', `About you failed: ${profile.error?.message}`);

    const saved = await family.rpc('save_vendor', { p_vendor_id: hallId, p_event_slug: 'reception' });
    check(!saved.error, 'Saves the hall', `Saving failed: ${saved.error?.message}`);

    if (mailpitUrl) await fetch(`${mailpitUrl}/api/v1/messages`, { method: 'DELETE' });
    const sent = await family.functions.invoke('send-inquiry', {
      body: {
        vendorId: hallId,
        eventSlugs: ['reception'],
        guestBand: '250_500',
        location: 'Yuba City',
        message: 'Demo check: a test tour request. Please ignore.',
        preferredContact: 'call',
        details: {
          tour: true,
          catering: 'own',
          ghoriDhol: true,
          tourSlots: [{ date: '2027-01-16', part: 'morning' }],
        },
      },
    });
    const status = (sent.data as { status?: string } | null)?.status;
    check(
      status === 'sent' || status === 'queued',
      `Book a tour request ${status}`,
      `Book a tour failed: ${sent.error?.message ?? JSON.stringify(sent.data)}`,
    );

    if (mailpitUrl && status === 'sent') {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const inbox = (await (await fetch(`${mailpitUrl}/api/v1/messages`)).json()) as {
        messages: { Subject: string }[];
      };
      const sheet = inbox.messages.find((m) => m.Subject.startsWith('Tour request'));
      check(
        Boolean(sheet),
        `The booking sheet arrived: "${sheet?.Subject}"`,
        'No booking sheet in Mailpit',
      );
    } else if (status === 'sent') {
      report('pass', 'Check the test inbox for the booking sheet');
    }
  } finally {
    // The inquiry stays (scrubbed), like any deleted account's
    await admin.auth.admin.deleteUser(userId);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const hallSlug = args.find((arg) => arg.startsWith('--hall='))?.slice('--hall='.length);
  if (!hallSlug) fail('Usage: npm run demo:check -- --hall=<slug> [--local] [--send]');
  const local = args.includes('--local');
  const db = connect(local);

  await checkBrowse(db, hallSlug);
  const hallId = await checkProfile(db, hallSlug);
  await checkFoundingWall(db, hallSlug);
  if (hallId) await checkAsFamily(db, local, args.includes('--send'), hallId);

  const failed = results.filter((r) => r.result === 'fail').length;
  const warned = results.filter((r) => r.result === 'warn').length;
  console.log(
    `\n${failed === 0 ? 'Ready' : 'Not ready'}: ${results.length - failed - warned} passed, ${warned} to improve, ${failed} broken.`,
  );
  if (failed > 0) process.exit(1);
}

void main();
