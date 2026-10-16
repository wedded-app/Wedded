/**
 * Sample requests for the demo (#217): families near Yuba City asking for
 * vendors, so the Families looking feed and the Proposals inbox have
 * something real to show. Running it again replaces the earlier samples.
 *
 *   npm run requests:samples -- [--local] [--pro=<vendor-slug>] [--family=<email or +phone>]
 *
 * --pro       Gives that vendor a Wedded Pro subscription marked as a demo
 *             (no Stripe), so its people see the feed, and posts extra
 *             requests in its own categories near it.
 * --family    Posts two requests to that person's wedding (the first one they
 *             own) with proposals from published vendors, for the inbox.
 *
 * The sample families use @example.com addresses and never receive email.
 * Without --local it needs SUPABASE_URL and SUPABASE_SECRET_KEY (connect.ts).
 */
import { connect, fail } from './connect';

type Ask = {
  category: string;
  event: string | null;
  days: number | null;
  guests: string;
  budget: [number, number] | null;
  note: string;
};

type SampleFamily = { name: string; town: string; ago: number; asks: Ask[] };

// ago: hours since the first request was posted, so the feed reads as alive
const FAMILIES: SampleFamily[] = [
  {
    name: 'Harjit Kaur',
    town: 'yuba-city',
    ago: 0.3,
    asks: [
      {
        category: 'dhol',
        event: 'jaago',
        days: 46,
        guests: '100_250',
        budget: [400, 900],
        note: 'Two dhol players for our jaago, from about 9pm until late. The family loves Bhangra, so the louder the better!',
      },
      {
        category: 'mehndi-artist',
        event: 'mehndi',
        days: 44,
        guests: '50_100',
        budget: [600, 1200],
        note: 'Bridal mehndi for my daughter (full arms and feet), plus simple designs for about 25 guests.',
      },
    ],
  },
  {
    name: 'Aman Gill',
    town: 'marysville',
    ago: 1.5,
    asks: [
      {
        category: 'photographer',
        event: 'whole-wedding',
        days: 120,
        guests: '250_500',
        budget: [3500, 6000],
        note: 'Looking for a photographer who knows the Anand Karaj well, for the gurdwara, the milni and the reception.',
      },
      {
        category: 'videographer',
        event: 'whole-wedding',
        days: 120,
        guests: '250_500',
        budget: [3000, 5500],
        note: 'A highlight film and the full ceremony. Drone shots would be a beautiful extra.',
      },
    ],
  },
  {
    name: 'Priya Sharma',
    town: 'sacramento',
    ago: 3,
    asks: [
      {
        category: 'dj',
        event: 'sangeet',
        days: 75,
        guests: '100_250',
        budget: [1200, 2500],
        note: 'Bollywood and Punjabi mix for our sangeet, with lights for a small dance floor. The family is doing four performances.',
      },
      {
        category: 'makeup',
        event: 'shadi',
        days: 77,
        guests: 'not_sure',
        budget: [500, 1000],
        note: 'Bridal makeup and hair on the morning of the wedding, plus my mom and sister if you have time.',
      },
    ],
  },
  {
    name: 'Zara Ahmed',
    town: 'roseville',
    ago: 6,
    asks: [
      {
        category: 'caterer',
        event: 'walima',
        days: 95,
        guests: '250_500',
        budget: [12000, 20000],
        note: 'Halal catering for the walima, about 300 guests. Biryani, karahi and a dessert table.',
      },
      {
        category: 'decorator',
        event: 'nikah',
        days: 94,
        guests: '100_250',
        budget: [2500, 5000],
        note: 'Soft florals and a simple stage for the nikah. Ivory and blush colours.',
      },
    ],
  },
  {
    name: 'Jaspreet Dhillon',
    town: 'live-oak',
    ago: 11,
    asks: [
      {
        category: 'banquet-hall',
        event: 'reception',
        days: 160,
        guests: '500_plus',
        budget: [8000, 15000],
        note: 'A hall for our reception with room for 550 people and a big dance floor. A Saturday in spring.',
      },
      {
        category: 'dhol',
        event: 'baraat',
        days: 161,
        guests: '250_500',
        budget: [300, 700],
        note: 'Dhol for the baraat, about 45 minutes from the hotel to the gurdwara.',
      },
    ],
  },
  {
    name: 'Ravneet Sidhu',
    town: 'yuba-city',
    ago: 20,
    asks: [
      {
        category: 'florist',
        event: 'anand-karaj',
        days: 58,
        guests: '250_500',
        budget: [1500, 3000],
        note: 'Fresh flowers for the palki sahib and garlands for the milni. Marigolds and white roses.',
      },
      {
        category: 'photographer',
        event: 'jaago',
        days: 56,
        guests: '100_250',
        budget: null,
        note: 'Just the jaago night, candid photos of the family dancing. Not sure on budget yet.',
      },
    ],
  },
  {
    name: 'Neha Patel',
    town: 'sacramento',
    ago: 30,
    asks: [
      {
        category: 'mehndi-artist',
        event: 'mehndi',
        days: 33,
        guests: '100_250',
        budget: [800, 1500],
        note: 'Two artists for a mehndi party on a Friday evening. The bride wants an Arabic style.',
      },
      {
        category: 'dj',
        event: 'reception',
        days: 35,
        guests: '250_500',
        budget: [1500, 3000],
        note: 'DJ and an MC who can switch between English, Hindi and Punjabi for the reception.',
      },
    ],
  },
  {
    name: 'Manpreet Bains',
    town: 'marysville',
    ago: 52,
    asks: [
      {
        category: 'caterer',
        event: 'langar',
        days: 64,
        guests: '500_plus',
        budget: null,
        note: 'Help with a vegetarian meal for the whole sangat after the Anand Karaj. Fresh rotis on site would be amazing.',
      },
      {
        category: 'makeup',
        event: 'reception',
        days: 65,
        guests: 'not_sure',
        budget: [300, 700],
        note: 'Evening look for the reception, something softer than the morning.',
      },
    ],
  },
];

// For a --pro vendor's categories that the list above doesn't cover
const EXTRA_NOTES = [
  'We would love to hear what you offer for our wedding. Flexible on the details.',
  'Planning for a big family celebration and looking for someone experienced with our traditions.',
  'Our date is set and we are comparing a few options this month. Pictures of past work would help!',
  'Simple and elegant is what we are after. Happy to talk through the details.',
];
const EXTRA_TOWNS = ['yuba-city', 'marysville', 'live-oak', 'sacramento'];

// What sample vendors say in their proposals
const PROPOSAL_NOTES: Record<string, string[]> = {
  dhol: [
    'Two dholis and a Bhangra boliyan set, 9pm to midnight. We bring our own lights for the jaago.',
    'Sat sri akal! We play every jaago in Yuba City; we can add a nagara for the entrance.',
    'Three hours, two players, and we teach the kids a few beats. Happy to come to the house.',
  ],
  photographer: [
    'Full coverage with two shooters, an online gallery within three weeks and a printed album.',
    'We have shot over 80 Anand Karajs. Candid first, with a few family portraits outside.',
    'Morning to the end of the reception, with a sneak peek of 30 photos the next day.',
  ],
};
const GENERIC_PROPOSAL_NOTES = [
  'We would love to be part of your day. Here is what we usually do for an event like yours.',
  'Your date is open for us. Happy to adjust the package to fit your plans.',
  'Experienced with Punjabi weddings; references from families in the area on request.',
];

const PRICES: Record<string, [number, string][]> = {
  dhol: [
    [550, 'event'],
    [180, 'hour'],
    [700, 'event'],
  ],
  photographer: [
    [4200, 'event'],
    [3600, 'event'],
    [450, 'hour'],
  ],
};

const DAY = 24 * 60 * 60 * 1000;

function laDate(days: number): string {
  const d = new Date(Date.now() + days * DAY);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

/** Closes the day after the event (California), like post_request; 90 days without a date. */
function expiresAt(eventDate: string | null): string {
  if (!eventDate) return new Date(Date.now() + 90 * DAY).toISOString();
  return new Date(new Date(`${eventDate}T00:00:00-08:00`).getTime() + DAY).toISOString();
}

function arg(name: string): string | null {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3).trim() : null;
}

async function main() {
  const local = process.argv.includes('--local');
  const proSlug = arg('pro');
  const familyLogin = arg('family');
  const db = connect(local);

  const { data: list, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (listError) fail(listError.message);

  async function person(name: string, email: string, town: string, phone: string): Promise<string> {
    let id = list.users.find((u) => u.email === email)?.id;
    if (!id) {
      const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
      if (error || !data.user) fail(`Couldn't create ${email}: ${error?.message}`);
      id = data.user.id;
    }
    const { data: city } = await db.from('cities').select('name').eq('slug', town).single();
    const { error } = await db
      .from('profiles')
      .upsert({ id, full_name: name, city: city?.name ?? 'Yuba City', phone, is_sample: true });
    if (error) fail(`Couldn't save ${name}: ${error.message}`);
    return id;
  }

  // Only categories, events and towns the database has
  const [{ data: categories }, { data: events }, { data: towns }] = await Promise.all([
    db.from('categories').select('slug'),
    db.from('events').select('slug'),
    db.from('cities').select('slug'),
  ]);
  const has = (rows: { slug: string }[] | null, slug: string | null) =>
    slug === null || (rows ?? []).some((r) => r.slug === slug);

  // Start over ------------------------------------------------------------------------------
  const sampleIds: string[] = [];
  for (const [i, family] of FAMILIES.entries()) {
    sampleIds.push(
      await person(
        family.name,
        `sample-requests-family-${i + 1}@example.com`,
        family.town,
        // 555-01xx numbers are reserved for fiction
        `+1530555${String(150 + i).padStart(4, '0')}`,
      ),
    );
  }
  const { error: clearError } = await db.from('weddings').delete().in('created_by', sampleIds);
  if (clearError) fail(clearError.message);

  async function weddingFor(userId: string, title: string, days: number): Promise<string> {
    const { data, error } = await db
      .from('weddings')
      .insert({ title, wedding_date: laDate(days), planning_for: 'self', created_by: userId })
      .select('id')
      .single();
    if (error) fail(`Couldn't make ${title}: ${error.message}`);
    const { error: memberError } = await db
      .from('wedding_members')
      .upsert({ wedding_id: data.id, user_id: userId, role: 'owner' });
    if (memberError) fail(memberError.message);
    return data.id;
  }

  async function post(
    weddingId: string,
    userId: string,
    town: string,
    ask: Ask,
    hoursAgo: number,
  ): Promise<string | null> {
    if (!has(categories, ask.category) || !has(events, ask.event) || !has(towns, town)) {
      console.warn(`Skipping ${ask.category} in ${town}: not in this database`);
      return null;
    }
    const eventDate = ask.days === null ? null : laDate(ask.days);
    const { data, error } = await db
      .from('wedding_requests')
      .insert({
        wedding_id: weddingId,
        created_by: userId,
        category_slug: ask.category,
        event_slug: ask.event,
        event_date: eventDate,
        guest_band: ask.guests,
        budget_min_cents: ask.budget ? ask.budget[0] * 100 : null,
        budget_max_cents: ask.budget ? ask.budget[1] * 100 : null,
        note: ask.note,
        city_slug: town,
        expires_at: expiresAt(eventDate),
        created_at: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();
    if (error?.code === '23505') {
      console.warn(`Skipping ${ask.category}: that wedding already has one open`);
      return null;
    }
    if (error) fail(`Couldn't post ${ask.category}: ${error.message}`);
    return data.id;
  }

  // Families looking ---------------------------------------------------------------------------
  let posted = 0;
  const firstWedding: { id: string; user: string }[] = [];
  for (const [i, family] of FAMILIES.entries()) {
    const userId = sampleIds[i];
    const days = Math.max(...family.asks.map((a) => a.days ?? 0), 30);
    const weddingId = await weddingFor(userId, `${family.name.split(' ')[0]}'s wedding`, days);
    firstWedding.push({ id: weddingId, user: userId });
    for (const [j, ask] of family.asks.entries()) {
      if (await post(weddingId, userId, family.town, ask, family.ago + j * 0.7)) posted += 1;
    }
  }

  // Wedded Pro for one vendor, and requests in its own categories ------------------------------
  if (proSlug) {
    const { data: vendor, error } = await db
      .from('vendors')
      .select('id, name, vendor_categories(category_slug)')
      .eq('slug', proSlug)
      .maybeSingle();
    if (error || !vendor) fail(`No vendor with the slug ${proSlug}`);
    const { error: proError } = await db.from('vendor_subscriptions').upsert({
      vendor_id: vendor.id,
      status: 'active',
      current_period_end: new Date(Date.now() + 30 * DAY).toISOString(),
      cancel_at_period_end: false,
      livemode: false,
    });
    if (proError) fail(`Couldn't make ${proSlug} Pro: ${proError.message}`);

    const covered = (slug: string) =>
      FAMILIES.flatMap((f) => f.asks).filter((a) => a.category === slug).length;
    let n = 0;
    for (const { category_slug: slug } of vendor.vendor_categories as { category_slug: string }[]) {
      for (let k = covered(slug); k < 3; k += 1) {
        const target = firstWedding[n % firstWedding.length];
        const ask: Ask = {
          category: slug,
          event: null,
          days: 40 + n * 13,
          guests: ['100_250', '250_500', '50_100'][n % 3],
          budget: null,
          note: EXTRA_NOTES[n % EXTRA_NOTES.length],
        };
        if (await post(target.id, target.user, EXTRA_TOWNS[n % EXTRA_TOWNS.length], ask, 2 + n * 5))
          posted += 1;
        n += 1;
      }
    }
    console.log(`${vendor.name} is on Wedded Pro (demo, no Stripe).`);
  }

  // Proposals for a real family ------------------------------------------------------------------
  if (familyLogin) {
    const user = list.users.find(
      (u) => u.email === familyLogin || (u.phone && `+${u.phone}` === familyLogin),
    );
    if (!user) fail(`No account with ${familyLogin}`);
    const { data: owned } = await db
      .from('wedding_members')
      .select('wedding_id')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .order('joined_at')
      .limit(1);
    const wedding = owned?.[0];
    if (!wedding) fail(`${familyLogin} doesn't own a wedding yet`);

    const asks: Ask[] = [
      {
        category: 'dhol',
        event: 'jaago',
        days: null,
        guests: '100_250',
        budget: [400, 900],
        note: 'Looking for dhol for our jaago night. Two players, from 9pm until late.',
      },
      {
        category: 'photographer',
        event: 'whole-wedding',
        days: null,
        guests: '250_500',
        budget: [3000, 6000],
        note: 'A photographer for the whole wedding: the Anand Karaj, the milni and the reception.',
      },
    ];
    // Replace this script's earlier requests on the family's wedding only
    await db
      .from('wedding_requests')
      .delete()
      .eq('wedding_id', wedding.wedding_id)
      .in(
        'note',
        asks.map((a) => a.note),
      );

    const { data: weddingRow } = await db
      .from('weddings')
      .select('wedding_date')
      .eq('id', wedding.wedding_id)
      .single();
    const weddingDate: string | null = weddingRow?.wedding_date ?? null;
    for (const [i, ask] of asks.entries()) {
      const requestId = await post(wedding.wedding_id, user.id, 'yuba-city', ask, 5 + i * 3);
      if (!requestId) continue;
      if (weddingDate) {
        await db
          .from('wedding_requests')
          .update({ event_date: weddingDate, expires_at: expiresAt(weddingDate) })
          .eq('id', requestId);
      }
      const { data: vendors } = await db
        .from('vendor_categories')
        .select('vendor_id, vendors!inner(status)')
        .eq('category_slug', ask.category)
        .eq('vendors.status', 'published')
        .order('position')
        .limit(3);
      const notes = PROPOSAL_NOTES[ask.category] ?? GENERIC_PROPOSAL_NOTES;
      const prices = PRICES[ask.category] ?? [];
      const rows = (vendors ?? []).map((v, k) => ({
        request_id: requestId,
        vendor_id: v.vendor_id,
        note: notes[k % notes.length],
        price_cents: prices[k] ? prices[k][0] * 100 : null,
        price_unit: prices[k] ? prices[k][1] : null,
        created_at: new Date(Date.now() - (4 - k) * 60 * 60 * 1000).toISOString(),
      }));
      if (rows.length > 0) {
        const { error } = await db.from('request_proposals').insert(rows);
        if (error) fail(`Couldn't add proposals: ${error.message}`);
        await db
          .from('wedding_requests')
          .update({ proposal_count: rows.length })
          .eq('id', requestId);
      }
      console.log(`${ask.category} request for ${familyLogin}: ${rows.length} proposals`);
    }
  }

  console.log(`\n${posted} sample requests posted by ${FAMILIES.length} families.`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
