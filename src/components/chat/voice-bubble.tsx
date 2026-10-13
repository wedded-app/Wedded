import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';
import { formatDuration } from '@/features/chat/voice';
import { useLocale } from '@/i18n/locale-context';

/**
 * A voice note in a chat: a big play / pause button, a line that fills as it
 * plays, and its length ("0:12 / 0:45" while playing). The app colour for
 * mine, white for theirs, like the text bubbles. Plays even with the phone
 * on silent, since someone tapped play on purpose. `uri` is null while its
 * link loads.
 */
export function VoiceBubble({
  uri,
  durationMs,
  mine,
}: {
  uri: string | null;
  durationMs: number;
  mine: boolean;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const player = useAudioPlayer(uri ? { uri } : null);
  const status = useAudioPlayerStatus(player);

  // Back to the start when it ends, ready to play again
  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      void player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  const total = status.duration > 0 ? status.duration * 1000 : durationMs;
  const position = status.currentTime * 1000;
  const progress = total > 0 ? Math.min(1, position / total) : 0;
  const started = status.playing || position > 0;
  const ink = mine ? Colors.onPrimary : Colors.primary;

  const toggle = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    player.play();
  };

  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          status.playing
            ? t('chat.voice.pause')
            : t('chat.voice.play', { length: formatDuration(durationMs) })
        }
        accessibilityState={{ disabled: !uri }}
        disabled={!uri}
        onPress={() => void toggle()}
        hitSlop={4}
        style={({ pressed }) => [
          styles.play,
          mine ? styles.playMine : styles.playTheirs,
          (pressed || !uri) && styles.dim,
        ]}
      >
        <Icon name={status.playing ? 'pause' : 'play'} size={22} color={ink} />
      </Pressable>
      <View style={styles.middle}>
        <View style={[styles.track, mine ? styles.trackMine : styles.trackTheirs]}>
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: ink }]} />
        </View>
        <AppText
          variant="label"
          weight={600}
          color={mine ? 'onPrimary' : 'text2'}
          style={styles.tabular}
        >
          {started
            ? `${formatDuration(position)} / ${formatDuration(total)}`
            : formatDuration(total)}
        </AppText>
      </View>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minWidth: 220,
    paddingVertical: Spacing.sm,
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.lg,
    borderRadius: 24,
    borderCurve: 'continuous',
  },
  mine: {
    backgroundColor: Colors.primaryFill,
  },
  theirs: {
    backgroundColor: Colors.surface,
  },
  play: {
    width: Sizes.tapTarget,
    height: Sizes.tapTarget,
    borderRadius: Sizes.tapTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playMine: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  playTheirs: {
    backgroundColor: Colors.primaryTint,
  },
  dim: {
    opacity: 0.6,
  },
  middle: {
    flex: 1,
    gap: Spacing.xs,
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  trackMine: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  trackTheirs: {
    backgroundColor: Colors.fill,
  },
  fill: {
    height: 4,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
}));
