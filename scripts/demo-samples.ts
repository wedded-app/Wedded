/**
 * Everything else the demo needs so no screen looks empty: the numbers on
 * every sample vendor's My business page, booked days on their calendars,
 * one family's wedding plan (event dates, bookings, saved vendors, family
 * members with reactions and suggestions), that family's chats with vendors
 * (an inquiry each, replies, quotes, a menu and a paid deposit), and leads and
 * chats for a business they run. Running it again replaces all of it.
 *
 *   npm run demo:samples -- [--local] --family=<email> [--business=<vendor-slug>]
 *
 * Run it after the vendors (seed.sql), reels:samples and requests:samples.
 * The sample people use @example.com addresses and never receive email, and
 * every chat is stamped as already notified and pushed, so nothing is sent.
 * Without --local it needs SUPABASE_URL and SUPABASE_SECRET_KEY (connect.ts).
 */
import { connect, fail } from './connect';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/** A date in California, days from today (negative is the past). */
function laDate(days: number): string {
  return new Date(Date.now() + days * DAY).toLocaleDateString('en-CA', {
    timeZone: 'America/Los_Angeles',
  });
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function arg(name: string): string | null {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3).trim() : null;
}

/** Repeatable random numbers, so a vendor gets the same numbers on every run. */
function randomFrom(seed: string): () => number {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// The family's plan --------------------------------------------------------------------------

// Days from the wedding date, and guests, for the events their wedding has
const EVENT_DATES: Record<string, [number, string]> = {
  roka: [-120, '50_100'],
  mehndi: [-2, '100_250'],
  jaago: [-1, '100_250'],
  'anand-karaj': [0, '250_500'],
  reception: [0, '250_500'],
};

// [event, vendor type, vendor]: about half the essentials, 8 months out
const BOOKED: [string, string, string][] = [
  ['roka', 'mithai', 'desi-mithai-house'],
  ['roka', 'thaal-packing', 'shagun-thaal-studio'],
  ['mehndi', 'mehndi-artist', 'mehndi-by-jasleen'],
  ['mehndi', 'dhol', 'gabru-dhol-crew'],
  ['jaago', 'dhol', 'gabru-dhol-crew'],
  ['jaago', 'jaago-decor', 'jaago-crafts-by-bibi'],
  ['anand-karaj', 'gurdwara', 'gurdwara-sahib-sample-lathrop'],
  ['anand-karaj', 'photographer', 'kesri-frames'],
  ['anand-karaj', 'makeup', 'glow-by-simran'],
  ['anand-karaj', 'bridal-boutique', 'nirvair-bridal-boutique'],
  ['reception', 'banquet-hall', 'royal-orchard-banquet-hall'],
  ['reception', 'caterer', 'saffron-tandoor-catering'],
  ['reception', 'photographer', 'kesri-frames'],
  ['reception', 'decorator', 'marigold-stage-decor'],
];

// Still comparing: [event, vendor]
const SAVED: [string, string][] = [
  ['reception', 'valley-beats-dj'],
  ['reception', 'bass-and-bhangra-dj'],
  ['reception', 'glowline-lighting'],
  ['reception', 'doli-diaries-films'],
  ['reception', 'rangla-cinema'],
  ['anand-karaj', 'doli-diaries-films'],
  ['mehndi', 'phulkari-decor-events'],
  ['mehndi', 'pind-village-decor'],
  ['mehndi', 'royal-feast-caterers'],
  ['jaago', 'tandoor-house-catering'],
  ['roka', 'royal-feast-caterers'],
  ['roka', 'mitti-stories-photography'],
];

// The family members planning with them; reactions and suggestions use their index
const MEMBERS = [
  { name: 'Jasvir Kaur', role: 'editor' },
  { name: 'Harjinder Singh', role: 'editor' },
  { name: 'Navdeep Kaur', role: 'suggester' },
];

const REACTIONS: [number, string, 'love' | 'maybe' | 'no'][] = [
  [0, 'royal-orchard-banquet-hall', 'love'],
  [0, 'saffron-tandoor-catering', 'love'],
  [0, 'bass-and-bhangra-dj', 'maybe'],
  [1, 'valley-beats-dj', 'love'],
  [1, 'rangla-cinema', 'no'],
  [1, 'glowline-lighting', 'maybe'],
  [2, 'doli-diaries-films', 'love'],
  [2, 'pind-village-decor', 'love'],
  [2, 'phulkari-decor-events', 'maybe'],
];

const SUGGESTIONS: {
  by: number;
  event: string;
  category: string;
  vendor: string;
  note: string;
  accepted?: boolean;
}[] = [
  {
    by: 2,
    event: 'mehndi',
    category: 'mehndi-artist',
    vendor: 'sukh-henna-art',
    note: 'Sukh did the guest mehndi at Preet’s wedding. Three artists, nobody waited!',
  },
  {
    by: 1,
    event: 'anand-karaj',
    category: 'ghori',
    vendor: 'shahi-ghori-wale',
    note: 'Every groom in our family rode a ghori. Let’s keep it going.',
  },
  {
    by: 0,
    event: 'roka',
    category: 'caterer',
    vendor: 'royal-feast-caterers',
    note: 'They did your cousin’s roka and everyone still talks about the food.',
  },
  {
    by: 0,
    event: 'anand-karaj',
    category: 'makeup',
    vendor: 'glow-by-simran',
    note: 'Simran did Jasleen’s makeup. So pretty and so calm in the morning.',
    accepted: true,
  },
];

// Chats ----------------------------------------------------------------------------------------

type QuoteData = { amount: number; unit: string; guests?: string; note?: string };
type Line = {
  /** Hours after the inquiry. */
  h: number;
  from?: 'family' | 'vendor';
  text?: string;
  quote?: QuoteData;
  /** A menu of the vendor's, by name. */
  menu?: string;
  /** A deposit the vendor asked for, in dollars, paid an hour later. */
  deposit?: number;
  /** The other side reacts to this line. */
  react?: 'heart' | 'thumbs_up' | 'laugh' | 'pray';
  /** Replies to the line this many lines back. */
  replyBack?: number;
};
type Chat = {
  vendor: string;
  events: string[];
  /** Days ago the inquiry was sent. */
  days: number;
  guests: string;
  message: string;
  tour?: boolean;
  answer?: 'booked' | 'deciding';
  /** The family hasn't opened the last message yet. */
  unread?: boolean;
  lines: Line[];
};

// The family's chats with vendors (dates come from their plan)
const FAMILY_CHATS: Chat[] = [
  {
    vendor: 'royal-orchard-banquet-hall',
    events: ['reception'],
    days: 24,
    guests: '250_500',
    tour: true,
    answer: 'booked',
    message:
      'Hi! We would love to see the hall for our reception. About 400 guests, and my parents want to come too.',
    lines: [
      { h: 2, from: 'vendor', text: 'Sat sri akal! Your date is open. Would Saturday at 11 work for a tour?' },
      { h: 3, from: 'family', text: 'Saturday at 11 is perfect. See you then!', react: 'thumbs_up' },
      {
        h: 76,
        from: 'vendor',
        quote: {
          amount: 18500,
          unit: 'event',
          guests: '250_500',
          note: 'Hall, tables and chairs, the stage, the bridal suite, 6 pm to 1 am. Caterers from our approved list.',
        },
      },
      { h: 96, from: 'family', text: 'We all loved it. Let’s book it! 🎉' },
      { h: 97, from: 'vendor', deposit: 1000 },
      {
        h: 99,
        from: 'vendor',
        text: 'Thank you! The date is yours. We will send the floor plan next month.',
        react: 'heart',
      },
    ],
  },
  {
    vendor: 'saffron-tandoor-catering',
    events: ['reception'],
    days: 17,
    guests: '250_500',
    answer: 'booked',
    message: 'Looking for a caterer for our reception, about 400 guests. Live tandoor if possible!',
    lines: [
      { h: 1, from: 'vendor', text: 'Congratulations! Here is the menu most families choose for receptions.' },
      { h: 1.1, from: 'vendor', menu: 'Classic Punjabi' },
      {
        h: 1.2,
        from: 'vendor',
        quote: {
          amount: 28,
          unit: 'person',
          guests: '250_500',
          note: 'Live tandoor and a chaat counter, servers included.',
        },
      },
      { h: 20, from: 'family', text: 'This looks amazing. Can we come for a tasting?' },
      { h: 21, from: 'vendor', text: 'Of course! Next Saturday at 2 pm?' },
      { h: 22, from: 'family', text: 'See you then 🙏', replyBack: 1 },
      {
        h: 200,
        from: 'vendor',
        text: 'So glad the family enjoyed the tasting. You are booked!',
        react: 'pray',
      },
    ],
  },
  {
    vendor: 'gabru-dhol-crew',
    events: ['mehndi', 'jaago'],
    days: 12,
    guests: '100_250',
    answer: 'booked',
    message: 'Two dholis for the mehndi and the jaago, back to back nights. Are you free?',
    lines: [
      { h: 3, from: 'vendor', text: 'Both nights are open! Two dholis, three hours each night.' },
      { h: 3.1, from: 'vendor', quote: { amount: 650, unit: 'event', note: 'Per night, two dholis.' } },
      { h: 5, from: 'family', text: 'Done! The cousins are already practicing their boliyan.' },
      { h: 5.5, from: 'vendor', text: '🥁🥁 See you at the jaago!', react: 'laugh' },
    ],
  },
  {
    vendor: 'kesri-frames',
    events: ['anand-karaj', 'reception'],
    days: 9,
    guests: '250_500',
    answer: 'booked',
    message:
      'Looking for a photographer who knows the Anand Karaj well, for the gurdwara and the reception the same day.',
    lines: [
      { h: 4, from: 'vendor', text: 'Congratulations! We have that day open. Here is our full-day package.' },
      {
        h: 4.1,
        from: 'vendor',
        quote: {
          amount: 4800,
          unit: 'event',
          note: 'Two photographers, the Anand Karaj and the reception, 600+ edited photos and an album.',
        },
      },
      { h: 30, from: 'family', text: 'Booking it! Could you also cover the jaago?' },
      { h: 31, from: 'vendor', text: 'Yes, add $600 for the jaago night. I will update the contract.' },
    ],
  },
  {
    vendor: 'valley-beats-dj',
    events: ['reception'],
    days: 2,
    guests: '250_500',
    unread: true,
    message: 'Hi! DJ for our reception, Bhangra and Bollywood. Do you do lights too?',
    lines: [
      {
        h: 30,
        from: 'vendor',
        text: 'Sat sri akal! We are free on your date, and lights are included. Want the MC in Punjabi and English?',
      },
    ],
  },
  {
    vendor: 'doli-diaries-films',
    events: ['anand-karaj', 'reception'],
    days: 0.3,
    guests: '250_500',
    message: 'Could you send your packages for a highlight film and the full ceremony?',
    lines: [],
  },
];

// Families asking the --business vendor
const LEADS: (Chat & { name: string; town: string; inDays: number })[] = [
  {
    vendor: '',
    name: 'Navneet Dhillon',
    town: 'Yuba City',
    days: 0.2,
    inDays: 210,
    events: ['anand-karaj', 'reception'],
    guests: '250_500',
    message: 'Hi! Looking for a photographer for our Anand Karaj and reception in May. Do you do albums too?',
    lines: [],
  },
  {
    vendor: '',
    name: 'Ravneet Cheema',
    town: 'Live Oak',
    days: 1.1,
    inDays: 95,
    events: ['mehndi'],
    guests: '100_250',
    message: 'Do you cover mehndi nights? Just three hours or so, mostly candids.',
    lines: [],
  },
  {
    vendor: '',
    name: 'Raman Sidhu',
    town: 'Marysville',
    days: 3,
    inDays: 60,
    events: ['jaago'],
    guests: '100_250',
    message: 'Need someone for our jaago, mostly the family dancing!',
    lines: [
      { h: 1, from: 'vendor', text: 'Sat sri akal! We love jaagos. Here is our evening package.' },
      { h: 1.1, from: 'vendor', quote: { amount: 1200, unit: 'event', note: 'One photographer, 8 pm to midnight.' } },
      { h: 5, from: 'family', text: 'Perfect, can we call tomorrow?' },
    ],
  },
  {
    vendor: '',
    name: 'Gurpreet Mann',
    town: 'Sacramento',
    days: 6,
    inDays: 150,
    events: ['anand-karaj', 'reception'],
    guests: '500_plus',
    message: 'Big wedding, about 550 guests. What would full coverage look like?',
    lines: [
      {
        h: 2,
        from: 'vendor',
        quote: {
          amount: 5200,
          unit: 'event',
          note: 'Three photographers for a wedding your size, the album included.',
        },
      },
      { h: 26, from: 'family', text: 'Thank you! Talking it over with the family this weekend.' },
    ],
  },
  {
    vendor: '',
    name: 'Sukhleen Brar',
    town: 'Yuba City',
    days: 10,
    inDays: 30,
    events: ['roka'],
    guests: '50_100',
    message: 'A small roka at home. Two hours of photos?',
    lines: [
      { h: 2, from: 'vendor', text: 'Congratulations! The roka is such a sweet day. Two hours is $650.' },
      { h: 6, from: 'family', text: 'Booked! 🙏', react: 'heart' },
    ],
  },
  {
    vendor: '',
    name: 'Mandeep Johal',
    town: 'Olivehurst',
    days: 16,
    inDays: 120,
    events: ['reception'],
    guests: '250_500',
    message: 'Reception only, at Royal Orchard. Are you free?',
    lines: [
      { h: 3, from: 'vendor', text: 'We shoot at Royal Orchard all the time, and we are free that night!' },
      { h: 3.1, from: 'vendor', quote: { amount: 2800, unit: 'event', note: 'Reception, 6 pm to midnight.' } },
    ],
  },
];

// Numbers ---------------------------------------------------------------------------------------

// Contact taps as a share of page views
const TAPS: [string, number][] = [
  ['call', 0.02],
  ['text', 0.025],
  ['whatsapp', 0.015],
  ['directions', 0.01],
  ['share', 0.012],
  ['instagram', 0.03],
  ['website', 0.015],
];

async function main() {
  const local = process.argv.includes('--local');
  const familyEmail = arg('family');
  const businessSlug = arg('business');
  if (!familyEmail) fail('Usage: npm run demo:samples -- [--local] --family=<email> [--business=<slug>]');
  const db = connect(local);

  const { data: list, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (listError) fail(listError.message);
  const familyId = list.users.find((u) => u.email === familyEmail)?.id;
  if (!familyId) fail(`No account for ${familyEmail}. Sign in once in the app first.`);
  const { data: profile } = await db
    .from('profiles')
    .select('full_name, city, phone')
    .eq('id', familyId)
    .maybeSingle();
  if (!profile) fail(`${familyEmail} has no profile yet. Finish signing up in the app first.`);

  async function person(name: string, email: string, city: string, phone: string): Promise<string> {
    let id = list.users.find((u) => u.email === email)?.id;
    if (!id) {
      const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
      if (error || !data.user) fail(`Couldn't create ${email}: ${error?.message}`);
      id = data.user.id;
    }
    const { error } = await db
      .from('profiles')
      .upsert({ id, full_name: name, city, phone, is_sample: true });
    if (error) fail(`Couldn't save ${name}: ${error.message}`);
    return id;
  }

  const { data: vendorRows, error: vendorError } = await db
    .from('vendors')
    .select('id, slug, founding_number, is_sample')
    .eq('status', 'published');
  if (vendorError) fail(vendorError.message);
  const vendorId = new Map(vendorRows.map((v) => [v.slug as string, v.id as string]));
  const sampleIds = vendorRows.filter((v) => v.is_sample).map((v) => v.id as string);
  const businessId = businessSlug ? vendorId.get(businessSlug) : undefined;
  if (businessSlug && !businessId) fail(`No published vendor with the slug ${businessSlug}`);

  // The family's wedding ---------------------------------------------------------------------
  const { data: owned } = await db
    .from('wedding_members')
    .select('wedding_id, weddings!inner(wedding_date, created_at)')
    .eq('user_id', familyId)
    .eq('role', 'owner')
    .order('joined_at')
    .limit(1);
  const wedding = owned?.[0];
  if (!wedding) fail(`${familyEmail} has no wedding yet. Start one in the app first.`);
  const weddingId = wedding.wedding_id as string;
  const weddingDate =
    ((wedding.weddings as unknown as { wedding_date: string | null }).wedding_date as string) ??
    laDate(240);

  const members: string[] = [];
  for (const [i, m] of MEMBERS.entries()) {
    // 555-01xx numbers are reserved for fiction
    members.push(
      await person(m.name, `sample-demo-family-${i + 1}@example.com`, profile.city as string, `+1530555${String(170 + i).padStart(4, '0')}`),
    );
  }
  await db.from('wedding_members').delete().eq('wedding_id', weddingId).in('user_id', members);
  await db.from('wedding_bookings').delete().eq('wedding_id', weddingId);
  await db.from('wedding_reactions').delete().eq('wedding_id', weddingId);
  await db.from('wedding_suggestions').delete().eq('wedding_id', weddingId);
  await db.from('saved_vendors').delete().eq('user_id', familyId).in('vendor_id', sampleIds);

  const { data: eventRows } = await db
    .from('wedding_events')
    .select('event_slug')
    .eq('wedding_id', weddingId);
  const events = new Set((eventRows ?? []).map((e) => e.event_slug as string));
  const eventDate: Record<string, string> = {};
  for (const slug of events) {
    const [offset, guests] = EVENT_DATES[slug] ?? [0, 'not_sure'];
    eventDate[slug] = addDays(weddingDate, offset);
    const { error } = await db
      .from('wedding_events')
      .update({ event_date: eventDate[slug], guest_band: guests })
      .eq('wedding_id', weddingId)
      .eq('event_slug', slug);
    if (error) fail(`Couldn't date ${slug}: ${error.message}`);
  }
  const ours = <T extends [string, ...unknown[]]>(rows: T[]) =>
    rows.filter(([event]) => events.has(event));

  const { error: memberError } = await db.from('wedding_members').insert(
    MEMBERS.map((m, i) => ({
      wedding_id: weddingId,
      user_id: members[i],
      role: m.role,
      invited_by: familyId,
      joined_at: new Date(Date.now() - (20 - i * 4) * DAY).toISOString(),
    })),
  );
  if (memberError) fail(`Couldn't add the family: ${memberError.message}`);

  const booked = ours(BOOKED).filter(([, , slug]) => vendorId.has(slug));
  const { error: bookError } = await db.from('wedding_bookings').insert(
    booked.map(([event, category, slug]) => ({
      wedding_id: weddingId,
      event_slug: event,
      category_slug: category,
      vendor_id: vendorId.get(slug),
      updated_by: familyId,
    })),
  );
  if (bookError) fail(`Couldn't book: ${bookError.message}`);

  const saves = [...booked.map(([event, , slug]) => [event, slug] as [string, string]), ...ours(SAVED)];
  const seen = new Set<string>();
  const { error: saveError } = await db.from('saved_vendors').insert(
    saves
      .filter(([event, slug]) => vendorId.has(slug) && !seen.has(`${event}/${slug}`) && seen.add(`${event}/${slug}`))
      .map(([event, slug], i) => ({
        user_id: familyId,
        vendor_id: vendorId.get(slug),
        event_slug: event,
        created_at: new Date(Date.now() - (30 - i) * DAY).toISOString(),
      })),
  );
  if (saveError) fail(`Couldn't save vendors: ${saveError.message}`);

  await db.from('wedding_reactions').insert(
    REACTIONS.filter(([, slug]) => vendorId.has(slug)).map(([by, slug, reaction]) => ({
      wedding_id: weddingId,
      vendor_id: vendorId.get(slug),
      user_id: members[by],
      reaction,
    })),
  );
  const { error: suggestError } = await db.from('wedding_suggestions').insert(
    SUGGESTIONS.filter((s) => events.has(s.event) && vendorId.has(s.vendor)).map((s, i) => ({
      wedding_id: weddingId,
      event_slug: s.event,
      category_slug: s.category,
      vendor_id: vendorId.get(s.vendor),
      note: s.note,
      suggested_by: members[s.by],
      status: s.accepted ? 'accepted' : 'open',
      resolved_by: s.accepted ? familyId : null,
      resolved_at: s.accepted ? new Date(Date.now() - 5 * DAY).toISOString() : null,
      created_at: new Date(Date.now() - (6 - i) * DAY).toISOString(),
    })),
  );
  if (suggestError) fail(`Couldn't add suggestions: ${suggestError.message}`);
  console.log(`Planned the wedding: ${booked.length} booked, ${seen.size} saved, ${members.length} family members.`);

  // Chats -------------------------------------------------------------------------------------
  const leadIds: string[] = [];
  for (const [i, lead] of LEADS.entries()) {
    leadIds.push(
      await person(lead.name, `sample-demo-lead-${i + 1}@example.com`, lead.town, `+1530555${String(180 + i).padStart(4, '0')}`),
    );
  }
  // Start over: the family's chats with sample vendors, and the sample leads' chats
  await db.from('inquiries').delete().eq('user_id', familyId).in('vendor_id', sampleIds);
  await db.from('conversations').delete().eq('family_user_id', familyId).in('vendor_id', sampleIds);
  await db.from('inquiries').delete().in('user_id', leadIds);
  await db.from('conversations').delete().in('family_user_id', leadIds);
  await db.from('saved_vendors').delete().in('user_id', leadIds);

  const { data: menus } = await db.from('vendor_menus').select('id, vendor_id, name');
  const phoneOk = (p: unknown) => typeof p === 'string' && /^\+[1-9][0-9]{7,14}$/.test(p);

  async function chat(
    c: Chat,
    who: { id: string; name: string; phone: string; town: string; date: string },
    vendor: string,
    vendorSender: string | null,
  ) {
    const start = Date.now() - c.days * DAY;
    const { data: inquiry, error } = await db
      .from('inquiries')
      .insert({
        user_id: who.id,
        vendor_id: vendor,
        event_slugs: c.events,
        event_date: who.date,
        guest_band: c.guests,
        location: who.town,
        message: c.message,
        preferred_contact: 'text',
        language: 'en',
        details: c.tour ? { tour: true } : {},
        sender_name: who.name,
        sender_phone: who.phone,
        channel: 'email',
        status: 'sent',
        sent_at: new Date(start).toISOString(),
        created_at: new Date(start).toISOString(),
        reply_answer: c.answer ?? null,
        reply_answered_at: c.answer ? new Date(start + 5 * DAY).toISOString() : null,
      })
      .select('id')
      .single();
    if (error) fail(`Couldn't send the inquiry to ${c.vendor}: ${error.message}`);
    // The inquiry opened the chat with its booking card just now; move it back in time
    const { data: card } = await db
      .from('messages')
      .update({ created_at: new Date(start).toISOString(), pushed_at: new Date().toISOString() })
      .eq('inquiry_id', inquiry.id)
      .select('id, conversation_id')
      .single();
    if (!card) fail(`No chat opened for the inquiry to ${c.vendor}`);
    const conversation = card.conversation_id as string;

    const ids: string[] = [card.id as string];
    let last = start;
    let lastVendorAt = 0;
    for (const line of c.lines) {
      const at = Math.min(start + line.h * HOUR, Date.now() - 60 * 1000);
      const role = line.from ?? 'vendor';
      const sender = role === 'family' ? who.id : vendorSender;
      const base = {
        conversation_id: conversation,
        sender_user_id: sender,
        sender_role: role,
        created_at: new Date(at).toISOString(),
        pushed_at: new Date().toISOString(),
        reply_to: line.replyBack ? ids[ids.length - line.replyBack] : null,
      };
      let row: Record<string, unknown>;
      if (line.deposit) {
        const { data: deposit, error: depositError } = await db
          .from('deposits')
          .insert({
            conversation_id: conversation,
            vendor_id: vendor,
            family_user_id: who.id,
            requested_by: vendorSender,
            amount_cents: line.deposit * 100,
            event_slug: c.events[0],
            note: 'Holds your date',
            status: 'paid',
            livemode: false,
            paid_at: new Date(at + HOUR).toISOString(),
            created_at: new Date(at).toISOString(),
          })
          .select('id')
          .single();
        if (depositError) fail(`Couldn't add the deposit: ${depositError.message}`);
        const { data: asked } = await db
          .from('messages')
          .insert({ ...base, kind: 'deposit', body: 'Holds your date', data: { depositId: deposit.id } })
          .select('id')
          .single();
        if (asked) ids.push(asked.id as string);
        row = {
          ...base,
          sender_user_id: null,
          sender_role: 'system',
          created_at: new Date(at + HOUR).toISOString(),
          kind: 'deposit',
          data: { depositId: deposit.id, update: 'paid' },
        };
      } else if (line.quote) {
        row = { ...base, kind: 'quote', data: { ...line.quote, eventSlug: c.events[0], date: who.date } };
      } else if (line.menu) {
        const menu = menus?.find((m) => m.vendor_id === vendor && m.name === line.menu);
        if (!menu) continue;
        row = { ...base, kind: 'menu', data: { menuId: menu.id } };
      } else {
        row = { ...base, kind: 'text', body: line.text, data: {} };
      }
      const { data: sent, error: sendError } = await db.from('messages').insert(row).select('id').single();
      if (sendError) fail(`Couldn't add a message to ${c.vendor}: ${sendError.message}`);
      ids.push(sent.id as string);
      last = Math.max(last, new Date(row.created_at as string).getTime());
      if (role === 'vendor') lastVendorAt = at;
      const reactor = role === 'family' ? vendorSender : who.id;
      if (line.react && reactor) {
        await db.from('message_reactions').insert({
          message_id: sent.id,
          conversation_id: conversation,
          user_id: reactor,
          reaction: line.react,
        });
      }
    }

    const lastAt = new Date(last).toISOString();
    const vendorWaiting = c.lines.length === 0;
    await db
      .from('conversations')
      .update({
        last_message_at: lastAt,
        family_read_at: c.unread && lastVendorAt ? new Date(lastVendorAt - HOUR).toISOString() : lastAt,
        vendor_read_at: vendorWaiting ? null : lastAt,
        family_notified_at: new Date().toISOString(),
        vendor_notified_at: new Date().toISOString(),
        created_at: new Date(start).toISOString(),
      })
      .eq('id', conversation);
  }

  const me = {
    id: familyId,
    name: profile.full_name as string,
    phone: phoneOk(profile.phone) ? (profile.phone as string) : '+15305550142',
    town: profile.city as string,
  };
  let chats = 0;
  for (const c of FAMILY_CHATS) {
    const vendor = vendorId.get(c.vendor);
    if (!vendor) continue;
    await chat(c, { ...me, date: eventDate[c.events[0]] ?? weddingDate }, vendor, null);
    chats += 1;
  }
  if (businessId) {
    await db.from('vendor_members').upsert({ vendor_id: businessId, user_id: familyId, role: 'owner' });
    for (const [i, lead] of LEADS.entries()) {
      const who = { id: leadIds[i], name: lead.name, phone: `+1530555${String(180 + i).padStart(4, '0')}`, town: lead.town, date: laDate(lead.inDays) };
      await chat(lead, who, businessId, familyId);
      // Families who ask usually save the vendor too
      await db.from('saved_vendors').insert({
        user_id: leadIds[i],
        vendor_id: businessId,
        created_at: new Date(Date.now() - lead.days * DAY - HOUR).toISOString(),
      });
      chats += 1;
    }
  }
  console.log(`Started ${chats} chats.`);

  // Numbers for every published vendor: 90 days of page views, searches and contact taps ---------
  const activity: { vendor_id: string; day: string; kind: string; count: number }[] = [];
  for (const v of vendorRows) {
    const rand = randomFrom(v.id as string);
    let base = 3 + rand() * 12;
    if (v.founding_number) base *= 2;
    if (v.id === businessId) base = 24;
    for (let d = 0; d < 90; d += 1) {
      const day = laDate(-d);
      const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
      const weekend = weekday === 0 || weekday === 6 ? 1.5 : 1;
      // Growing: today is busier than three months ago
      const views = Math.round(base * (1 - d / 200) * weekend * (0.7 + rand() * 0.6));
      activity.push({ vendor_id: v.id, day, kind: 'view', count: views });
      activity.push({ vendor_id: v.id, day, kind: 'search', count: Math.round(views * (5 + rand() * 4)) });
      for (const [kind, share] of TAPS) {
        const count = Math.round(views * share * rand() * 2);
        if (count > 0) activity.push({ vendor_id: v.id, day, kind, count });
      }
    }
  }
  for (let i = 0; i < activity.length; i += 2000) {
    const { error } = await db
      .from('vendor_activity_daily')
      .upsert(activity.slice(i, i + 2000), { onConflict: 'vendor_id,day,kind' });
    if (error) fail(`Couldn't save the numbers: ${error.message}`);
  }

  const { data: reels } = await db.from('reels').select('id, created_at').eq('status', 'live');
  const reelViews = (reels ?? []).flatMap((r) => {
    const rand = randomFrom(r.id as string);
    const days = Math.min(14, Math.ceil((Date.now() - new Date(r.created_at as string).getTime()) / DAY) + 7);
    return Array.from({ length: days }, (_, d) => ({
      reel_id: r.id,
      day: laDate(-d),
      count: Math.round((40 + rand() * 260) * (1 - d / 20)),
    }));
  });
  if (reelViews.length) {
    const { error } = await db.from('reel_views_daily').upsert(reelViews, { onConflict: 'reel_id,day' });
    if (error) fail(`Couldn't save reel views: ${error.message}`);
  }
  console.log(`Saved ${activity.length} days of vendor numbers and ${reelViews.length} of reel views.`);

  // Calendars: sample vendors are booked or holding a few weekends ahead ------------------------
  // Vendors the family is talking to stay free on the family's dates
  const theirs = new Set([...booked.map(([, , s]) => s), ...SAVED.map(([, s]) => s), ...FAMILY_CHATS.map((c) => c.vendor)]);
  const familyDates = new Set(Object.values(eventDate));
  await db.from('vendor_unavailable_days').delete().in('vendor_id', sampleIds).gte('day', laDate(0));
  const days: { vendor_id: string; day: string; part: string; status: string }[] = [];
  for (const v of vendorRows.filter((row) => row.is_sample)) {
    const rand = randomFrom(`calendar-${v.id as string}`);
    const picked = new Set<string>();
    const count = v.id === businessId ? 16 : 4 + Math.floor(rand() * 8);
    while (picked.size < count) {
      // A Friday, Saturday or Sunday in the next 300 days
      let day = laDate(3 + Math.floor(rand() * 300));
      while (![0, 5, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay())) day = addDays(day, 1);
      if (theirs.has(v.slug as string) && familyDates.has(day)) continue;
      picked.add(day);
    }
    for (const day of picked) {
      days.push({
        vendor_id: v.id,
        day,
        part: rand() < 0.8 ? 'all_day' : 'evening',
        status: rand() < 0.7 ? 'booked' : 'held',
      });
    }
  }
  const { error: dayError } = await db
    .from('vendor_unavailable_days')
    .upsert(days, { onConflict: 'vendor_id,day,part' });
  if (dayError) fail(`Couldn't fill the calendars: ${dayError.message}`);
  console.log(`Marked ${days.length} booked or held days.\n\nDone.`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
