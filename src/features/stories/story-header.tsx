import { Image } from 'expo-image';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, Sizes, Spacing } from '@/constants/theme';
import { initials } from '@/features/planner/plan-together';
import { useLocale } from '@/i18n/locale-context';

import type { Teller } from './story-tellers';

const topShade = (
  Platform.OS === 'web'
    ? { backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0))' }
    : { experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0))' }
) as ViewStyle;

/**
 * The story viewer's top: a progress bar per slide, who posted it (a tap
 * opens their page), a pause mark while held, More for posted stories and
 * Close. Always white over the photo's dark shade.
 */
export function StoryHeader({
  teller,
  slideIndex,
  progress,
  subtitle,
  paused,
  topInset,
  onProfile,
  onMore,
  onClose,
}: {
  teller: Teller;
  slideIndex: number;
  progress: SharedValue<number>;
  subtitle: string | null;
  paused: boolean;
  topInset: number;
  onProfile: () => void;
  onMore: () => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { t } = useLocale();
  const { name, vendor, personId } = teller;
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return (
    <View style={[styles.top, topShade, { paddingTop: Math.max(topInset, Spacing.md) }]}>
      <View style={styles.bars}>
        {teller.slides.map((item, i) => (
          <View key={item.id} style={styles.track}>
            {i < slideIndex && <View style={[styles.bar, styles.barFull]} />}
            {i === slideIndex && <Animated.View style={[styles.bar, barStyle]} />}
          </View>
        ))}
      </View>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('story.viewProfile', { name })}
          onPress={onProfile}
          disabled={!vendor && !personId}
          style={styles.who}
        >
          {teller.avatarUrl ? (
            <Image
              source={{ uri: teller.avatarUrl }}
              contentFit="cover"
              accessible={false}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlain]}>
              {vendor ? (
                <Icon name="storefront-outline" size={18} color="#FFFFFF" />
              ) : (
                <AppText variant="caption" weight={700} color="onPhoto">
                  {initials(name)}
                </AppText>
              )}
            </View>
          )}
          <View style={styles.whoText}>
            <View style={styles.nameRow}>
              <AppText
                weight={600}
                color="onPhoto"
                numberOfLines={1}
                style={[styles.shrink, styles.shadowed]}
              >
                {teller.isMine ? t('stories.yours') : name}
              </AppText>
              {teller.isSample && (
                <View style={styles.tag} accessible accessibilityLabel={t('sample.label')}>
                  <AppText variant="caption" weight={700} color="onPhoto">
                    {t('sample.tag')}
                  </AppText>
                </View>
              )}
            </View>
            {subtitle ? (
              <AppText
                variant="caption"
                color="onPhoto"
                numberOfLines={1}
                style={[styles.soft, styles.shadowed]}
              >
                {subtitle}
              </AppText>
            ) : null}
          </View>
        </Pressable>
        {paused && <Icon name="pause" size={18} color="#FFFFFF" />}
        {teller.live && !teller.isMine && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('reels.more')}
            onPress={onMore}
            hitSlop={8}
            style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
          >
            <Icon name="ellipsis-horizontal" size={22} color="#FFFFFF" />
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('story.close')}
          onPress={onClose}
          hitSlop={8}
          style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
        >
          <Icon name="close" size={22} color="#FFFFFF" weight="semibold" />
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  bars: {
    flexDirection: 'row',
    gap: 4,
  },
  track: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  bar: {
    height: 3,
    backgroundColor: '#FFFFFF',
  },
  barFull: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  who: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: Sizes.tapTarget,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarPlain: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138, 28, 51, 0.9)',
  },
  whoText: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  shrink: {
    flexShrink: 1,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  soft: {
    opacity: 0.9,
  },
  // Text over photos gets a soft shadow so it reads on bright ones too.
  shadowed: {
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(120, 120, 128, 0.36)',
  },
  closePressed: {
    backgroundColor: 'rgba(120, 120, 128, 0.56)',
  },
}));
