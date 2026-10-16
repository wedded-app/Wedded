/**
 * Sample stories: a few of the sample reel posters (families and vendors)
 * share photos and clips "today", so the Reels tab's stories ring and the
 * Stories page have something in them. Run reels:samples first; this uses
 * its sample people and the same clip folder. Stories last 24 hours, so run
 * it again on the morning of a demo. Running it again replaces the earlier
 * samples.
 *
 *   npm run stories:samples -- <folder> [--local]
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { connect, fail } from './connect';

type Poster = { family: string } | { vendor: string };

// The same people as reel-samples.ts (sample-reels-family-<n>@example.com)
const FAMILIES = ['Simran Kaur', 'Ayesha Khan', 'Harpreet Sandhu'];
const FAMILY_EMAIL: Record<string, string> = {
  'Simran Kaur': 'sample-reels-family-1@example.com',
  'Ayesha Khan': 'sample-reels-family-2@example.com',
  'Harpreet Sandhu': 'sample-reels-family-3@example.com',
};

// Each story: a clip's still (photo) or the clip itself (video), and when
const STORIES: {
  file: string;
  kind: 'photo' | 'video';
  poster: Poster;
  caption: string | null;
  hoursAgo: number;
  seconds?: number;
}[] = [
  {
    file: 'baraat-ghori',
    kind: 'photo',
    poster: { family: 'Harpreet Sandhu' },
    caption: 'Two days to go! 🐎',
    hoursAgo: 7,
  },
  {
    file: 'sparkler-exit',
    kind: 'video',
    poster: { family: 'Harpreet Sandhu' },
    caption: 'Practice run for the send-off 🎇',
    hoursAgo: 2,
    seconds: 8,
  },
  {
    file: 'sangeet-dance',
    kind: 'video',
    poster: { vendor: 'naach-studio-choreography' },
    caption: 'Rehearsal for Saturday’s sangeet',
    hoursAgo: 1,
    seconds: 6,
  },
  {
    file: 'laavan',
    kind: 'photo',
    poster: { vendor: 'frames-by-jas' },
    caption: 'Two dates left in June 📸',
    hoursAgo: 5,
  },
  {
    file: 'tandoor-naan',
    kind: 'video',
    poster: { vendor: 'saffron-tandoor-catering' },
    caption: 'Tasting day for a June wedding',
    hoursAgo: 3,
    seconds: 6,
  },
  {
    file: 'jaago-dhol',
    kind: 'photo',
    poster: { family: 'Simran Kaur' },
    caption: 'Jaago prep with the cousins',
    hoursAgo: 9,
  },
  {
    file: 'bridal-glow',
    kind: 'photo',
    poster: { vendor: 'glow-by-simran' },
    caption: 'Trial for Saturday’s bride ✨',
    hoursAgo: 6,
  },
  {
    file: 'dance-floor',
    kind: 'photo',
    poster: { family: 'Ayesha Khan' },
    caption: 'Still not over Saturday 💃',
    hoursAgo: 11,
  },
];

async function main() {
  const args = process.argv.slice(2);
  const local = args.includes('--local');
  const folder = args.find((a) => !a.startsWith('--'));
  if (!folder) fail('Usage: npm run stories:samples -- <folder> [--local]');
  for (const story of STORIES) {
    const ext = story.kind === 'video' ? 'mp4' : 'jpg';
    if (!existsSync(join(folder, `${story.file}.${ext}`))) {
      fail(`Missing ${story.file}.${ext} in ${folder}`);
    }
  }

  const db = connect(local);
  const { data: list, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (listError) fail(listError.message);
  const idOf = (email: string) => list.users.find((u) => u.email === email)?.id;
  const families: Record<string, string> = {};
  for (const name of FAMILIES) {
    const id = idOf(FAMILY_EMAIL[name]);
    if (!id) fail(`${name} isn't there yet. Run npm run reels:samples first.`);
    families[name] = id;
  }
  const vendorPoster = idOf('sample-reels-vendor@example.com');
  if (!vendorPoster)
    fail('The sample vendor account isn’t there yet. Run npm run reels:samples first.');

  // Start over: the samples' stories (their files are replaced below)
  const everyone = [...Object.values(families), vendorPoster];
  const { error: clearError } = await db.from('stories').delete().in('author_id', everyone);
  if (clearError) fail(clearError.message);

  const now = Date.now();
  let posted = 0;
  for (const story of STORIES) {
    let vendorId: string | null = null;
    if ('vendor' in story.poster) {
      const { data } = await db
        .from('vendors')
        .select('id')
        .eq('slug', story.poster.vendor)
        .eq('status', 'published')
        .maybeSingle();
      if (!data) {
        console.warn(`No published ${story.poster.vendor}; skipping ${story.file}`);
        continue;
      }
      vendorId = data.id;
      await db.from('vendor_members').upsert({ vendor_id: vendorId, user_id: vendorPoster });
    }
    const author = 'family' in story.poster ? families[story.poster.family] : vendorPoster;

    const upload = async (ext: 'mp4' | 'jpg') => {
      const path = `${author}/story-sample-${story.file}.${ext}`;
      const { error } = await db.storage
        .from('reels')
        .upload(path, readFileSync(join(folder, `${story.file}.${ext}`)), {
          contentType: ext === 'mp4' ? 'video/mp4' : 'image/jpeg',
          upsert: true,
        });
      if (error) fail(`Couldn't upload ${path}: ${error.message}`);
      return path;
    };
    const mediaPath = await upload(story.kind === 'video' ? 'mp4' : 'jpg');
    const thumbPath =
      story.kind === 'video' && existsSync(join(folder, `${story.file}.jpg`))
        ? await upload('jpg')
        : null;

    const { error } = await db.from('stories').insert({
      author_id: author,
      vendor_id: vendorId,
      kind: story.kind,
      media_path: mediaPath,
      thumb_path: thumbPath,
      duration_s: story.kind === 'video' ? (story.seconds ?? 6) : null,
      caption: story.caption,
      created_at: new Date(now - story.hoursAgo * 60 * 60 * 1000).toISOString(),
    });
    if (error) fail(`Couldn't post ${story.file}: ${error.message}`);
    posted += 1;
    console.log(`Shared ${story.file} (${story.kind})`);
  }
  console.log(`\n${posted} sample stories shared. They last 24 hours.`);
}

void main();
