// In the function's folder: deno test --allow-env (CI runs it).
import { type AppleKey, appleKeyFromEnv, clientSecret, revokeAppleSignIn } from './apple-revoke.ts';

function expect(actual: unknown, expected: unknown, what: string) {
  if (actual !== expected) throw new Error(`${what}: expected ${expected}, got ${actual}`);
}

/** A throwaway key like Apple's .p8, with its public half to check signatures. */
async function testKey(): Promise<{ key: AppleKey; publicKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const body = btoa(String.fromCharCode(...der));
  return {
    // Line breaks escaped, as a one-line setting would hold it
    key: {
      teamId: 'TEAM123456',
      keyId: 'KEY1234567',
      clientId: 'com.example.app',
      privateKey: `-----BEGIN PRIVATE KEY-----\\n${body}\\n-----END PRIVATE KEY-----`,
    },
    publicKey: pair.publicKey,
  };
}

const decode = (part: string) =>
  Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

Deno.test('all four settings are needed', () => {
  const env: Record<string, string> = {
    APPLE_TEAM_ID: 't',
    APPLE_KEY_ID: 'k',
    APPLE_PRIVATE_KEY: 'p',
  };
  expect(appleKeyFromEnv((name) => env[name]), null, 'three of four');
  env.APPLE_CLIENT_ID = 'c';
  expect(appleKeyFromEnv((name) => env[name])?.clientId, 'c', 'all four');
});

Deno.test('the client secret is an ES256 token Apple can verify', async () => {
  const { key, publicKey } = await testKey();
  const [header, payload, signature] = (await clientSecret(key, 1_800_000_000)).split('.');
  const claims = JSON.parse(new TextDecoder().decode(decode(payload)));
  expect(JSON.parse(new TextDecoder().decode(decode(header))).kid, 'KEY1234567', 'kid');
  expect(claims.iss, 'TEAM123456', 'iss');
  expect(claims.sub, 'com.example.app', 'sub');
  expect(claims.aud, 'https://appleid.apple.com', 'aud');
  expect(claims.exp - claims.iat, 300, 'five minutes');
  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    decode(signature),
    new TextEncoder().encode(`${header}.${payload}`),
  );
  expect(valid, true, 'signature');
});

Deno.test('the code is traded for a refresh token, which is revoked', async () => {
  const { key } = await testKey();
  const calls: string[] = [];
  const fetcher = ((url: string, init: RequestInit) => {
    const body = init.body as URLSearchParams;
    calls.push(`${new URL(url).pathname} ${body.get('code') ?? body.get('token')}`);
    return Promise.resolve(
      url.endsWith('/auth/token')
        ? Response.json({ refresh_token: 'r1' })
        : new Response(null, { status: 200 }),
    );
  }) as typeof fetch;
  expect(await revokeAppleSignIn(key, 'c1', 1_800_000_000, fetcher), 'revoked', 'result');
  expect(calls.join(', '), '/auth/token c1, /auth/revoke r1', 'calls');
});

Deno.test('a used or old code says to sign in again; anything else is a failure', async () => {
  const { key } = await testKey();
  const answering = (status: number, body: unknown) =>
    (() => Promise.resolve(Response.json(body, { status }))) as unknown as typeof fetch;
  expect(
    await revokeAppleSignIn(key, 'c', 1_800_000_000, answering(400, { error: 'invalid_grant' })),
    'expired',
    'invalid_grant',
  );
  expect(
    await revokeAppleSignIn(key, 'c', 1_800_000_000, answering(400, { error: 'invalid_client' })),
    'failed',
    'invalid_client',
  );
  expect(
    await revokeAppleSignIn(key, 'c', 1_800_000_000, () => Promise.reject(new Error('offline'))),
    'failed',
    'offline',
  );
});
