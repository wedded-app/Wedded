import MaskedView from '@react-native-masked-view/masked-view';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { useScheme } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';

/**
 * The opening animation, built like a brand film's title card. Four satin
 * ribbons sweep in from the corners, spiral like a pinwheel and tie into the
 * ribbon-knot logo (a video made with Higgsfield whose last frame is the logo
 * exactly where the image sits; assets/videos), played at 1.5x so it's done
 * in about 1.1 s. As the knot pulls tight the logo lifts and WEDDED rises in
 * under it; the image takes over the last frame unseen, a band of light
 * sweeps across the satin, and the lockup lifts away to show the app. About
 * 1.85 s, once per launch, over the app as it loads. Dark mode plays the same
 * video in negative with a champagne sweep. With Reduce Motion the lockup
 * just shows and fades; if the video can't play, it skips to the logo. Not
 * on the web, where people arrive on a shared page.
 */

const VIDEO = {
  light: require('../../assets/videos/intro-light.mp4'),
  dark: require('../../assets/videos/intro-dark.mp4'),
};
const RIBBON = {
  light: require('../../assets/images/ribbon.png'),
  dark: require('../../assets/images/ribbon-white.png'),
};
// The videos' own background colours, so the screen around them matches
const BACKGROUND = { light: '#FFFFFF', dark: '#030502' };
const INK = { light: '#141414', dark: '#F7F7F7' };
// Warm light on black satin; champagne on white satin, where white wouldn't show
const SHEEN = { light: 'rgba(255,246,232,0.6)', dark: 'rgba(214,166,98,0.75)' };
// In the video (1080 wide) the logo is 452 wide, centred: 180 of a ~430 pt
// screen, shown with contentFit "contain"
const WIDTH = 180;
const HEIGHT = Math.round((WIDTH * 430) / 509);
const BAND = 64;

// The wordmark, tracked out like a fashion house's
const WORD_LINE = 30;
const TRACKING = 8;
const GAP = 18;
// The logo lifts half the wordmark's room, so logo and word sit centred together
const LIFT = (GAP + WORD_LINE) / 2;

const RATE = 1.5;
// Seconds into the (1.65 s) video when the knot is nearly tied: form the lockup
const FORM_AT = 1.05;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

// ms
const VIDEO_LIMIT = 3200; // longest we wait for the video before skipping to the logo
const FORM = 440;
const SWEEP = 440;
const EXIT_AT = 380; // after the video ends
const EXIT = 260;
const FADE = 300;
const HOLD = 500; // Reduce Motion: how long the lockup shows before it fades

const gradient = (css: string) =>
  (Platform.OS === 'web'
    ? { backgroundImage: css }
    : { experimental_backgroundImage: css }) as ViewStyle;

export function AppIntro() {
  const [showing, setShowing] = useState(Platform.OS !== 'web');
  // Stable, so the app re-rendering underneath never restarts the animation
  const done = useCallback(() => setShowing(false), []);
  if (!showing) return null;
  return <Intro onDone={done} />;
}

function Intro({ onDone }: { onDone: () => void }) {
  const mode = useScheme() === 'dark' ? 'dark' : 'light';
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  // The video has played to the end (or can't play): time for the logo
  const [ended, setEnded] = useState(reduceMotion);
  // The knot is nearly tied: the logo lifts and the wordmark rises
  const [formed, setFormed] = useState(reduceMotion);
  const forming = formed || ended;

  const player = useVideoPlayer(VIDEO[mode], (p) => {
    p.muted = true;
    p.loop = false;
    p.playbackRate = RATE;
    p.timeUpdateEventInterval = 0.05;
    if (!reduceMotion) p.play();
  });
  useEventListener(player, 'playToEnd', () => setEnded(true));
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') setEnded(true);
  });
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (currentTime >= FORM_AT) setFormed(true);
  });
  useEffect(() => {
    if (ended) return;
    const timer = setTimeout(() => setEnded(true), VIDEO_LIMIT);
    return () => clearTimeout(timer);
  }, [ended]);

  // With Reduce Motion the lockup starts formed and nothing moves
  const lift = useSharedValue(reduceMotion ? 1 : 0);
  const rise = useSharedValue(reduceMotion ? 1 : 0);
  const logoIn = useSharedValue(0);
  const sweep = useSharedValue(0);
  const exit = useSharedValue(0);
  const reveal = useSharedValue(0);

  // The timings run even with Reduce Motion on; only the movement is left out
  useEffect(() => {
    if (!forming || reduceMotion) return;
    const always = { reduceMotion: ReduceMotion.Never };
    lift.set(withTiming(1, { duration: FORM, easing: EASE_IN_OUT, ...always }));
    rise.set(withDelay(80, withTiming(1, { duration: FORM + 40, easing: EASE_OUT, ...always })));
  }, [forming, reduceMotion, lift, rise]);

  useEffect(() => {
    if (!ended) return;
    const always = { reduceMotion: ReduceMotion.Never };
    if (reduceMotion) {
      logoIn.set(1);
      exit.set(withDelay(HOLD, withTiming(1, { duration: 200, ...always })));
      reveal.set(withDelay(HOLD, withTiming(1, { duration: 240, ...always })));
      const timer = setTimeout(onDone, HOLD + 270);
      return () => clearTimeout(timer);
    }
    logoIn.set(withTiming(1, { duration: 60, ...always }));
    sweep.set(withTiming(1, { duration: SWEEP, easing: EASE_IN_OUT, ...always }));
    exit.set(withDelay(EXIT_AT, withTiming(1, { duration: EXIT, easing: EASE_OUT, ...always })));
    reveal.set(
      withDelay(EXIT_AT + 40, withTiming(1, { duration: FADE, easing: EASE_OUT, ...always })),
    );
    const timer = setTimeout(onDone, EXIT_AT + 40 + FADE + 30);
    return () => clearTimeout(timer);
  }, [ended, reduceMotion, onDone, logoIn, sweep, exit, reveal]);

  const backdrop = useAnimatedStyle(() => ({ opacity: 1 - reveal.get() }));
  const group = useAnimatedStyle(() => ({ transform: [{ translateY: -LIFT * lift.get() }] }));
  // The image covers the video's last frame exactly, so the swap is unseen
  const video = useAnimatedStyle(() => ({ opacity: 1 - logoIn.get() }));
  const logo = useAnimatedStyle(() => ({ opacity: logoIn.get() }));
  const lockup = useAnimatedStyle(() => ({
    opacity: 1 - exit.get(),
    transform: reduceMotion
      ? []
      : [{ translateY: -10 * exit.get() }, { scale: 1 + 0.03 * exit.get() }],
  }));
  const word = useAnimatedStyle(() => ({
    opacity: rise.get(),
    transform: [{ translateY: WORD_LINE * (1 - rise.get()) }],
  }));
  const sheen = useAnimatedStyle(() => ({
    transform: [{ translateX: -2 * BAND + (WIDTH + 3 * BAND) * sweep.get() }, { rotate: '20deg' }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        StyleSheet.absoluteFill,
        styles.center,
        { backgroundColor: BACKGROUND[mode] },
        backdrop,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, group]}>
        {!reduceMotion && (
          <Animated.View style={[StyleSheet.absoluteFill, video]}>
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              nativeControls={false}
              allowsPictureInPicture={false}
              // A texture view fades with its parent on Android; a surface view wouldn't
              surfaceType="textureView"
            />
          </Animated.View>
        )}
        <Animated.View style={lockup}>
          <Animated.View style={logo}>
            <Image source={RIBBON[mode]} style={styles.image} accessible={false} />
            {/* Light across the satin: the band shows only where the ribbon is */}
            {!reduceMotion && (
              <MaskedView
                style={styles.mask}
                maskElement={<Image source={RIBBON[mode]} style={styles.image} />}
              >
                <Animated.View
                  style={[
                    styles.band,
                    gradient(`linear-gradient(to right, transparent, ${SHEEN[mode]}, transparent)`),
                    sheen,
                  ]}
                />
              </MaskedView>
            )}
          </Animated.View>
          {/* The wordmark rises from behind an unseen line, like a title card */}
          <View style={styles.wordClip}>
            <Animated.View style={word}>
              <AppText
                weight={500}
                allowFontScaling={false}
                style={[styles.word, { color: INK[mode] }]}
              >
                {t('welcome.brand')}
              </AppText>
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  image: { width: WIDTH, height: HEIGHT },
  mask: { position: 'absolute', top: 0, left: 0, width: WIDTH, height: HEIGHT },
  band: {
    position: 'absolute',
    top: -HEIGHT * 0.25,
    left: 0,
    width: BAND,
    height: HEIGHT * 1.5,
  },
  wordClip: {
    position: 'absolute',
    top: HEIGHT + GAP,
    left: -WIDTH / 2,
    right: -WIDTH / 2,
    height: WORD_LINE,
    overflow: 'hidden',
    alignItems: 'center',
  },
  word: {
    fontSize: 22,
    lineHeight: WORD_LINE,
    letterSpacing: TRACKING,
    // RN adds the tracking after the last letter too; this keeps the word centred
    paddingLeft: TRACKING,
    textTransform: 'uppercase',
  },
});
