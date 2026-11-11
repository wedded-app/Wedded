import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';
import { useReelsFeed } from '@/data/reels';
import { useLocale } from '@/i18n/locale-context';

/**
 * "Their reels" on a vendor's page (Fezy, 2026-11-11): the clips this
 * vendor posted, tall cards in a row with a play mark and the caption, each
 * opening the reels viewer at that clip, and See all. Nothing until they
 * have one.
 */
export function VendorReels({ vendorId }: { vendorId: string }) {
  const Colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useLocale();
  const feed = useReelsFeed({ mode: 'vendor', vendorId });
  const reels = (feed.data?.pages.flat() ?? []).filter((reel) => reel.thumbUrl);
  if (reels.length === 0) return null;
  const open = (index: number) =>
    router.push({ pathname: '/reels-viewer', params: { vendor: vendorId, index: String(index) } });

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <AppText variant="section" accessibilityRole="header" style={styles.grow}>
          {t('vendor.reels.title')}
        </AppText>
        <Pressable
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => open(0)}
          style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
        >
          <AppText variant="caption" weight={700} color="primary" style={styles.caps}>
            {t('vendor.reels.seeAll').toUpperCase()}
          </AppText>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.row}
      >
        {reels.slice(0, 10).map((reel, index) => (
          <PressableScale
            key={reel.id}
            accessibilityRole="button"
            accessibilityLabel={t('vendor.reels.watch', { caption: reel.caption ?? '' })}
            onPress={() => open(index)}
            style={styles.card}
          >
            <Image
              source={{ uri: reel.thumbUrl ?? undefined }}
              contentFit="cover"
              transition={200}
              accessible={false}
              style={StyleSheet.absoluteFill}
            />
            <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 10 10">
              <Defs>
                <LinearGradient id={`reel-${reel.id}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0.45" stopColor={Colors.viewer} stopOpacity={0} />
                  <Stop offset="1" stopColor={Colors.viewer} stopOpacity={0.65} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="10" height="10" fill={`url(#reel-${reel.id})`} />
            </Svg>
            <Icon name="play" size={16} color={Colors.onPhoto} style={styles.play} />
            {reel.caption ? (
              <AppText variant="caption" weight={600} numberOfLines={3} style={styles.caption}>
                {reel.caption}
              </AppText>
            ) : null}
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  grow: {
    flex: 1,
  },
  seeAll: {
    minHeight: Sizes.tapTarget - 8,
    justifyContent: 'center',
  },
  caps: {
    letterSpacing: 0.6,
  },
  pressed: {
    opacity: 0.6,
  },
  bleed: {
    marginHorizontal: -Sizes.pageGutter,
  },
  row: {
    gap: Spacing.sm + 2,
    paddingHorizontal: Sizes.pageGutter,
  },
  card: {
    width: 118,
    height: 210,
    overflow: 'hidden',
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: Colors.skeleton,
  },
  play: {
    position: 'absolute',
    top: Spacing.sm + 2,
    left: Spacing.sm + 2,
  },
  caption: {
    position: 'absolute',
    left: Spacing.sm + 2,
    right: Spacing.sm + 2,
    bottom: Spacing.sm + 2,
    color: Colors.onPhoto,
  },
}));
