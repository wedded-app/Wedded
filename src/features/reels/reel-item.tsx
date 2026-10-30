import { useRouter } from 'expo-router';
import { useEventListener } from 'expo';
import { type VideoPlayer, useVideoPlayer } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { type GestureResponderEvent, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { backgroundCss, Spacing, Springs } from '@/constants/theme';
import { trackReelView } from '@/data/business';
import { type Reel, reelVendors } from '@/data/reels';
import { useSavedEventsFor, useSaveVendor } from '@/data/saved';
import { useLocale } from '@/i18n/locale-context';
import { saveHaptic } from '@/lib/haptics';

import { BookingStrip, useStripState } from './booking-strip';
import { REEL_INK } from './reel-colors';
import { ReelEmbed } from './reel-embed';
import { ReelInfo } from './reel-info';
import { type ReelActions, ReelRail } from './reel-rail';
import { HEART_MS, ReelVideo, type TapHeart } from './reel-video';

// Other screens import these from here
export { REEL_DIM, REEL_INK } from './reel-colors';
export type { ReelActions } from './reel-rail';

// The booking strip's height before it has measured itself
const STRIP_GUESS = 64;

const DOUBLE_TAP_MS = 300;
// After a double tap, every quick tap adds another heart (TikTok's combo)
const COMBO_MS = 700;

// Soft shades behind the words, so they read over any video
const bottomShade = backgroundCss('linear-gradient(to top, rgba(0,0,0,0.62), rgba(0,0,0,0))');
const topShade = backgroundCss('linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0))');

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
        <ReelVideo
          reel={reel}
          player={player}
          fit={fit}
          ready={ready}
          paused={paused}
          holding={holding}
          hearts={hearts}
          onVideoPress={onVideoPress}
          hold={hold}
        />
      )}

      <Animated.View pointerEvents="none" style={[styles.topShade, topShade, chromeStyle]} />
      <Animated.View
        pointerEvents="none"
        style={[styles.shade, bottomShade, { height: 300 + bottomSpace + lift }, chromeStyle]}
      />
      {/* Long captions open over a darker screen */}
      {expanded && <View pointerEvents="none" style={styles.dim} />}

      <ReelRail
        reel={reel}
        poster={poster}
        story={story}
        business={business}
        isLink={isLink}
        muted={muted}
        holding={holding}
        bottomSpace={bottomSpace}
        lift={lift}
        railGap={railGap}
        chromeStyle={chromeStyle}
        likeStyle={likeStyle}
        discStyle={discStyle}
        saveTarget={saveTarget}
        saved={saved}
        toggleSave={toggleSave}
        like={like}
        openPoster={openPoster}
        onToggleMute={onToggleMute}
        actions={actions}
      />

      <ReelInfo
        reel={reel}
        poster={poster}
        eventName={eventName}
        vendors={vendors}
        holding={holding}
        bottomSpace={bottomSpace}
        lift={lift}
        chromeStyle={chromeStyle}
        expanded={expanded}
        setExpanded={setExpanded}
        captionLines={captionLines}
        setCaptionLines={setCaptionLines}
        openPoster={openPoster}
      />

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

const styles = StyleSheet.create({
  page: {
    width: '100%',
    backgroundColor: '#000000',
    overflow: 'hidden',
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
});
