import { Image } from 'expo-image';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { storyRingStyle } from '@/components/story-ring';
import { Spacing } from '@/constants/theme';
import { compactCount, type Reel, type ReelVendor } from '@/data/reels';
import { initials } from '@/features/planner/plan-together';
import { AskWedButton } from '@/features/wed/ask-wed-button';
import { useLocale } from '@/i18n/locale-context';
import { saveHaptic } from '@/lib/haptics';

import { LIKED, REEL_INK, SAVED } from './reel-colors';

export type ReelActions = {
  onLike: (reel: Reel, like: boolean) => void;
  onFollow: (reel: Reel) => void;
  onComments: (reel: Reel) => void;
  onShare: (reel: Reel) => void;
  onMore: (reel: Reel) => void;
  /** Watch the poster's story (their avatar has a ring). */
  onStory: (reel: Reel) => void;
};

/** The rail down the right: the poster, like, comments, save, share, Wed, more and sound. */
export function ReelRail({
  reel,
  poster,
  story,
  business,
  isLink,
  muted,
  holding,
  bottomSpace,
  lift,
  railGap,
  chromeStyle,
  likeStyle,
  discStyle,
  saveTarget,
  saved,
  toggleSave,
  like,
  openPoster,
  onToggleMute,
  actions,
}: {
  reel: Reel;
  poster: string;
  story: 'new' | 'seen' | null;
  business: boolean;
  isLink: boolean;
  muted: boolean;
  holding: boolean;
  bottomSpace: number;
  lift: number;
  railGap: number;
  chromeStyle: StyleProp<AnimatedStyle<ViewStyle>>;
  likeStyle: StyleProp<AnimatedStyle<ViewStyle>>;
  discStyle: StyleProp<AnimatedStyle<ViewStyle>>;
  saveTarget: ReelVendor | null;
  saved: boolean;
  toggleSave: (vendorId: string) => void;
  like: () => void;
  openPoster: () => void;
  onToggleMute: () => void;
  actions: ReelActions;
}) {
  const { t } = useLocale();
  return (
    <Animated.View
      pointerEvents={holding ? 'none' : 'box-none'}
      style={[styles.rail, { bottom: bottomSpace + Spacing.sm + lift, gap: railGap }, chromeStyle]}
    >
      <View style={styles.posterButton}>
        <View
          style={
            story ? [styles.storyRing, story === 'new' ? storyRingStyle : styles.storySeen] : null
          }
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={story ? t('stories.watch', { name: poster }) : poster}
            onPress={story ? () => actions.onStory(reel) : openPoster}
            style={[styles.avatar, story && styles.avatarInRing]}
          >
            {reel.vendor ? (
              <Icon name="storefront-outline" size={24} color={REEL_INK} />
            ) : (
              <AppText weight={700} style={styles.ink}>
                {initials(reel.authorName)}
              </AppText>
            )}
          </Pressable>
        </View>
        {!reel.isMine && !reel.following && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('reels.follow', { name: poster })}
            onPress={() => actions.onFollow(reel)}
            hitSlop={8}
            style={styles.followDot}
          >
            <Icon name="add" size={16} color={REEL_INK} weight="bold" />
          </Pressable>
        )}
      </View>
      <RailButton
        icon="heart"
        color={reel.liked ? LIKED : REEL_INK}
        label={compactCount(reel.likeCount)}
        spoken={reel.liked ? t('reels.unlike') : t('reels.like')}
        iconStyle={likeStyle}
        onPress={() => {
          if (reel.liked) actions.onLike(reel, false);
          else like();
        }}
      />
      <RailButton
        icon="chatbubble"
        label={compactCount(reel.commentCount)}
        spoken={t('reels.comments', { count: reel.commentCount })}
        onPress={() => actions.onComments(reel)}
      />
      {saveTarget && !business && (
        <RailButton
          icon="bookmark"
          color={saved ? SAVED : REEL_INK}
          label={saved ? t('reels.saved') : t('reels.save')}
          spoken={
            saved
              ? t('reels.unsaveVendor', { name: saveTarget.name })
              : t('reels.saveVendor', { name: saveTarget.name })
          }
          onPress={() => {
            saveHaptic();
            toggleSave(saveTarget.id);
          }}
        />
      )}
      <RailButton
        icon="arrow-redo"
        label={t('reels.share')}
        spoken={t('reels.share')}
        onPress={() => actions.onShare(reel)}
      />
      {/* Wed (mockup): find vendors like this, with the reel's still in the chip */}
      {!business && (
        <AskWedButton
          variant="rail"
          about={{
            kind: 'reel',
            id: reel.id,
            label: `Reel by ${poster}`,
            thumb: reel.thumbUrl ?? undefined,
          }}
          ask="Find vendors like this for our Mehndi"
        />
      )}
      <RailButton
        icon="ellipsis-horizontal"
        label=""
        spoken={t('reels.more')}
        onPress={() => actions.onMore(reel)}
      />
      {/* TikTok's sound disc: turns while the sound plays; a tap mutes */}
      {!isLink && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={muted ? t('reels.turnSoundOn') : t('reels.turnSoundOff')}
          onPress={onToggleMute}
          hitSlop={6}
          style={({ pressed }) => [styles.discButton, pressed && styles.pressed]}
        >
          <Animated.View style={[styles.disc, discStyle]}>
            {reel.thumbUrl ? (
              <Image source={{ uri: reel.thumbUrl }} contentFit="cover" style={styles.discArt} />
            ) : (
              <Icon name="musical-notes-outline" size={16} color={REEL_INK} />
            )}
          </Animated.View>
          {muted && (
            <View style={styles.discMute}>
              <Icon name="volume-mute" size={12} color={REEL_INK} />
            </View>
          )}
        </Pressable>
      )}
    </Animated.View>
  );
}

function RailButton({
  icon,
  label,
  spoken,
  color = REEL_INK,
  iconStyle,
  onPress,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  spoken: string;
  color?: string;
  iconStyle?: StyleProp<AnimatedStyle<ViewStyle>>;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.railButton, pressed && styles.pressed]}
    >
      <Animated.View style={iconStyle}>
        <Icon name={icon} size={32} color={color} />
      </Animated.View>
      {label.length > 0 && (
        <AppText variant="caption" weight={700} style={styles.ink}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ink: {
    color: REEL_INK,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  rail: {
    position: 'absolute',
    right: Spacing.sm,
    alignItems: 'center',
  },
  posterButton: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: REEL_INK,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,28,51,0.9)',
  },
  // A story today: the avatar sits in the stories' ring, as on TikTok
  storyRing: {
    padding: 3,
    borderRadius: 30,
  },
  storySeen: {
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  avatarInRing: {
    borderColor: '#000000',
  },
  followDot: {
    position: 'absolute',
    bottom: -10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LIKED,
  },
  railButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  discButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A record: dark grooves round the reel's own still
  disc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 9,
    borderColor: '#1C1C1E',
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  discArt: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  discMute: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  pressed: {
    opacity: 0.6,
  },
});
