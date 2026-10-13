import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { makeStyles, Radius, Spacing } from '@/constants/theme';
import type { ReactionCode, ReactionSummary } from '@/features/chat/reactions';
import { useLocale } from '@/i18n/locale-context';

/**
 * The reactions under a message: each emoji once, with how many when more
 * than one person picked it. Yours is tinted; tapping any chip picks that
 * reaction, and tapping yours takes it back.
 */
export function ReactionChips({
  reactions,
  mine,
  onToggle,
}: {
  reactions: ReactionSummary[];
  /** Under my own bubble: line up on the right. */
  mine: boolean;
  onToggle: (reaction: ReactionCode) => void;
}) {
  const styles = useStyles();
  const { t } = useLocale();
  if (reactions.length === 0) return null;
  return (
    <View style={[styles.row, mine && styles.right]}>
      {reactions.map((r) => (
        <Pressable
          key={r.code}
          accessibilityRole="button"
          accessibilityLabel={t('chat.react.chip', {
            name: t(`chat.react.names.${r.code}`),
            count: r.count,
          })}
          accessibilityHint={r.mine ? t('chat.react.takeBack') : undefined}
          accessibilityState={{ selected: r.mine }}
          onPress={() => onToggle(r.code)}
          // Slim to sit under the bubble; the touch area is 48 tall
          hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
          style={({ pressed }) => [
            styles.chip,
            r.mine && styles.chipMine,
            pressed && styles.pressed,
          ]}
        >
          <AppText style={styles.emoji}>{r.emoji}</AppText>
          {r.count > 1 && (
            <AppText variant="caption" weight={600} color={r.mine ? 'primary' : 'text2'}>
              {r.count}
            </AppText>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: -Spacing.xs,
  },
  right: {
    justifyContent: 'flex-end',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 28,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.chip,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipMine: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryTint,
  },
  pressed: {
    opacity: 0.6,
  },
  emoji: {
    fontSize: 15,
    lineHeight: 20,
  },
}));
