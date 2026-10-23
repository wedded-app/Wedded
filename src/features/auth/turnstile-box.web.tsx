import { useEffect, useRef } from 'react';
import { View, type ViewInstance } from 'react-native';

import { useScheme } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';

import { type Captcha, TURNSTILE_SITE_KEY } from './captcha';

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<TurnstileApi> | null = null;

/** Loads Cloudflare's script once. */
function loadTurnstile(): Promise<TurnstileApi> {
  const existing = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
  if (existing) return Promise.resolve(existing);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => resolve((window as unknown as { turnstile: TurnstileApi }).turnstile);
    script.onerror = () => {
      loading = null;
      reject(new Error('Turnstile did not load'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Cloudflare Turnstile in the browser (#234): the same widget, rendered by
 * Cloudflare's script into this box. It shows only when Cloudflare wants a tap.
 */
export function TurnstileBox({
  captcha,
  siteKey = TURNSTILE_SITE_KEY,
}: {
  captcha: Captcha;
  siteKey?: string | null;
}) {
  const scheme = useScheme();
  const { t } = useLocale();
  const box = useRef<ViewInstance>(null);
  const { onToken, onExpire, round } = captcha;

  useEffect(() => {
    if (!siteKey) return;
    let id: string | null = null;
    let api: TurnstileApi | null = null;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        const element = box.current as unknown as HTMLElement | null;
        if (cancelled || !element) return;
        api = turnstile;
        id = turnstile.render(element, {
          sitekey: siteKey,
          theme: scheme,
          appearance: 'interaction-only',
          callback: onToken,
          'expired-callback': onExpire,
          'error-callback': onExpire,
        });
      })
      .catch(onExpire);
    return () => {
      cancelled = true;
      if (api && id) api.remove(id);
    };
  }, [siteKey, scheme, round, onToken, onExpire]);

  if (!siteKey) return null;
  return <View ref={box} accessibilityLabel={t('signIn.captcha')} />;
}
