import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Spacing } from '@/constants/theme';
import type { Reel } from '@/data/reels';
import { useLocale } from '@/i18n/locale-context';

import { embedUrl } from './reel-link';

const INK = '#FFFFFF';
const DIM = 'rgba(255,255,255,0.78)';

/**
 * A pasted TikTok or Instagram reel, playing in the platform's own player
 * (B5). Only the reel on screen loads it, so scrolling stays smooth and only
 * one plays at a time; the others show the platform's mark. Tapping through
 * to the platform (its logo, "Watch on TikTok") opens the post in the
 * TikTok or Instagram app instead of inside ours.
 */
export function ReelEmbed({ reel, active }: { reel: Reel; active: boolean }) {
  const { t } = useLocale();
  const [loaded, setLoaded] = useState(false);
  const url = reel.platform && reel.sourceUrl ? embedUrl(reel.platform, reel.sourceUrl) : null;
  // Scrolled away: show the cover again until it reloads next time
  if (!active && loaded) setLoaded(false);

  // The player stays inside; anything else it opens goes to the platform's app
  const stayInside = (request: ShouldStartLoadRequest) => {
    if (!url || request.url === url || request.url === 'about:blank') return true;
    const sameEmbed = /tiktok\.com\/player\/|instagram\.com\/(?:reel|p)\/[^/]+\/embed/.test(
      request.url,
    );
    if (sameEmbed || !request.isTopFrame) return true;
    void Linking.openURL(request.url);
    return false;
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      {active && url && (
        <WebView
          source={{ uri: url }}
          style={styles.web}
          containerStyle={styles.web}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo={false}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={stayInside}
          onLoadEnd={() => setLoaded(true)}
        />
      )}
      {(!active || !loaded || !url) && (
        <View style={styles.placeholder} pointerEvents="none">
          <Icon
            name={reel.platform === 'instagram' ? 'logo-instagram' : 'logo-tiktok'}
            size={56}
            color={DIM}
          />
          <AppText weight={600} style={styles.ink}>
            {url
              ? t('reels.playsFrom', {
                  platform: reel.platform === 'instagram' ? 'Instagram' : 'TikTok',
                })
              : t('reels.linkGone')}
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  web: {
    flex: 1,
    backgroundColor: '#000000',
  },
  placeholder: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: '#000000',
  },
  ink: {
    color: INK,
  },
});
