import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  scrollTo,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { AppText } from '@/components/app-text';
import { GlassButton } from '@/components/glass-button';
import { PressableScale } from '@/components/pressable-scale';
import { backgroundCss, makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

import type { JoinedAs } from './join-steps';

// Each choice plays its own loop (cut from free Pexels clips, credits in
// assets/videos/README.md): a family at the fire and joined hands for
// planning, a henna night and a bride for looking, flower trays and a mehndi
// artist at work for a business.
const PAGES: { value: JoinedAs; video: VideoSource; poster: ImageSourcePropType }[] = [
  {
    value: 'planning',
    video: require('../../../assets/videos/join-planning.mp4'),
    poster: require('../../../assets/images/join-planning.jpg'),
  },
  {
    value: 'looking',
    video: require('../../../assets/videos/join-looking.mp4'),
    poster: require('../../../assets/images/join-looking.jpg'),
  },
  {
    value: 'business',
    video: require('../../../assets/videos/join-business.mp4'),
    poster: require('../../../assets/images/join-business.jpg'),
  },
];

// Shade so white words read on any frame: a little all over, more at the
// top behind the question and at the bottom behind the words and buttons.
const DIM = 'rgba(0, 0, 0, 0.12)';
const TOP_SHADE = 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)';
const BOTTOM_SHADE =
  'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0) 100%)';

/**
 * "What brings you to Wedded?" for a new account, before their name: three
 * full-screen pages they swipe between, each playing its own weddings (Fezy,
 * 2026-11-05). The words for the three sit at the bottom too, so a tap works
 * as well as a swipe for anyone who wouldn't think to swipe, with a bar that
 * slides under the one showing. Continue takes the one on screen. Only the
 * page on screen plays; with Reduce Motion each shows its still.
 */
export function JoinChoicePages({
  onChoose,
  onClose,
}: {
  onChoose: (choice: JoinedAs) => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const Colors = useColors();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;
  const [page, setPage] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const scroller = useAnimatedRef<Animated.ScrollView>();
  const x = useSharedValue(0);
  const shown = useSharedValue(0);
  // Where each word sits in the row, for the bar under it
  const [tabs, setTabs] = useState<{ x: number; width: number }[]>([]);

  const onScroll = useAnimatedScrollHandler((event) => {
    x.value = event.contentOffset.x;
    const w = event.layoutMeasurement.width;
    if (w <= 0) return;
    const next = Math.round(event.contentOffset.x / w);
    if (next !== shown.value) {
      shown.value = next;
      scheduleOnRN(setPage, next);
      scheduleOnRN(selectionHaptic);
    }
  });

  const goTo = (index: number) => {
    if (index === page || width === 0) return;
    scheduleOnUI(() => {
      'worklet';
      scrollTo(scroller, index * width, 0, true);
    });
  };

  const measureTab = (index: number) => (event: LayoutChangeEvent) => {
    const { x: left, width: tabWidth } = event.nativeEvent.layout;
    setTabs((current) => {
      const next = [...current];
      next[index] = { x: left, width: tabWidth };
      return next;
    });
  };

  // A sparse array skips its holes in every(), so count what's there
  const measured = tabs.filter(Boolean).length === PAGES.length;
  const bar = useAnimatedStyle(() => {
    if (!measured || width === 0) return { opacity: 0 };
    const input = PAGES.map((_, i) => i * width);
    return {
      opacity: 1,
      width: interpolate(
        x.value,
        input,
        tabs.map((tab) => tab.width),
      ),
      transform: [
        {
          translateX: interpolate(
            x.value,
            input,
            tabs.map((tab) => tab.x),
          ),
        },
      ],
    };
  });

  const choice = PAGES[page]?.value ?? 'planning';

  return (
    <View
      style={styles.root}
      onLayout={(event) => {
        const { width: w, height: h } = event.nativeEvent.layout;
        setSize({ width: Math.round(w), height: Math.round(h) });
      }}
    >
      {width > 0 && (
        <Animated.ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={StyleSheet.absoluteFill}
        >
          {PAGES.map((item, index) => (
            <View
              key={item.value}
              // Sized outright: the web doesn't stretch a sideways page to the screen's height
              style={{ width, height }}
              accessible
              accessibilityLabel={`${t(`signIn.join.${item.value}`)}. ${t(`signIn.join.${item.value}Detail`)}`}
            >
              <Clip video={item.video} poster={item.poster} active={index === page} />
              <View style={[StyleSheet.absoluteFill, styles.dim]} />
              <View style={[styles.topShade, backgroundCss(TOP_SHADE)]} />
              <View style={[styles.bottomShade, backgroundCss(BOTTOM_SHADE)]} />
              <View style={[styles.copy, { paddingBottom: footerHeight + Spacing.xl }]}>
                <AppText variant="display" weight={700} color="onPhoto" style={styles.title}>
                  {t(`signIn.join.${item.value}`)}
                </AppText>
                <AppText variant="bodyLg" color="onPhoto" style={styles.detail}>
                  {t(`signIn.join.${item.value}Detail`)}
                </AppText>
              </View>
            </View>
          ))}
        </Animated.ScrollView>
      )}

      <View
        style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}
        pointerEvents="box-none"
      >
        <AppText variant="label" weight={600} color="onPhoto" accessibilityRole="header">
          {t('signIn.join.title')}
        </AppText>
        <GlassButton
          icon="close"
          color={Colors.onPhoto}
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          size={44}
        />
      </View>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + Spacing.sm }]}
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
      >
        <View style={styles.tabs} accessibilityRole="tablist">
          {PAGES.map((item, index) => (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: index === page }}
              onLayout={measureTab(index)}
              onPress={() => goTo(index)}
              hitSlop={8}
              style={styles.tab}
            >
              <AppText
                variant="label"
                weight={index === page ? 700 : 500}
                color="onPhoto"
                style={index !== page && styles.tabOff}
              >
                {t(`signIn.join.tabs.${item.value}`)}
              </AppText>
            </Pressable>
          ))}
          <Animated.View style={[styles.bar, bar]} pointerEvents="none" />
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${t('signIn.join.continue')}: ${t(`signIn.join.${choice}`)}`}
          onPress={() => {
            selectionHaptic();
            onChoose(choice);
          }}
          style={styles.pill}
        >
          <AppText variant="button" weight={700} style={styles.pillText}>
            {t('signIn.join.continue')}
          </AppText>
        </PressableScale>
      </View>
    </View>
  );
}

/**
 * One page's loop behind its words: the still first, then the video fading
 * in over it once it's playing. Plays only while its page is on screen.
 * List your business (/for-vendors) opens on one too.
 */
export function Clip({
  video,
  poster,
  active,
}: {
  video: VideoSource;
  poster: ImageSourcePropType;
  active: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const visible = useSharedValue(0);
  const player = useVideoPlayer(video, (p) => {
    p.loop = true;
    p.muted = true;
    p.audioMixingMode = 'mixWithOthers';
  });
  const released = useRef(false);

  useEffect(() => {
    released.current = false;
    return () => {
      released.current = true;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion || released.current) return;
    try {
      if (active) player.play();
      else player.pause();
    } catch {}
  }, [active, player, reduceMotion]);

  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    if (isPlaying && visible.get() === 0) visible.set(withTiming(1, { duration: 400 }));
  });

  const fade = useAnimatedStyle(() => ({ opacity: visible.value }));

  return (
    <View
      style={StyleSheet.absoluteFill}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Image source={poster} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {!reduceMotion && (
        <Animated.View style={[StyleSheet.absoluteFill, fade]}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
            allowsPictureInPicture={false}
            playsInline
          />
        </Animated.View>
      )}
    </View>
  );
}

const PILL_HEIGHT = 56;

const useStyles = makeStyles((Colors) => ({
  root: {
    flex: 1,
    backgroundColor: Colors.viewer,
  },
  dim: {
    pointerEvents: 'none',
    backgroundColor: DIM,
  },
  topShade: {
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  bottomShade: {
    pointerEvents: 'none',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '62%',
  },
  copy: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: Spacing.sm,
    paddingHorizontal: Sizes.pageGutter + Spacing.xs,
  },
  title: {
    letterSpacing: -0.5,
  },
  detail: {
    opacity: 0.9,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Sizes.pageGutter + Spacing.xs,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: Spacing.lg,
    paddingHorizontal: Sizes.pageGutter + Spacing.xs,
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: Spacing.sm,
  },
  tab: {
    minHeight: Sizes.tapTarget,
    justifyContent: 'center',
  },
  tabOff: {
    opacity: 0.6,
  },
  bar: {
    position: 'absolute',
    left: 0,
    bottom: Spacing.sm,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.onPhoto,
  },
  pill: {
    minHeight: PILL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.button,
    borderCurve: 'continuous',
    backgroundColor: Colors.canvas,
  },
  pillText: {
    color: Colors.text,
  },
}));
