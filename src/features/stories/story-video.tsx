import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Easing, type SharedValue, withTiming } from 'react-native-reanimated';

// Browsers only autoplay muted video
const MUTED = Platform.OS === 'web';

/** One clip: plays once with its progress bar, then hands on to the next. */
export function StoryVideo({
  url,
  paused,
  progress,
  onEnd,
  label,
}: {
  url: string;
  paused: boolean;
  progress: SharedValue<number>;
  onEnd: () => void;
  label: string;
}) {
  const player = useVideoPlayer(url, (p) => {
    p.muted = MUTED;
    p.timeUpdateEventInterval = 0.1;
  });
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (player.duration > 0) {
      progress.set(
        withTiming(Math.min(1, currentTime / player.duration), {
          duration: 100,
          easing: Easing.linear,
        }),
      );
    }
  });
  useEventListener(player, 'playToEnd', onEnd);
  // A clip that won't load is skipped rather than leaving a black screen
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') onEnd();
  });
  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      allowsPictureInPicture={false}
      surfaceType="textureView"
      accessible
      accessibilityLabel={label}
    />
  );
}
