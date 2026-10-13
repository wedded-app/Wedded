import { useEventListener } from 'expo';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

// A 15-second loop of real weddings (a couple at the fire, mehndi, a Punjabi
// family with flower trays, joined hands, a henna night, a bride in red, a
// bride in Dubai) cut from Pexels clips; credits in assets/videos/README.md.
const VIDEO = require('../../assets/videos/welcome.mp4');
const POSTER = require('../../assets/images/welcome-poster.jpg');

/**
 * Weddings playing behind whatever sits on top (the welcome screen, Home
 * before there's a plan): muted, looping, never stopping the family's music,
 * paused while another screen is on top. The first frame waits under it as a
 * still, and the video fades in over it once it's playing. With Reduce Motion
 * it stays the still.
 */
export function WeddingReel() {
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(0);
  const player = useVideoPlayer(VIDEO, (p) => {
    p.loop = true;
    p.muted = true;
    p.audioMixingMode = 'mixWithOthers';
  });

  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) return;
      player.play();
      return () => {
        // Leaving the screen releases the player before this runs, and
        // pausing a released player throws.
        try {
          player.pause();
        } catch {}
      };
    }, [player, reduceMotion]),
  );

  const reveal = useCallback(() => {
    if (shown.get() === 0) shown.set(withTiming(1, { duration: 600 }));
  }, [shown]);
  // The browser can load the first frame before anyone's listening, so
  // playing at all counts too.
  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    if (isPlaying) reveal();
  });

  const fade = useAnimatedStyle(() => ({ opacity: shown.value }));

  return (
    <View
      style={StyleSheet.absoluteFill}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Image source={POSTER} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {!reduceMotion && (
        <Animated.View style={[StyleSheet.absoluteFill, fade]}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
            allowsPictureInPicture={false}
            playsInline
            onFirstFrameRender={reveal}
          />
        </Animated.View>
      )}
    </View>
  );
}
