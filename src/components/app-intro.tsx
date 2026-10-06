import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useState } from 'react';
import { Image, Platform, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useScheme } from '@/constants/theme';

/**
 * The opening animation: four satin ribbons sweep in from the corners, spiral
 * like a pinwheel, pull into a knot and settle into the ribbon-knot logo
 * (a video made with Higgsfield from a blank first frame and the logo as the
 * last, smoothed to 60 fps and sped up so it's quick in, gentle at the end;
 * assets/videos, about 1.7 s). The video's last frame is the logo exactly
 * where the image sits, so the image takes over unseen, cinches, then zooms
 * away to show the app. Dark mode plays the same video in negative (white
 * ribbons on black). Once per launch, over the app as it loads. With Reduce
 * Motion the logo just fades; if the video can't play, it skips to the logo.
 * Not on the web, where people arrive on a shared page.
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
// In the video (1080 wide) the logo is 452 wide, centred: 180 of a ~430 pt
// screen, shown with contentFit "contain"
const WIDTH = 180;
const HEIGHT = Math.round((WIDTH * 430) / 509);

// ms
const VIDEO_LIMIT = 3200; // longest we wait for the video before skipping to the logo
const CINCH = 150;
const REVEAL = 300;

export function AppIntro() {
  const [showing, setShowing] = useState(Platform.OS !== 'web');
  // Stable, so the app re-rendering underneath never restarts the animation
  const done = useCallback(() => setShowing(false), []);
  if (!showing) return null;
  return <Intro onDone={done} />;
}

function Intro({ onDone }: { onDone: () => void }) {
  const mode = useScheme() === 'dark' ? 'dark' : 'light';
  const reduceMotion = useReducedMotion();
  // The video has played to the end (or can't play): time for the logo
  const [ended, setEnded] = useState(reduceMotion);

  const player = useVideoPlayer(VIDEO[mode], (p) => {
    p.muted = true;
    p.loop = false;
    if (!reduceMotion) p.play();
  });
  useEventListener(player, 'playToEnd', () => setEnded(true));
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') setEnded(true);
  });
  useEffect(() => {
    if (ended) return;
    const timer = setTimeout(() => setEnded(true), VIDEO_LIMIT);
    return () => clearTimeout(timer);
  }, [ended]);

  const logoIn = useSharedValue(0);
  const cinch = useSharedValue(1);
  const reveal = useSharedValue(0);

  useEffect(() => {
    if (!ended) return;
    // The timings run even with Reduce Motion on; only the movement is left out
    const always = { reduceMotion: ReduceMotion.Never };
    logoIn.value = reduceMotion ? 1 : withTiming(1, { duration: 60, ...always });
    if (reduceMotion) {
      reveal.value = withTiming(1, { duration: 200, ...always });
      const timer = setTimeout(onDone, 560);
      return () => clearTimeout(timer);
    }
    cinch.value = withSequence(
      withTiming(0.94, { duration: CINCH * 0.4, easing: Easing.out(Easing.quad), ...always }),
      withTiming(1, { duration: CINCH * 0.6, easing: Easing.out(Easing.quad), ...always }),
    );
    reveal.value = withSequence(
      withTiming(0, { duration: CINCH + 40, ...always }),
      withTiming(1, { duration: REVEAL, easing: Easing.in(Easing.cubic), ...always }),
    );
    const timer = setTimeout(onDone, CINCH + 40 + REVEAL + 30);
    return () => clearTimeout(timer);
  }, [ended, reduceMotion, onDone, logoIn, cinch, reveal]);

  const backdrop = useAnimatedStyle(() => ({ opacity: 1 - reveal.value }));
  const logo = useAnimatedStyle(() => ({
    opacity: logoIn.value,
    transform: [{ scale: cinch.value * (1 + (reduceMotion ? 0 : reveal.value * 1.6)) }],
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
      {!reduceMotion && (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls={false}
          allowsPictureInPicture={false}
          // A texture view fades with its parent on Android; a surface view wouldn't
          surfaceType="textureView"
        />
      )}
      <Animated.View style={logo}>
        <Image source={RIBBON[mode]} style={styles.image} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  image: { width: WIDTH, height: HEIGHT },
});
