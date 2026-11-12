// Revoking Sign in with Apple when an account is deleted (App Store rule
// 5.1.1(v); Apple's "Revoke tokens" REST API). The app signs the person in
// with Apple again just before deleting, and sends the one-time authorization
// code from that sign-in. We trade it for a refresh token and revoke that,
// which removes Wedded from the person's Apple ID.
//
// Needs four function settings, from an Apple Developer key with Sign in with
// Apple (docs/HOSTED_SETUP.md, "Apple"): APPLE_TEAM_ID, APPLE_KEY_ID,
// APPLE_PRIVATE_KEY (the .p8 file's text) and APPLE_CLIENT_ID (the app's
// bundle id). Without them nothing is revoked: a sign-in made in Expo Go
// belongs to Expo's app id, which only Expo's key could revoke.

const APPLE = 'https://appleid.apple.com';

export type AppleKey = { teamId: string; keyId: string; privateKey: string; clientId: string };

/** 'revoked', 'expired' (the code was used or is over 5 minutes old: sign in again) or 'failed'. */
export type RevokeResult = 'revoked' | 'expired' | 'failed';

/** The four settings, or null when any is missing. */
export function appleKeyFromEnv(get: (name: string) => string | undefined): AppleKey | null {
  const teamId = get('APPLE_TEAM_ID');
  const keyId = get('APPLE_KEY_ID');
  const privateKey = get('APPLE_PRIVATE_KEY');
  const clientId = get('APPLE_CLIENT_ID');
  return teamId && keyId && privateKey && clientId ? { teamId, keyId, privateKey, clientId } : null;
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(
    /=+$/,
    '',
  );
}

const text = (value: unknown) => base64Url(new TextEncoder().encode(JSON.stringify(value)));

/** The client secret Apple asks for: a five-minute ES256 token signed with our key. */
export async function clientSecret(key: AppleKey, nowSeconds: number): Promise<string> {
  // The .p8 text, with real or escaped line breaks (a setting often flattens them)
  const pem = key.privateKey.replace(/\\n/g, '\n').replace(/-----[A-Z ]+-----/g, '').replace(
    /\s+/g,
    '',
  );
  const signingKey = await crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const unsigned = `${text({ alg: 'ES256', kid: key.keyId })}.${
    text({
      iss: key.teamId,
      iat: nowSeconds,
      exp: nowSeconds + 300,
      aud: APPLE,
      sub: key.clientId,
    })
  }`;
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    signingKey,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

/** Trade the sign-in's authorization code for a refresh token, then revoke it. */
export async function revokeAppleSignIn(
  key: AppleKey,
  code: string,
  nowSeconds: number,
  fetcher: typeof fetch = fetch,
): Promise<RevokeResult> {
  try {
    const secret = await clientSecret(key, nowSeconds);
    const post = (path: string, fields: Record<string, string>) =>
      fetcher(`${APPLE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: key.clientId, client_secret: secret, ...fields }),
      });

    const traded = await post('/auth/token', { grant_type: 'authorization_code', code });
    const tokens = await traded.json().catch(() => ({}));
    if (!traded.ok || typeof tokens.refresh_token !== 'string') {
      if (tokens.error === 'invalid_grant') return 'expired';
      console.error('apple token exchange failed', traded.status, tokens.error);
      return 'failed';
    }
    const revoked = await post('/auth/revoke', {
      token: tokens.refresh_token,
      token_type_hint: 'refresh_token',
    });
    if (!revoked.ok) console.error('apple revoke failed', revoked.status);
    return revoked.ok ? 'revoked' : 'failed';
  } catch (error) {
    console.error('apple revoke failed', error);
    return 'failed';
  }
}
