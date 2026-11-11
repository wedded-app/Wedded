import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { SampleTag } from '@/components/sample-tag';
import { backgroundCss, makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';
import { useReelsFeed } from '@/data/reels';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

import { SectionHeader } from './section-header';

const SHOWN = 8;
const shade = backgroundCss('linear-gradient(to bottom, rgba(0,0,0,0) 45%, rgba(0,0,0,0.72) 100%)');

/**
 * Wedding reels on Home: a row of tall stills from the newest reels, each
 * with who posted it over a soft shade and a play mark, a few at a time.
 * A tap, or See all, opens Reels. Only reels with a picture; hidden when
 * there are none.
 */
export function ReelsRow() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const feed = useReelsFeed({ mode: 'for_you' });
  const reels = (feed.data?.pages[0] ?? []).filter((reel) => !!reel.thumbUrl).slice(0, SHOWN);

  if (reels.length === 0) return null;

  const open = () => {
    selectionHaptic();
    router.navigate('/discover');
  };

  return (
    <View style={styles.block}>
      <SectionHeader title={t('home.reels.title')} link={t('home.seeAll')} onLink={open} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.track}
      >
        {reels.map((reel) => {
          const who = reel.vendor?.name ?? reel.authorName;
          return (
            <PressableScale
              key={reel.id}
              accessibilityRole="button"
              accessibilityLabel={
                who ? t('home.reels.label', { who }) : (reel.caption ?? t('home.reels.title'))
              }
              pressedScale={0.97}
              onPress={open}
              style={styles.tile}
            >
              <Image
                source={{ uri: reel.thumbUrl! }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
                accessible={false}
              />
              <View style={[StyleSheet.absoluteFill, shade]} />
              <View style={styles.play}>
                <Icon name="play" size={14} color={Colors.onPhoto} />
              </View>
              <View style={styles.foot}>
                <SampleTag show={reel.isSample} onPhoto />
                {who && (
                  <AppText
                    variant="label"
                    weight={600}
                    color="onPhoto"
                    numberOfLines={2}
                    maxFontSizeMultiplier={1.3}
                  >
                    {who}
                  </AppText>
                )}
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.md,
  },
  bleed: {
    marginHorizontal: -Sizes.pageGutter,
  },
  track: {
    gap: Spacing.sm + 2,
    paddingHorizontal: Sizes.pageGutter,
  },
  tile: {
    width: 128,
    height: 228,
    borderRadius: 18,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  play: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.photoScrim,
  },
  foot: {
    position: 'absolute',
    left: Spacing.sm + 2,
    right: Spacing.sm + 2,
    bottom: Spacing.sm + 2,
    gap: Spacing.xs,
    alignItems: 'flex-start',
  },
}));
