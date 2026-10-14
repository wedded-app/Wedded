import * as WebBrowser from 'expo-web-browser';
import type { StyleProp, TextStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { SITE_URL_IS_PLACEHOLDER, siteLink } from '@/constants/links';
import type { Palette } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';

/** The pages on the website the app links to: /terms, /privacy, /refunds. */
export type LegalPage = 'terms' | 'privacy' | 'refunds';

/** Opens one of the website's legal pages in the in-app browser. */
export function openLegalPage(page: LegalPage) {
  void WebBrowser.openBrowserAsync(siteLink(`/${page}`));
}

/**
 * "By tapping Create account or Sign in, you agree to our Terms of Service…",
 * with the two names as links once the website has them (until there's a
 * domain they're plain words rather than links to nowhere). `sentence` is
 * the string's key; it holds {{terms}} and {{privacy}} so each language
 * keeps its own word order.
 */
export function LegalLine({
  sentence,
  color = 'text2',
  style,
}: {
  sentence: string;
  color?: keyof Palette;
  style?: StyleProp<TextStyle>;
}) {
  const { t } = useLocale();
  const text = t(sentence, { terms: '{terms}', privacy: '{privacy}' });
  const links = { '{terms}': 'terms', '{privacy}': 'privacy' } as const;

  return (
    <AppText variant="caption" color={color} style={[{ textAlign: 'center' }, style]}>
      {text.split(/(\{terms\}|\{privacy\})/).map((part, index) => {
        const page = links[part as keyof typeof links];
        if (!page) return part;
        const label = t(page === 'terms' ? 'welcome.termsLink' : 'welcome.privacyLink');
        if (SITE_URL_IS_PLACEHOLDER) {
          return (
            <AppText key={index} variant="caption" weight={700} color={color}>
              {label}
            </AppText>
          );
        }
        return (
          <AppText
            key={index}
            variant="caption"
            weight={700}
            color={color}
            accessibilityRole="link"
            onPress={() => openLegalPage(page)}
            style={{ textDecorationLine: 'underline' }}
          >
            {label}
          </AppText>
        );
      })}
    </AppText>
  );
}
