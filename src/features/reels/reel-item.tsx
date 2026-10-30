import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEventListener } from 'expo';
import { type VideoPlayer, useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  Linking,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  type AnimatedStyle,
  Easing,
  Keyframe,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { storyRingStyle } from '@/components/story-ring';
import { backgroundCss, Radius, Spacing, Springs } from '@/constants/theme';
import { trackReelView } from '@/data/business';
import { compactCount, type Reel, reelVendors } from '@/data/reels';
import { useSavedEventsFor, useSaveVendor } from '@/data/saved';
import { initials } from '@/features/planner/plan-together';
import { AskWedButton } from '@/features/wed/ask-wed-button';
import { useLocale } from '@/i18n/locale-context';
import { saveHaptic } from '@/lib/haptics';

import { BookingStrip, useStripState } from './booking-strip';
import { ReelEmbed } from './reel-embed';

// Reels play over video in both light and dark mode, so the text and icons on
// them are always white with a soft shadow, like TikTok's and Instagram's.
export const REEL_INK = '#FFFFFF';
export const REEL_DIM = 'rgba(255,255,255,0.78)';
const PILL = 'rgba(255,255,255,0.18)';
const LIKED = '#FF3B5C';
// TikTok's saved bookmark is yellow
const SAVED = '#FACE15';
// The booking strip's height before it has measured itself
const STRIP_GUESS = 64;

const DOUBLE_TAP_MS = 300;
// After a double tap, every quick tap adds another heart (TikTok's combo)
const COMBO_MS = 700;
const HEART_MS = 900;
const HEART_SIZE = 96;

// Soft shades behind the words, so they read over any video
const bottomShade = backgroundCss('linear-gradient(to top, rgba(0,0,0,0.62), rgba(0,0,0,0))');
const topShade = backgroundCss('linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0))');

// A heart where you tapped: pops, then floats up and fades
const heartPop = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 0 }, { scale: 0.3 }] },
  20: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1.15 }] },
  40: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  100: { opacity: 0, transform: [{ translateY: -110 }, { scale: 1.35 }] },
}).duration(HEART_MS);

type TapHeart = { id: number; x: number; y: number; tilt: number };

// The player is an object the hook owns; these change it from effects.
function setSound(player: VideoPlayer, muted: boolean) {
  player.muted = muted;
}
function playOrPause(player: VideoPlayer, play: boolean, rewind: boolean) {
  if (play) {
    player.play();
    return;
  }
  player.pause();
  if (rewind) player.currentTime = 0;
}

export type ReelActions = {
  onLike: (reel: Reel, like: boolean) => void;
  onFollow: (reel: Reel) => void;
  onComments: (reel: Reel) => void;
  onShare: (reel: Reel) => void;
  onMore: (reel: Reel) => void;
  /** Watch the poster's story (their avatar has a ring). */
  onStory: (reel: Reel) => void;
};

/**
 * One reel, filling the screen, made to feel like TikTok and Instagram: the
 * clip loops and plays only while it's on screen, with a thin progress line
 * along the bottom. A tap pauses; a double tap likes, with hearts where you
 * tapped (keep tapping for more); holding pauses and hides everything so the
 * video shows whole. The rail on the right has the poster (with follow, and
 * a ring when they have a story today, which the avatar then plays),
 * like, comments, share, sound and more; at the bottom are who posted it,
 * the caption (two lines, then "more"), then one row with the event and a
 * single vendors chip (one vendor opens their page; several open a list of
 * the poster and the ones tagged). Under them, over the tab bar, the booking
 * strip (booking-strip.tsx) makes the reel one tap from booking; holding
 * hides it with the rest. Wide clips show whole, not cropped. A pasted TikTok or
 * Instagram reel plays in the platform's own player instead (its own taps and
 * sound), credited to whoever made it, with a link to the original post.
 */
export function ReelItem({
  reel,
  height,
  active,
  muted,
  eventName,
  bottomSpace,
  story,
  business = false,
  onToggleMute,
  ...actions
}: ReelActions & {
  reel: Reel;
  height: number;
  /** On screen now: plays; otherwise paused at the start. */
  active: boolean;
  muted: boolean;
  /** The event's name in the family's language, when it's tagged. */
  eventName: string | null;
  /** Room for the floating tab bar under the caption. */
  bottomSpace: number;
  /** The poster has a story today: new, or already watched. */
  story: 'new' | 'seen' | null;
  /** Business mode: no booking strip, Save or Ask Wed, which are for families planning. */
  business?: boolean;
  onToggleMute: () => void;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [captionLines, setCaptionLines] = useState(0);
  const [hearts, setHearts] = useState<TapHeart[]>([]);
  const lastTap = useRef(0);
  const comboUntil = useRef(0);
  const heartId = useRef(0);
  const singleTap = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const progress = useSharedValue(0);
  const likePop = useSharedValue(1);
  // Save, as on TikTok: the reel's vendor (who posted it, or the first tagged)
  const saveTarget = reelVendors(reel)[0] ?? null;
  const savedFor = useSavedEventsFor(saveTarget?.id ?? '');
  const saved = !!saveTarget && savedFor.length > 0;
  const { toggleSave } = useSaveVendor();
  // TikTok's sound disc at the bottom of the rail turns while the sound plays
  const spin = useSharedValue(0);
  useEffect(() => {
    if (active && !muted && !reduceMotion) {
      spin.value = withRepeat(
        withTiming(spin.value + 360, { duration: 6000, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      spin.value = spin.value % 360;
    }
  }, [active, muted, reduceMotion, spin]);
  const discStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const chrome = useSharedValue(1);
  // The booking strip, and the room the rail and caption leave for it
  const strip = useStripState(reel);
  const [stripHeight, setStripHeight] = useState(STRIP_GUESS);
  const lift = !business && strip.kind !== 'none' ? stripHeight + Spacing.sm : 0;
  // Shorter phones keep the whole rail clear of the top bar
  const railGap = height < 800 ? Spacing.xs : Spacing.md;

  const player = useVideoPlayer(reel.videoUrl, (p) => {
    p.loop = true;
    p.muted = true;
    p.timeUpdateEventInterval = 0.25;
  });
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay') setReady(true);
  });
  // The progress line: glides between updates, jumps back when it loops
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const length = player.duration || reel.durationS;
    if (!length) return;
    const next = Math.min(1, currentTime / length);
    if (next < progress.get()) progress.set(next);
    else progress.set(withTiming(next, { duration: 250, easing: Easing.linear }));
  });

  // Scrolled away: start fresh, unpaused, next time it's on screen
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    if (!active) setPaused(false);
  }

  useEffect(() => setSound(player, muted), [player, muted]);
  // Counts for the vendor's My business numbers, once per reel per session
  useEffect(() => {
    if (active) trackReelView(reel.id);
  }, [active, reel.id]);
  useEffect(
    () => playOrPause(player, active && !paused && !holding, !active),
    [active, paused, holding, player],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      if (singleTap.current) clearTimeout(singleTap.current);
      for (const timer of pending) clearTimeout(timer);
    };
  }, []);

  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const likeStyle = useAnimatedStyle<ViewStyle>(() => ({ transform: [{ scale: likePop.value }] }));
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));

  const popLike = () => {
    if (reduceMotion) return;
    likePop.set(withSequence(withSpring(1.3, Springs.pop), withSpring(1, Springs.snappy)));
  };

  const like = () => {
    if (reel.liked) return;
    saveHaptic();
    popLike();
    actions.onLike(reel, true);
  };

  const addHeart = (event: GestureResponderEvent) => {
    if (reduceMotion) return;
    const id = ++heartId.current;
    const { locationX, locationY } = event.nativeEvent;
    setHearts((all) => [
      ...all,
      { id, x: locationX, y: locationY, tilt: Math.round(Math.random() * 40 - 20) },
    ]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setHearts((all) => all.filter((h) => h.id !== id));
    }, HEART_MS + 50);
    timers.current.add(timer);
  };

  // One tap pauses; two quick taps like (never unlike) with a heart where you
  // tapped, and each quick tap after that adds another heart
  const onVideoPress = (event: GestureResponderEvent) => {
    const now = Date.now();
    if (now < comboUntil.current || now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      comboUntil.current = now + COMBO_MS;
      if (singleTap.current) clearTimeout(singleTap.current);
      addHeart(event);
      like();
      return;
    }
    lastTap.current = now;
    singleTap.current = setTimeout(() => setPaused((p) => !p), DOUBLE_TAP_MS);
  };

  // Holding pauses and clears the screen, as on Instagram; letting go plays on
  const hold = (on: boolean) => {
    setHolding(on);
    chrome.set(withTiming(on ? 0 : 1, { duration: 180 }));
  };

  const isLink = reel.source === 'link';
  const poster = reel.vendor?.name ?? reel.authorName ?? t('reels.someone');
  const vendors = reelVendors(reel);
  // Wide clips show whole with bars, as TikTok does; upright ones fill the screen
  const fit = reel.width && reel.height && reel.width > reel.height ? 'contain' : 'cover';
  const openPoster = () =>
    reel.vendor
      ? router.push({ pathname: '/v/[slug]', params: { slug: reel.vendor.slug } })
      : router.push({ pathname: '/u/[id]', params: { id: reel.authorId } });

  return (
    <View style={[styles.page, { height }]}>
      {isLink ? (
        <ReelEmbed reel={reel} active={active} />
      ) : (
        <Pressable
          onPress={onVideoPress}
          onLongPress={() => hold(true)}
          onPressOut={() => {
            if (holding) hold(false);
          }}
          delayLongPress={300}
          accessibilityRole="button"
          accessibilityLabel={paused ? t('reels.play') : t('reels.pause')}
          accessibilityHint={t('reels.doubleTapHint')}
          style={StyleSheet.absoluteFill}
        >
          <VideoView
            player={player}
            style={styles.video}
            contentFit={fit}
            nativeControls={false}
            allowsPictureInPicture={false}
            surfaceType="textureView"
          />
          {/* The thumbnail until the first frame is ready */}
          {!ready && reel.thumbUrl && (
            <Image
              source={{ uri: reel.thumbUrl }}
              contentFit={fit}
              style={StyleSheet.absoluteFill}
            />
          )}
          {paused && !holding && (
            <View style={styles.center} pointerEvents="none">
              <Icon name="play" size={72} color={REEL_DIM} />
            </View>
          )}
          {hearts.map((h) => (
            <View
              key={h.id}
              pointerEvents="none"
              style={[
                styles.heart,
                {
                  left: h.x - HEART_SIZE / 2,
                  top: h.y - HEART_SIZE / 2,
                  transform: [{ rotate: `${h.tilt}deg` }],
                },
              ]}
            >
              <Animated.View entering={heartPop}>
                <Icon name="heart" size={HEART_SIZE} color={LIKED} />
              </Animated.View>
            </View>
          ))}
        </Pressable>
      )}

      <Animated.View pointerEvents="none" style={[styles.topShade, topShade, chromeStyle]} />
      <Animated.View
        pointerEvents="none"
        style={[styles.shade, bottomShade, { height: 300 + bottomSpace + lift }, chromeStyle]}
      />
      {/* Long captions open over a darker screen */}
      {expanded && <View pointerEvents="none" style={styles.dim} />}

      <Animated.View
        pointerEvents={holding ? 'none' : 'box-none'}
        style={[
          styles.rail,
          { bottom: bottomSpace + Spacing.sm + lift, gap: railGap },
          chromeStyle,
        ]}
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

      {/* Unmounted while holding rather than faded: iOS drops Liquid Glass
          from a view that goes see-through, and it wouldn't come back */}
      {!business && !holding && strip.kind !== 'none' && (
        <BookingStrip state={strip} bottom={bottomSpace + Spacing.sm} onHeight={setStripHeight} />
      )}

      {/* How far into the clip, along the bottom like TikTok's */}
      {!isLink && (
        <Animated.View
          pointerEvents="none"
          style={[styles.track, { bottom: bottomSpace }, chromeStyle]}
        >
          <Animated.View style={[styles.progress, progressStyle]} />
        </Animated.View>
      )}
    </View>
  );
}

/** The platform's own name, the same in every language. */
function platformName(reel: Reel): string {
  return reel.platform === 'instagram' ? 'Instagram' : 'TikTok';
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
  page: {
    width: '100%',
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  // Web videos keep their intrinsic size unless both dimensions are explicit.
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  center: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heart: {
    position: 'absolute',
    width: HEART_SIZE,
    height: HEART_SIZE,
  },
  shade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  topShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 160,
  },
  dim: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  more: {
    marginTop: 2,
  },
  measure: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0,
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progress: {
    height: 2,
    backgroundColor: REEL_INK,
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
