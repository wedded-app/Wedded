import { useState } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { SITE_URL } from '@/constants/links';
import { useScheme } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';

import { type Captcha, TURNSTILE_SITE_KEY } from './captcha';
import { turnstileHtml } from './turnstile-html';

/** Turnstile's box when it needs a tap; zero high while it passes on its own. */
const BOX_HEIGHT = 72;

/**
 * Cloudflare Turnstile on the phone (#234), in a web view served as the
 * website's address so the widget's allowed hostname matches. Nothing shows
 * without a site key, or while Cloudflare passes the person without a tap.
 * Keep it mounted for the whole sign-in so resends get a fresh token.
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
  const [interactive, setInteractive] = useState(false);
  if (!siteKey) return null;

  function onMessage(event: WebViewMessageEvent) {
    let message: { token?: unknown; expired?: unknown; error?: unknown; interactive?: unknown };
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (typeof message.token === 'string') captcha.onToken(message.token);
    else if (message.expired || message.error) captcha.onExpire();
    if (typeof message.interactive === 'boolean') setInteractive(message.interactive);
  }

  return (
    <View
      style={{ height: interactive ? BOX_HEIGHT : 0, alignSelf: 'stretch', overflow: 'hidden' }}
      accessibilityLabel={interactive ? t('signIn.captcha') : undefined}
    >
      <WebView
        key={captcha.round}
        source={{ html: turnstileHtml(siteKey, scheme), baseUrl: SITE_URL }}
        originWhitelist={['*']}
        onMessage={onMessage}
        scrollEnabled={false}
        style={{ backgroundColor: 'transparent' }}
      />
    </View>
  );
}
