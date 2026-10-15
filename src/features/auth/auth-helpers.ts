/**
 * Pure helpers for signing in (no Supabase or native modules here, so they can
 * be unit tested): reading tokens out of a sign-in redirect, which methods the
 * server has turned on, errors in plain words, names and phone numbers from
 * the account, and how someone proves it's them before deleting their account.
 */
import { normalizePhone } from './about-you-validation';

// ---------------------------------------------------------------------------
// The address Google sign-in comes back to

export type AuthParams = {
  /** Implicit flow: the new session, in the #fragment. */
  accessToken: string | null;
  refreshToken: string | null;
  /** PKCE flow: a one-time code in the ?query, to swap for a session. */
  code: string | null;
  /** Set when the provider or Supabase said no, e.g. `access_denied` when they cancelled. */
  error: string | null;
  errorCode: string | null;
  errorDescription: string | null;
};

function decode(text: string): string {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '));
  } catch {
    return text;
  }
}

function readPairs(part: string, into: Record<string, string>) {
  for (const pair of part.split('&')) {
    if (!pair) continue;
    const equals = pair.indexOf('=');
    const key = decode(equals === -1 ? pair : pair.slice(0, equals));
    into[key] = equals === -1 ? '' : decode(pair.slice(equals + 1));
  }
}

/**
 * The sign-in parameters in a redirect such as
 * `exp://192.168.1.5:8081/--/auth-callback#access_token=…&refresh_token=…`
 * or `weddingapp://auth-callback?code=…`. Reads both the query and the
 * fragment (the fragment wins), without relying on React Native's partial URL
 * class. Anything missing is null.
 */
export function authParamsFromUrl(url: string): AuthParams {
  const hashAt = url.indexOf('#');
  const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
  const queryAt = beforeHash.indexOf('?');
  const params: Record<string, string> = {};
  if (queryAt !== -1) readPairs(beforeHash.slice(queryAt + 1), params);
  if (hashAt !== -1) readPairs(url.slice(hashAt + 1), params);

  const pick = (key: string) => params[key] || null;
  return {
    accessToken: pick('access_token'),
    refreshToken: pick('refresh_token'),
    code: pick('code'),
    error: pick('error'),
    errorCode: pick('error_code'),
    errorDescription: pick('error_description'),
  };
}

// ---------------------------------------------------------------------------
// Which sign-in methods are on

export type EnabledProviders = { apple: boolean; google: boolean; phone: boolean; email: boolean };

/** GET /auth/v1/settings → which methods the server accepts. Anything unreadable counts as off. */
export function enabledProviders(settings: unknown): EnabledProviders {
  const external =
    settings && typeof settings === 'object' && 'external' in settings
      ? (settings as { external: unknown }).external
      : null;
  const on = (name: string) =>
    !!external &&
    typeof external === 'object' &&
    (external as Record<string, unknown>)[name] === true;
  return { apple: on('apple'), google: on('google'), phone: on('phone'), email: on('email') };
}

// ---------------------------------------------------------------------------
// Errors in plain words

/** The parts of a Supabase AuthError we look at. */
export type AuthErrorLike = { code?: string; status?: number; name?: string };

/** i18n key for a Supabase Auth error while sending or checking an email or text code. */
export function authErrorKey(error: AuthErrorLike, kind: 'email' | 'phone' = 'email'): string {
  if (error.name === 'AuthRetryableFetchError') return 'signIn.errors.network';
  switch (error.code) {
    case 'over_email_send_rate_limit':
    case 'over_sms_send_rate_limit':
    case 'over_request_rate_limit':
      return 'signIn.errors.tooMany';
    // Supabase uses otp_expired for both expired and mistyped codes.
    case 'otp_expired':
      return kind === 'phone' ? 'signIn.errors.codeWrongPhone' : 'signIn.errors.codeWrong';
    case 'sms_send_failed':
      return 'signIn.errors.smsFailed';
    case 'phone_provider_disabled':
      return 'signIn.errors.phoneOff';
    case 'email_provider_disabled':
      return 'signIn.errors.emailOff';
    // Turnstile's token was missing, used or expired (#234)
    case 'captcha_failed':
      return 'signIn.errors.captcha';
    case 'validation_failed':
      return kind === 'phone' ? 'aboutYou.errors.phoneInvalid' : 'signIn.errors.emailInvalid';
  }
  if (error.status === 429) return 'signIn.errors.tooMany';
  return 'signIn.errors.generic';
}

// ---------------------------------------------------------------------------
// What the account already tells us

/** Google puts the person's name in `full_name` and `name`; anything else has none. */
export function nameFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const { full_name: fullName, name } = metadata as Record<string, unknown>;
  for (const value of [fullName, name]) {
    if (typeof value === 'string' && value.trim()) return value.trim().replace(/\s+/g, ' ');
  }
  return null;
}

type AppleName = {
  givenName?: string | null;
  middleName?: string | null;
  familyName?: string | null;
  nickname?: string | null;
};

/** "Harjit Kaur" from the name Apple shares (only on the first sign-in), or null. */
export function appleFullName(name: AppleName | null | undefined): string | null {
  if (!name) return null;
  const parts = [name.givenName, name.middleName, name.familyName]
    .map((part) => part?.trim())
    .filter(Boolean);
  const full = parts.join(' ') || name.nickname?.trim() || '';
  return full || null;
}

/** The account's phone in E.164. Supabase stores it without the "+" ("15305550100"). */
export function phoneFromAuth(phone: string | null | undefined): string | null {
  const digits = phone?.trim();
  if (!digits) return null;
  return normalizePhone(digits.startsWith('+') ? digits : `+${digits}`);
}

// ---------------------------------------------------------------------------
// Proving it's them before deleting the account

export type ReauthMethod = 'email' | 'phone' | 'apple' | 'google';

type AccountLike = {
  email?: string | null;
  phone?: string | null;
  app_metadata?: { provider?: string; providers?: string[] };
};

/**
 * How someone confirms it's really them before deleting their account: the
 * way they signed up (a fresh email or text code, or Apple or Google again).
 * Apple only works on an iPhone, so an Apple account elsewhere gets an email
 * code (to Apple's relay address if they hid their email). Null when there is
 * no way at all on this device.
 */
export function reauthMethod(account: AccountLike, platform: string): ReauthMethod | null {
  const meta = account.app_metadata ?? {};
  const providers = meta.providers ?? (meta.provider ? [meta.provider] : []);
  const email = account.email?.trim();
  const phone = account.phone?.trim();

  if (email && providers.includes('email')) return 'email';
  if (phone && providers.includes('phone')) return 'phone';
  if (providers.includes('apple') && platform === 'ios') return 'apple';
  if (providers.includes('google')) return 'google';
  if (phone) return 'phone';
  if (email) return 'email';
  return null;
}
