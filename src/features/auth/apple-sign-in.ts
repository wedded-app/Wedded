/**
 * Sign in with Apple is iPhone-only in this app (apple-sign-in.ios.ts). This
 * stub is what Android and the web load, so the web build never imports the
 * native module. Apple on the web and Android would need a Services ID and
 * the browser flow (docs/HOSTED_SETUP.md, "Sign-in methods").
 */
import type { ProviderResult } from './providers';

export async function appleSignInAvailable(): Promise<boolean> {
  return false;
}

export async function appleSignIn(): Promise<ProviderResult> {
  return 'unavailable';
}

export function takeAppleAuthorizationCode(): string | null {
  return null;
}
