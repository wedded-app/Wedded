/**
 * Copy every file in Storage (vendor photos, reels, chat photos and voice
 * notes) from the hosted Supabase demo to the AWS backend, after
 * `npm run backend -- copy-from-supabase` (infra/README.md). Files already
 * there are skipped, so it's safe to run again.
 *
 *   eval "$(npm run -s backend -- env)"
 *   FROM_URL=https://<ref>.supabase.co FROM_SECRET_KEY=<its service role key> npm run storage:copy
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { connect, fail } from './connect';

const PAGE = 1000;

/** Every file in a bucket, walking into folders (folders have no id). */
async function paths(client: SupabaseClient, bucket: string, prefix = ''): Promise<string[]> {
  const found: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: PAGE, offset });
    if (error) fail(`Could not list ${bucket}/${prefix}: ${error.message}`);
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) found.push(...(await paths(client, bucket, path)));
      else found.push(path);
    }
    if (data.length < PAGE) return found;
  }
}

async function main() {
  const fromUrl = process.env.FROM_URL;
  const fromKey = process.env.FROM_SECRET_KEY;
  if (!fromUrl || !fromKey) {
    fail("Set FROM_URL and FROM_SECRET_KEY: the hosted demo's address and service role key.");
  }
  const from = createClient(fromUrl, fromKey, { auth: { persistSession: false } });
  const to = connect(false);

  const { data: buckets, error } = await from.storage.listBuckets();
  if (error) fail(`Could not list the buckets: ${error.message}`);
  let copied = 0;
  let skipped = 0;
  let failed = 0;
  for (const { id: bucket } of buckets) {
    const there = new Set(await paths(to, bucket));
    for (const path of await paths(from, bucket)) {
      if (there.has(path)) {
        skipped += 1;
        continue;
      }
      const { data: file, error: downloadError } = await from.storage.from(bucket).download(path);
      const { error: uploadError } = file
        ? await to.storage.from(bucket).upload(path, file, { contentType: file.type })
        : { error: downloadError };
      if (uploadError) {
        console.warn(`  ${bucket}/${path}: ${uploadError.message}`);
        failed += 1;
      } else copied += 1;
    }
  }
  console.log(
    `Copied ${copied} files, ${skipped} were already there` +
      (failed ? `, ${failed} failed (see above)` : '') +
      '.',
  );
  if (failed) process.exit(1);
}

void main();
