// clear-vault-files: deletes Memory Vault files (#306) that no photo or video
// points to any more, so nothing stays in storage after someone deletes an
// item, a family deletes its wedding or a person deletes their account; and
// uploads that were never saved. The database's pg_cron job calls it every
// hour when there's something to clear (see the memory_vault migration).
// Only the service role may call it.
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

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!isServiceRequest(request, SERVICE_KEY)) {
    return json({ error: 'forbidden' }, 403);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc('orphan_vault_files', { p_limit: 500 });
  if (error) {
    console.error('reading vault files to clear failed', error);
    return json({ error: 'server_error' }, 500);
  }
  const files = ((data ?? []) as { name: string }[]).map((file) => file.name);
  if (files.length === 0) return json({ cleared: 0 }, 200);

  const removed = await admin.storage.from('vault-media').remove(files);
  if (removed.error) {
    console.error('removing vault files failed', removed.error);
    return json({ error: 'server_error' }, 500);
  }
  return json({ cleared: files.length }, 200);
});
