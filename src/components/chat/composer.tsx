import type { Ref } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { useFontScale } from '@/components/app-text';
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
import { useLocale } from '@/i18n/locale-context';

/**
 * The bar at the bottom of a thread: a photo button, a message box that grows
 * to five lines, and a big Send button that only lights up when there's
 * something to send. Quick replies sit above it as chips (tap one to send it).
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
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { locale, t } = useLocale();
  const scale = Math.min(useFontScale('bodyLg'), 1.6);
  const canSend = value.trim().length > 0 && !sending;
  const size = Typography.bodyLg.size * scale;

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
            fontStyle(locale, 400),
            { fontSize: size, lineHeight: size * 1.3, maxHeight: size * 1.3 * 5 + Spacing.md * 2 },
          ]}
        />
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
