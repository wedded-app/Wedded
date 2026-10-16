// clear-stories: a story leaves the feeds after 24 hours; this deletes it
// for good, with its photo or clip, so nothing a person shared for a day
// stays in storage. The database's pg_cron job calls it every hour when
// there's something to clear (see the clear_stories migration). A story with
// an open report stays until the founders have looked at it. Only the service
// role may call it.
//
//   200 { cleared }
//   403 { error: 'forbidden' }

import { createClient } from '@supabase/supabase-js';
import { isServiceRequest } from '../_shared/request-security.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SUPABASE_SECRET_KEY') ?? '';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Expired = { id: string; media_path: string; thumb_path: string | null };

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!isServiceRequest(request, SERVICE_KEY)) {
    return json({ error: 'forbidden' }, 403);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc('expired_stories', { p_limit: 500 });
  if (error) {
    console.error('reading expired stories failed', error);
    return json({ error: 'server_error' }, 500);
  }
  const expired = (data ?? []) as Expired[];
  if (expired.length === 0) return json({ cleared: 0 }, 200);

  // Files first: if deleting the rows fails, the next run finds them again
  const files = expired.flatMap((s) => [s.media_path, ...(s.thumb_path ? [s.thumb_path] : [])]);
  const removed = await admin.storage.from('reels').remove(files);
  if (removed.error) {
    console.error('removing story files failed', removed.error);
    return json({ error: 'server_error' }, 500);
  }
  const { error: deleteError } = await admin
    .from('stories')
    .delete()
    .in('id', expired.map((s) => s.id));
  if (deleteError) {
    console.error('deleting expired stories failed', deleteError);
    return json({ error: 'server_error' }, 500);
  }
  return json({ cleared: expired.length }, 200);
});
