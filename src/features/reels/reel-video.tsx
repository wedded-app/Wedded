import { Image } from 'expo-image';
import { type VideoPlayer, VideoView } from 'expo-video';
import { type GestureResponderEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import type { Reel } from '@/data/reels';
import { useLocale } from '@/i18n/locale-context';

import { LIKED, REEL_DIM } from './reel-colors';

export const HEART_MS = 900;
const HEART_SIZE = 96;

// A heart where you tapped: pops, then floats up and fades
const heartPop = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 0 }, { scale: 0.3 }] },
  20: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1.15 }] },
  40: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  100: { opacity: 0, transform: [{ translateY: -110 }, { scale: 1.35 }] },
}).duration(HEART_MS);

export type TapHeart = { id: number; x: number; y: number; tilt: number };

/** The clip, with its still until it's ready, the play sign while paused and the hearts. */
export function ReelVideo({
  reel,
  player,
  fit,
  ready,
  paused,
  holding,
  hearts,
  onVideoPress,
  hold,
}: {
  reel: Reel;
  player: VideoPlayer;
  fit: 'contain' | 'cover';
  ready: boolean;
  paused: boolean;
  holding: boolean;
  hearts: TapHeart[];
  onVideoPress: (event: GestureResponderEvent) => void;
  hold: (on: boolean) => void;
}) {
  const { t } = useLocale();
  return (
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
        <Image source={{ uri: reel.thumbUrl }} contentFit={fit} style={StyleSheet.absoluteFill} />
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
  );
}

const styles = StyleSheet.create({
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
});
