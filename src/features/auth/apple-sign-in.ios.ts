/**
 * Sign in with Apple, iPhone only (works in Expo Go). Android and the web get
 * apple-sign-in.ts instead, so the web build never loads the native module.
 *
 * Apple signs a SHA-256 hash of a one-time nonce into its token; Supabase gets
 * the raw nonce, hashes it and compares, so a stolen token can't be replayed.
 * In Expo Go the token is issued to Expo Go's bundle id, host.exp.Exponent,
 * which is why supabase/config.toml lists that as Apple's client id.
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { supabase } from '@/lib/supabase';

import { appleFullName } from './auth-helpers';
import { setNameHint } from './name-hint';
import type { ProviderResult } from './providers';

// The last sign-in's one-time authorization code. Deleting the account sends
// it to the server, which uses it to revoke Wedded's access to the Apple ID.
let authorizationCode: string | null = null;

/** The latest Apple sign-in's authorization code, once (Apple takes each code only once). */
export function takeAppleAuthorizationCode(): string | null {
  const code = authorizationCode;
  authorizationCode = null;
  return code;
}

/** True when this iPhone can show Apple's sign-in sheet. */
export function appleSignInAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

export async function appleSignIn(): Promise<ProviderResult> {
  if (!(await appleSignInAvailable())) return 'unavailable';

  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
    { encoding: Crypto.CryptoEncoding.HEX },
  );

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') return 'cancelled';
    if (__DEV__) console.warn('Sign in with Apple failed', error);
    return 'failed';
  }
  if (!credential.identityToken) return 'failed';
  authorizationCode = credential.authorizationCode;

  // Apple shares the name only the first time; keep it for About you. Set
  // before Supabase answers, so About you has it when it opens.
  const name = appleFullName(credential.fullName);
  if (name) setNameHint({ appleUser: credential.user, name });

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) {
    if (__DEV__) console.warn('Supabase refused the Apple token', error);
    return error.code === 'provider_disabled' ? 'unavailable' : 'failed';
  }
  return 'signedIn';
}
