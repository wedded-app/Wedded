/**
 * Sample reels for the local app (or a test project): uploads the clips in a
 * folder and posts them as sample families and sample vendors, with vendor
 * tags, likes, comments and follows, so the Reels tab has something to
 * scroll. Running it again replaces the earlier samples.
 *
 *   npm run reels:samples -- <folder> [--local]
 *
 * The folder holds <name>.mp4 and <name>.jpg (its thumbnail) for each clip in
 * CLIPS below; reel-samples/ in the repo root is gitignored for this. The
 * sample people use @example.com addresses and never receive email.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { connect, fail } from './connect';

type Poster = { family: string } | { vendorCategory: string } | { vendor: string };

const FAMILIES = [
  'Simran Kaur',
  'Ayesha Khan',
  'Harpreet Sandhu',
  'Neha Sharma',
  'Gurleen Kaur',
  'Jaspreet Dhillon',
  'Mehak Gill',
  'Arjun Mehta',
  'Sana Malik',
  'Ravinder Sidhu',
  'Komal Brar',
  'Imran Qureshi',
];

// Each clip: who posts it, the caption, the event, and the vendor types to tag
const CLIPS: {
  file: string;
  poster: Poster;
  caption: string;
  event: string;
  tags: string[];
  seconds?: number;
}[] = [
  {
    file: 'baraat-ghori',
    poster: { family: 'Harpreet Sandhu' },
    caption: 'The ghori, the dhol and the whole family dancing 🐎🥁',
    event: 'baraat',
    tags: ['ghori', 'dhol'],
    seconds: 6,
  },
  {
    file: 'sangeet-dance',
    poster: { vendor: 'naach-studio-choreography' },
    caption: 'Six weekends of practice for this one 💃 Booking spring sangeets now.',
    event: 'sangeet',
    tags: [],
    seconds: 6,
  },
  {
    file: 'laavan',
    poster: { vendor: 'frames-by-jas' },
    caption: 'Laavan at the gurdwara this morning. So much love in one room 🙏',
    event: 'anand-karaj',
    tags: ['gurdwara', 'makeup'],
    seconds: 6,
  },
  {
    file: 'tandoor-naan',
    poster: { vendor: 'saffron-tandoor-catering' },
    caption: 'Fresh naan straight from the tandoor, all night long',
    event: 'reception',
    tags: [],
    seconds: 6,
  },
  {
    file: 'jaago-dhol',
    poster: { family: 'Simran Kaur' },
    caption: 'Our jaago went till 2am 🥁 the dhol crew did NOT stop',
    event: 'jaago',
    tags: ['dhol', 'photographer'],
  },
  {
    file: 'bridal-glow',
    poster: { vendor: 'glow-by-simran' },
    caption: 'Ready by 8 for the Anand Karaj ✨ Soft glam, no rush.',
    event: 'anand-karaj',
    tags: ['bridal-boutique'],
    seconds: 6,
  },
  {
    file: 'dum-biryani',
    poster: { vendor: 'deccan-dum-biryani' },
    caption: 'Opening the dum for 600 guests tonight 🔥',
    event: 'walima',
    tags: [],
    seconds: 6,
  },
  {
    file: 'doli-goodbye',
    poster: { family: 'Gurleen Kaur' },
    caption: 'Doli. Not a dry eye anywhere 🥹',
    event: 'doli',
    tags: ['cars-limos', 'florist'],
    seconds: 6,
  },
  {
    file: 'mehndi-hands',
    poster: { vendorCategory: 'mehndi-artist' },
    caption: 'Bridal mehndi for this weekend’s bride. Booking spring dates now.',
    event: 'mehndi',
    tags: [],
  },
  {
    file: 'reception-stage',
    poster: { vendorCategory: 'banquet-hall' },
    caption: 'Our new ivory and gold stage, ready for your reception ✨',
    event: 'reception',
    tags: ['decorator', 'florist'],
  },
  {
    file: 'stage-reveal',
    poster: { vendor: 'marigold-stage-decor' },
    caption: 'Stage ready for Saturday’s reception 🌸',
    event: 'reception',
    tags: ['lighting'],
    seconds: 6,
  },
  {
    file: 'zaffa-entrance',
    poster: { vendor: 'al-farah-zaffa-band' },
    caption: 'Bringing the couple in, zaffa style 🥁',
    event: 'zaffa',
    tags: [],
    seconds: 6,
  },
  {
    file: 'mithai-table',
    poster: { vendorCategory: 'mithai' },
    caption: 'Fresh jalebi and besan ladoo for 400 guests',
    event: 'reception',
    tags: [],
  },
  {
    file: 'jaago-night',
    poster: { family: 'Simran Kaur' },
    caption: 'Jaago night! The neighbours joined in 😂',
    event: 'jaago',
    tags: ['jaago-decor', 'dhol'],
    seconds: 6,
  },
  {
    file: 'dance-floor',
    poster: { family: 'Ayesha Khan' },
    caption: 'The DJ played every song on our list. Best night ever!',
    event: 'reception',
    tags: ['dj', 'lighting'],
  },
  {
    file: 'sparkler-exit',
    poster: { family: 'Harpreet Sandhu' },
    caption: 'Sparkler send-off 🎇 Thank you to everyone who made it happen',
    event: 'reception',
    tags: ['photographer', 'cold-sparklers', 'banquet-hall'],
  },
];

const COMMENTS = [
  'This is beautiful 😍',
  'Who did your decor??',
  'Booking them for our wedding next summer!',
  'Vibes 🔥',
  'Congratulations to you both!',
  'Saving this for my sister’s wedding',
  'The energy!! 🙌',
  'Are you free in May?',
  'Mashallah, so beautiful',
  'Waheguru mehar kare 🙏',
];

async function main() {
  const args = process.argv.slice(2);
  const local = args.includes('--local');
  const folder = args.find((a) => !a.startsWith('--'));
  if (!folder) fail('Usage: npm run reels:samples -- <folder> [--local]');
  for (const clip of CLIPS) {
    for (const ext of ['mp4', 'jpg']) {
      if (!existsSync(join(folder, `${clip.file}.${ext}`))) {
        fail(`Missing ${clip.file}.${ext} in ${folder}`);
      }
    }
  }

  const db = connect(local);

  // People ---------------------------------------------------------------------------------
  const { data: list, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (listError) fail(listError.message);
  async function person(name: string, email: string): Promise<string> {
    let id = list.users.find((u) => u.email === email)?.id;
    if (!id) {
      const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
      if (error || !data.user) fail(`Couldn't create ${email}: ${error?.message}`);
      id = data.user.id;
    }
    const { error } = await db
      .from('profiles')
      .upsert({ id, full_name: name, city: 'Yuba City', phone: '+15305550199', is_sample: true });
    if (error) fail(`Couldn't save ${name}: ${error.message}`);
    return id;
  }
  const families: Record<string, string> = {};
  for (const [i, name] of FAMILIES.entries()) {
    families[name] = await person(name, `sample-reels-family-${i + 1}@example.com`);
  }
  const vendorPoster = await person('Sample Vendor', 'sample-reels-vendor@example.com');

  // The first published sample vendor of each type
  async function vendorFor(category: string): Promise<string | null> {
    const { data, error } = await db
      .from('vendor_categories')
      .select('vendor_id, vendors!inner(status, is_sample)')
      .eq('category_slug', category)
      .eq('vendors.status', 'published')
      .order('position')
      .limit(1);
    if (error) fail(error.message);
    return data[0]?.vendor_id ?? null;
  }

  async function vendorBySlug(slug: string): Promise<string | null> {
    const { data } = await db
      .from('vendors')
      .select('id')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();
    return data?.id ?? null;
  }

  // Start over ------------------------------------------------------------------------------
  const everyone = [...Object.values(families), vendorPoster];
  await db.from('reels').delete().in('author_id', everyone);
  await db.from('follows').delete().in('follower_id', everyone);

  // Reels -------------------------------------------------------------------------------------
  const now = Date.now();
  const reelIds: string[] = [];
  for (const [i, clip] of CLIPS.entries()) {
    const vendorId =
      'vendorCategory' in clip.poster
        ? await vendorFor(clip.poster.vendorCategory)
        : 'vendor' in clip.poster
          ? await vendorBySlug(clip.poster.vendor)
          : null;
    if (!('family' in clip.poster) && !vendorId) {
      console.warn(`No vendor to post ${clip.file}; skipping it`);
      continue;
    }
    const author = 'family' in clip.poster ? families[clip.poster.family] : vendorPoster;
    if (vendorId) {
      await db.from('vendor_members').upsert({ vendor_id: vendorId, user_id: vendorPoster });
    }

    const videoPath = `${author}/${clip.file}.mp4`;
    const thumbPath = `${author}/${clip.file}.jpg`;
    for (const [path, ext, type] of [
      [videoPath, 'mp4', 'video/mp4'],
      [thumbPath, 'jpg', 'image/jpeg'],
    ] as const) {
      const { error } = await db.storage
        .from('reels')
        .upload(path, readFileSync(join(folder, `${clip.file}.${ext}`)), {
          contentType: type,
          upsert: true,
        });
      if (error) fail(`Upload of ${path} failed: ${error.message}`);
    }

    const { data: reel, error } = await db
      .from('reels')
      .insert({
        author_id: author,
        vendor_id: vendorId,
        video_path: videoPath,
        thumb_path: thumbPath,
        duration_s: clip.seconds ?? 5,
        width: 720,
        height: 1280,
        caption: clip.caption,
        event_slug: clip.event,
        // Newest first in the feed is the order of CLIPS
        created_at: new Date(now - i * 47 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();
    if (error) fail(`Couldn't post ${clip.file}: ${error.message}`);
    reelIds.push(reel.id);

    const tags = new Set<string>();
    if (vendorId) {
      await db
        .from('reel_vendor_tags')
        .insert({ reel_id: reel.id, vendor_id: vendorId, status: 'approved' });
    }
    for (const category of clip.tags) {
      const tagged = await vendorFor(category);
      if (!tagged || tagged === vendorId || tags.has(tagged)) continue;
      tags.add(tagged);
      await db.from('reel_vendor_tags').insert({
        reel_id: reel.id,
        vendor_id: tagged,
        // Some approved, some still waiting for the vendor
        status: tags.size % 2 === 1 ? 'approved' : 'pending',
      });
    }
    console.log(`Posted ${clip.file}${vendorId ? ' (as a vendor)' : ''}, ${tags.size} tagged`);
  }

  // Likes, comments and follows -------------------------------------------------------------------
  const people = Object.values(families);
  for (const [i, reelId] of reelIds.entries()) {
    const likers = people.filter((_, j) => (i + j) % 3 !== 0);
    await db.from('reel_likes').insert(likers.map((user_id) => ({ reel_id: reelId, user_id })));
    await db.from('reel_comments').insert(
      likers.slice(0, 2 + (i % 3)).map((user_id, j) => ({
        reel_id: reelId,
        user_id,
        body: COMMENTS[(i + j) % COMMENTS.length],
      })),
    );
  }
  await db.from('follows').insert([
    { follower_id: families['Ayesha Khan'], followee_user_id: families['Simran Kaur'] },
    { follower_id: families['Neha Sharma'], followee_user_id: families['Harpreet Sandhu'] },
  ]);

  console.log(`\n${reelIds.length} sample reels posted.`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
