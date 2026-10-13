// push-chat: sends a push alert for each new chat message (the push_alerts
// migration). A trigger on new messages calls it straight away and pg_cron
// every minute as a safety net; only the service role may.
//
// claim_push_messages() hands over each new message once, with the other
// side's phones. Alerts go through Expo's push service; phones Expo says are
// gone (DeviceNotRegistered) are forgotten.
//
//   200 { messages, sent, failed }
//   403 { error: 'forbidden' }

import { createClient } from '@supabase/supabase-js';

import { buildPushes, type PushClaim, type PushMessage } from './push.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SUPABASE_SECRET_KEY') ?? '';
// Only needed if "enhanced push security" is turned on for the Expo project
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN')?.trim() || undefined;

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function roleOf(token: string): string | undefined {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))).role;
  } catch {
    return undefined;
  }
}

type Ticket = { status: 'ok' | 'error'; details?: { error?: string } };

/** Send up to 100 alerts; returns Expo's tickets in the same order. */
async function sendBatch(batch: PushMessage[]): Promise<Ticket[]> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify(batch),
  });
  if (!response.ok) throw new Error(`Expo push ${response.status}: ${await response.text()}`);
  const result = await response.json() as { data?: Ticket[] };
  return result.data ?? [];
}

Deno.serve(async (request) => {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (token !== SERVICE_KEY && roleOf(token) !== 'service_role') {
    return json({ error: 'forbidden' }, 403);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.rpc('claim_push_messages');
  if (error) {
    console.error('claiming messages to push failed', error);
    return json({ error: 'server_error' }, 500);
  }

  const claims = (data ?? []) as PushClaim[];
  const pushes = claims.flatMap(buildPushes);
  let sent = 0;
  let failed = 0;
  const gone: string[] = [];
  for (let i = 0; i < pushes.length; i += 100) {
    const batch = pushes.slice(i, i + 100);
    try {
      const tickets = await sendBatch(batch);
      tickets.forEach((ticket, j) => {
        if (ticket.status === 'ok') {
          sent += 1;
        } else {
          failed += 1;
          if (ticket.details?.error === 'DeviceNotRegistered') gone.push(batch[j].to);
        }
      });
    } catch (e) {
      failed += batch.length;
      console.error('push batch failed', e);
    }
  }

  if (gone.length > 0) {
    const { error: forgetError } = await admin.from('push_tokens').delete().in('token', gone);
    if (forgetError) console.error('forgetting gone phones failed', forgetError);
  }
  return json({ messages: claims.length, sent, failed }, 200);
});
