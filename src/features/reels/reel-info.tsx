import { useRouter } from 'expo-router';
import type { Dispatch, SetStateAction } from 'react';
import { Linking, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Radius, Spacing } from '@/constants/theme';
import type { Reel, ReelVendor } from '@/data/reels';
import { useLocale } from '@/i18n/locale-context';

import { PILL, REEL_DIM, REEL_INK } from './reel-colors';

/** The words at the bottom: who posted it, the credit, the caption, the event and vendors. */
export function ReelInfo({
  reel,
  poster,
  eventName,
  vendors,
  holding,
  bottomSpace,
  lift,
  chromeStyle,
  expanded,
  setExpanded,
  captionLines,
  setCaptionLines,
  openPoster,
}: {
  reel: Reel;
  poster: string;
  eventName: string | null;
  vendors: ReelVendor[];
  holding: boolean;
  bottomSpace: number;
  lift: number;
  chromeStyle: StyleProp<AnimatedStyle<ViewStyle>>;
  expanded: boolean;
  setExpanded: Dispatch<SetStateAction<boolean>>;
  captionLines: number;
  setCaptionLines: (lines: number) => void;
  openPoster: () => void;
}) {
  const router = useRouter();
  const { t } = useLocale();
  return (
    <Animated.View
      pointerEvents={holding ? 'none' : 'box-none'}
      style={[styles.info, { bottom: bottomSpace + Spacing.sm + lift }, chromeStyle]}
    >
      <Pressable accessibilityRole="link" onPress={openPoster} style={styles.posterRow}>
        <AppText weight={600} numberOfLines={1} style={[styles.ink, styles.shrink]}>
          {poster}
        </AppText>
        {reel.vendor && (
          <View style={styles.vendorBadge}>
            <AppText variant="caption" weight={700} style={styles.ink}>
              {t('reels.vendor')}
            </AppText>
          </View>
        )}
        {reel.isSample && (
          <View style={styles.vendorBadge} accessible accessibilityLabel={t('sample.label')}>
            <AppText variant="caption" weight={700} style={styles.ink}>
              {t('sample.tag')}
            </AppText>
          </View>
        )}
      </Pressable>
      {reel.sourceUrl && reel.platform && (
        <Pressable
          accessibilityRole="link"
          accessibilityHint={t('reels.openOriginal')}
          onPress={() => void Linking.openURL(reel.sourceUrl!)}
          hitSlop={{ top: 8, bottom: 8 }}
          style={({ pressed }) => [styles.credit, pressed && styles.pressed]}
        >
          <Icon
            name={reel.platform === 'instagram' ? 'logo-instagram' : 'logo-tiktok'}
            size={14}
            color={REEL_DIM}
          />
          <AppText variant="label" weight={600} numberOfLines={1} style={styles.creditText}>
            {reel.creditName
              ? t('reels.creditBy', { name: reel.creditName, platform: platformName(reel) })
              : t('reels.creditFrom', { platform: platformName(reel) })}
          </AppText>
        </Pressable>
      )}
      {reel.caption && (
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          disabled={captionLines <= 2}
          accessibilityRole={captionLines > 2 ? 'button' : 'text'}
          accessibilityState={captionLines > 2 ? { expanded } : undefined}
        >
          <AppText numberOfLines={expanded ? 12 : 2} style={styles.ink}>
            {reel.caption}
          </AppText>
          {captionLines > 2 && (
            <AppText weight={700} style={[styles.ink, styles.more]}>
              {expanded ? t('reels.less') : t('reels.moreCaption')}
            </AppText>
          )}
          {/* The whole caption, unseen, to know whether it needs "more" */}
          <AppText
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onTextLayout={(e) => setCaptionLines(e.nativeEvent.lines.length)}
            style={[styles.ink, styles.measure]}
          >
            {reel.caption}
          </AppText>
        </Pressable>
      )}
      {(eventName || vendors.length > 0) && (
        <View style={styles.tags}>
          {eventName && (
            <View style={styles.tag}>
              <Icon name="sparkles" size={14} color={REEL_INK} />
              <AppText variant="label" weight={600} style={styles.ink}>
                {eventName}
              </AppText>
            </View>
          )}
          {/* One chip for the vendors, so the caption covers less of the clip:
              one opens their page, several open a list of them */}
          {vendors.length > 0 && (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={
                vendors.length === 1
                  ? t('reels.taggedVendor', { name: vendors[0].name })
                  : t('reels.seeVendors', { count: vendors.length })
              }
              onPress={() =>
                vendors.length === 1
                  ? router.push({ pathname: '/v/[slug]', params: { slug: vendors[0].slug } })
                  : router.push({
                      pathname: '/reel-book',
                      params: { vendors: vendors.map((v) => v.slug).join(','), see: '1' },
                    })
              }
              // The chip is slim over the video; its touch area is 48 tall
              hitSlop={{ top: 6, bottom: 6 }}
              style={({ pressed }) => [styles.tag, styles.vendorTag, pressed && styles.pressed]}
            >
              <Icon name="storefront-outline" size={14} color={REEL_INK} />
              <AppText
                variant="label"
                weight={600}
                numberOfLines={1}
                style={[styles.ink, styles.shrink]}
              >
                {vendors.length === 1
                  ? vendors[0].name
                  : t('reels.vendorCount', { count: vendors.length })}
              </AppText>
              <Icon name="chevron-forward" size={12} color={REEL_DIM} />
            </Pressable>
          )}
        </View>
      )}
    </Animated.View>
  );
}

/** The platform's own name, the same in every language. */
function platformName(reel: Reel): string {
  return reel.platform === 'instagram' ? 'Instagram' : 'TikTok';
}

const styles = StyleSheet.create({
  more: {
    marginTop: 2,
  },
  measure: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0,
  },
  credit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    alignSelf: 'flex-start',
  },
  creditText: {
    color: REEL_DIM,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  ink: {
    color: REEL_INK,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  pressed: {
    opacity: 0.6,
  },
  info: {
    position: 'absolute',
    left: Spacing.lg,
    right: 84,
    gap: Spacing.sm,
  },
  posterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 32,
  },
  vendorBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.chip,
    backgroundColor: PILL,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    maxWidth: '100%',
    minHeight: 36,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.chip,
    backgroundColor: PILL,
  },
  // A long vendor name shortens with "…" instead of pushing the chip off
  vendorTag: {
    flexShrink: 1,
  },
  shrink: {
    flexShrink: 1,
  },
});
