// delete-account: in-app account deletion (vision S19, §8; required by Apple
// guideline 5.1.1(v) and Google Play).
//
// POST with the signed-in person's session. They must have shown it's them in
// the last 10 minutes, the way they signed up: a fresh email or text code
// (amr `otp`), or signing in again with Apple or Google (amr `oauth`). The
// app asks for that on its second screen, so a borrowed or forgotten-open
// phone can't delete the account in one tap. Deleting the auth user cascades
// in the database: profile and saved vendors are deleted, and inquiries keep
// the vendor's history with the sender's name, phone and email scrubbed.
//
// Someone who signed in with Apple sends `appleCode`, the authorization code
// from signing in again; it's used to revoke Wedded's access to their Apple
// ID first (apple-revoke.ts). If Apple can't be reached the account is still
// deleted: a person must always be able to delete it.
//
//   200 { deleted: true }
//   401 { error: 'unauthorized' }
//   403 { error: 'reauth_required' }   verify a fresh code, or sign in again, first
//                                      (also when the Apple code is used or too old)
//   500 { error: 'server_error' }

import { createClient } from '@supabase/supabase-js';

import { appleKeyFromEnv, revokeAppleSignIn } from './apple-revoke.ts';
import { type AuthMethod, signedInRecently } from './fresh-sign-in.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SUPABASE_SECRET_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** The token's claims. Only read after getUser() has verified the token. */
function claimsOf(token: string): { amr?: AuthMethod[] } {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
  } catch {
    return {};
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json({ error: 'unauthorized' }, 401);

  const now = Math.floor(Date.now() / 1000);
  if (!signedInRecently(claimsOf(token).amr, now)) {
    return json({ error: 'reauth_required' }, 403);
  }

  if (data.user.identities?.some((identity) => identity.provider === 'apple')) {
    const appleKey = appleKeyFromEnv((name) => Deno.env.get(name));
    const body = await request.json().catch(() => null);
    const appleCode = typeof body?.appleCode === 'string' ? body.appleCode : '';
    if (appleKey && appleCode) {
      const result = await revokeAppleSignIn(appleKey, appleCode, now);
      if (result === 'expired') return json({ error: 'reauth_required' }, 403);
    } else {
      // No key yet (Expo Go), or deleted from a device without Apple's sheet
      console.warn('apple sign-in not revoked', data.user.id, appleKey ? 'no code' : 'no key');
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
  if (deleteError) {
    console.error('deleting account failed', data.user.id, deleteError);
    return json({ error: 'server_error' }, 500);
  }
  return json({ deleted: true }, 200);
});
