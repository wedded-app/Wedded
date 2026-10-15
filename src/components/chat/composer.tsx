import type { Ref } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';

import { AppText, useFontScale } from '@/components/app-text';
import { Chip } from '@/components/chip';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import {
  fontStyle,
  makeStyles,
  Radius,
  Sizes,
  Spacing,
  Typography,
  useColors,
} from '@/constants/theme';
import type { VoiceMode } from '@/features/chat/use-voice-recorder';
import { formatDuration } from '@/features/chat/voice';
import { useLocale } from '@/i18n/locale-context';

/** The microphone's state and actions, from useVoiceRecorder(). */
export type ComposerVoice = {
  mode: VoiceMode;
  elapsedMs: number;
  onHold: () => void;
  onRelease: () => void;
  onTap: () => void;
  onCancel: () => void;
  onSend: () => void;
};

/**
 * The bar at the bottom of a thread: a photo button, a message box that grows
 * to five lines, and a big Send button that only lights up when there's
 * something to send. Quick replies sit above it as chips (tap one to send it).
 * With `voice`, an empty box shows a microphone instead of Send: hold it to
 * record and let go to send, or tap it to record hands-free with Cancel and
 * Send. While a hold records, the microphone stays where the finger is.
 */
export function Composer({
  value,
  onChangeText,
  onBlur,
  inputRef,
  onSend,
  onAddPhoto,
  sending = false,
  quickReplies,
  onQuickReply,
  voice,
}: {
  value: string;
  onChangeText: (text: string) => void;
  /** The message box lost focus (e.g. to stop "typing…"). */
  onBlur?: () => void;
  /** To focus the box, e.g. after choosing a message to reply to. */
  inputRef?: Ref<TextInput>;
  onSend: () => void;
  /** Leave out to hide the photo button. */
  onAddPhoto?: () => void;
  sending?: boolean;
  quickReplies?: string[];
  onQuickReply?: (text: string) => void;
  /** Leave out to hide the microphone. */
  voice?: ComposerVoice;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const scale = Math.min(useFontScale('bodyLg'), 1.6);
  const canSend = value.trim().length > 0 && !sending;
  const size = Typography.bodyLg.size * scale;
  const mode = voice?.mode ?? 'idle';
  const showMic = !!voice && (mode === 'held' || (mode === 'idle' && value.trim().length === 0));

  // Recording hands-free, or sending: the bar is all about the voice note
  if (voice && (mode === 'locked' || mode === 'sending')) {
    return (
      <View style={styles.wrap}>
        <View style={[styles.bar, styles.center]}>
          {mode === 'locked' ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('chat.voice.cancel')}
              onPress={voice.onCancel}
              pressedScale={0.9}
              style={styles.round}
            >
              <Icon name="trash-outline" size={Sizes.icon} color={Colors.error} />
            </PressableScale>
          ) : (
            <View style={styles.round}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          )}
          <Recording elapsedMs={voice.elapsedMs} sending={mode === 'sending'} />
          {mode === 'locked' && (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('chat.voice.send')}
              onPress={voice.onSend}
              pressedScale={0.9}
              style={[styles.round, styles.sendOn]}
            >
              <Icon name="arrow-up" size={Sizes.icon} color={Colors.onPrimary} weight="bold" />
            </PressableScale>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {quickReplies && quickReplies.length > 0 && onQuickReply && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.replies}
        >
          {quickReplies.map((reply) => (
            <Chip key={reply} role="button" label={reply} onPress={() => onQuickReply(reply)} />
          ))}
        </ScrollView>
      )}
      <View style={styles.bar}>
        {mode === 'held' ? (
          <Recording elapsedMs={voice?.elapsedMs ?? 0} held />
        ) : (
          <>
            {onAddPhoto && (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('chat.addPhoto')}
                onPress={onAddPhoto}
                pressedScale={0.9}
                style={styles.round}
              >
                <Icon name="camera-outline" size={Sizes.icon} color={Colors.primary} />
              </PressableScale>
            )}
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={onChangeText}
              onBlur={onBlur}
              placeholder={t('chat.placeholder')}
              placeholderTextColor={Colors.text2}
              accessibilityLabel={t('chat.placeholder')}
              multiline
              maxLength={2000}
              style={[
                styles.input,
                fontStyle(400),
                {
                  fontSize: size,
                  lineHeight: size * 1.3,
                  maxHeight: size * 1.3 * 5 + Spacing.md * 2,
                },
              ]}
            />
          </>
        )}
        {showMic && voice ? (
          <Pressable
            key="mic"
            accessibilityRole="button"
            accessibilityLabel={t('chat.voice.record')}
            accessibilityHint={t('chat.voice.recordHint')}
            onPress={voice.onTap}
            onLongPress={voice.onHold}
            delayLongPress={250}
            onPressOut={voice.onRelease}
            style={({ pressed }) => [
              styles.round,
              styles.mic,
              (pressed || mode === 'held') && styles.micHeld,
            ]}
          >
            <Icon name="mic" size={Sizes.icon} color={Colors.onPrimary} />
          </Pressable>
        ) : (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('chat.send')}
            accessibilityState={{ disabled: !canSend, busy: sending }}
            disabled={!canSend}
            onPress={onSend}
            pressedScale={0.9}
            style={[styles.round, canSend ? styles.sendOn : styles.sendOff]}
          >
            <Icon
              name="arrow-up"
              size={Sizes.icon}
              color={canSend ? Colors.onPrimary : Colors.textDisabled}
              weight="bold"
            />
          </PressableScale>
        )}
      </View>
    </View>
  );
}

/** "Recording 0:07", with what to do next. */
function Recording({
  elapsedMs,
  held = false,
  sending = false,
}: {
  elapsedMs: number;
  held?: boolean;
  sending?: boolean;
}) {
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <View
      style={styles.recording}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={
        sending
          ? t('chat.voice.sending')
          : t('chat.voice.recording', { time: formatDuration(elapsedMs) })
      }
    >
      {!sending && <View style={styles.dot} />}
      <View style={styles.recordingText}>
        <AppText variant="bodyLg" weight={700} style={styles.tabular}>
          {sending
            ? t('chat.voice.sending')
            : t('chat.voice.recording', { time: formatDuration(elapsedMs) })}
        </AppText>
        {!sending && (
          <AppText variant="label" weight={400} color="text2">
            {held ? t('chat.voice.letGo') : t('chat.voice.tapSend')}
          </AppText>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  wrap: {
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  replies: {
    gap: Spacing.sm,
    paddingHorizontal: Sizes.pageGutter,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Sizes.pageGutter,
  },
  round: {
    width: Sizes.tapTarget,
    height: Sizes.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.circle,
    backgroundColor: Colors.primaryTint,
  },
  sendOn: {
    backgroundColor: Colors.primaryFill,
  },
  sendOff: {
    backgroundColor: Colors.fill,
  },
  center: {
    alignItems: 'center',
  },
  mic: {
    backgroundColor: Colors.primaryFill,
  },
  micHeld: {
    transform: [{ scale: 1.15 }],
    backgroundColor: Colors.errorFill,
  },
  recording: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: Sizes.tapTarget,
    paddingHorizontal: Spacing.lg,
    borderRadius: 24,
    backgroundColor: Colors.surface,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.error,
  },
  recordingText: {
    flex: 1,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  input: {
    flex: 1,
    minHeight: Sizes.tapTarget,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    color: Colors.text,
    boxShadow: `inset 0 0 0 1px ${Colors.border}`,
  },
}));
