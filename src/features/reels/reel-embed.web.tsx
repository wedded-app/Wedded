import { createElement, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Spacing } from '@/constants/theme';
import type { Reel } from '@/data/reels';
import { useLocale } from '@/i18n/locale-context';

import { embedUrl } from './reel-link';

const INK = '#FFFFFF';
const DIM = 'rgba(255,255,255,0.78)';

/**
 * The web build's pasted reel: the platform's player in an iframe, loaded
 * only for the reel on screen (react-native-webview doesn't run on the web).
 */
export function ReelEmbed({ reel, active }: { reel: Reel; active: boolean }) {
  const { t } = useLocale();
  const [loaded, setLoaded] = useState(false);
  const url = reel.platform && reel.sourceUrl ? embedUrl(reel.platform, reel.sourceUrl) : null;
  // Scrolled away: show the cover again until it reloads next time
  if (!active && loaded) setLoaded(false);

  return (
    <View style={StyleSheet.absoluteFill}>
      {active &&
        url &&
        createElement('iframe', {
          src: url,
          title: t('reels.playsFrom', {
            platform: reel.platform === 'instagram' ? 'Instagram' : 'TikTok',
          }),
          allow: 'autoplay; encrypted-media; picture-in-picture',
          onLoad: () => setLoaded(true),
          style: { border: 0, width: '100%', height: '100%', backgroundColor: '#000000' },
        })}
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
