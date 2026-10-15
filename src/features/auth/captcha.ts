import { useCallback, useRef, useState } from 'react';

/**
 * The public Cloudflare Turnstile site key (#234). Unset, there's no
 * challenge and codes send as before; set it only once Supabase's CAPTCHA is
 * on with the matching secret (docs/HOSTED_SETUP.md, OTP abuse protection).
 */
export const TURNSTILE_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;

export type Captcha = {
  /** Whether a code can be asked for now: always without a site key. */
  ready: boolean;
  /** Bumped after each use, so the widget starts a fresh challenge. */
  round: number;
  onToken: (token: string) => void;
  onExpire: () => void;
  /**
   * The options for one signInWithOtp call: the token, used once. The widget
   * then starts again, so a resend gets its own.
   */
  take: () => { captchaToken?: string };
};

/** One Turnstile token per code request; tokens are single-use. */
export function useCaptcha(siteKey: string | null = TURNSTILE_SITE_KEY): Captcha {
  const token = useRef<string | null>(null);
  const [ready, setReady] = useState(!siteKey);
  const [round, setRound] = useState(0);

  const onToken = useCallback((value: string) => {
    token.current = value;
    setReady(true);
  }, []);
  const onExpire = useCallback(() => {
    token.current = null;
    setReady(false);
  }, []);
  const take = useCallback(() => {
    if (!siteKey) return {};
    const captchaToken = token.current ?? undefined;
    token.current = null;
    setReady(false);
    setRound((n) => n + 1);
    return captchaToken ? { captchaToken } : {};
  }, [siteKey]);

  return { ready: !siteKey || ready, round, onToken, onExpire, take };
}
