import { Modal, Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { makeStyles, Radius, Sizes, Spacing } from '@/constants/theme';
import { REACTIONS, type ReactionCode } from '@/features/chat/reactions';
import { useLocale } from '@/i18n/locale-context';

/**
 * The six reactions, over a dimmed screen, after holding a message (C5c).
 * Yours is ringed; picking it again takes it back. Tapping outside closes.
 */
export function ReactionPicker({
  visible,
  current,
  onPick,
  onClose,
}: {
  visible: boolean;
  current: ReactionCode | null;
  onPick: (reaction: ReactionCode) => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('chat.react.close')}
      >
        <View style={styles.bar} accessibilityRole="radiogroup">
          {REACTIONS.map((r) => (
            <Pressable
              key={r.code}
              accessibilityRole="radio"
              accessibilityLabel={t(`chat.react.names.${r.code}`)}
              accessibilityState={{ selected: current === r.code }}
              onPress={() => onPick(r.code)}
              style={({ pressed }) => [
                styles.option,
                current === r.code && styles.chosen,
                pressed && styles.pressed,
              ]}
            >
              <AppText style={styles.emoji}>{r.emoji}</AppText>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((Colors) => ({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.scrim,
  },
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: Radius.circle,
    backgroundColor: Colors.surface,
  },
  option: {
    width: Sizes.tapTarget + 4,
    height: Sizes.tapTarget + 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.circle,
  },
  chosen: {
    backgroundColor: Colors.primaryTint,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  pressed: {
    opacity: 0.6,
  },
  emoji: {
    fontSize: 30,
    lineHeight: 38,
  },
}));
