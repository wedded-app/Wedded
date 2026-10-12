import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';

/**
 * The message a reply quotes, shown just above the reply: who wrote it and
 * its first two lines, behind a maroon bar, on the same side as the reply.
 */
export function ReplyQuote({
  name,
  text,
  spoken,
}: {
  name: string;
  text: string;
  /** "In reply to Harjit K.: Is June 12 open?" */
  spoken: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.quote} accessible accessibilityLabel={spoken}>
      <View style={styles.bar} />
      <View style={styles.text}>
        <AppText variant="caption" weight={700} color="primary" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="caption" color="text2" numberOfLines={2}>
          {text}
        </AppText>
      </View>
    </View>
  );
}

/**
 * Above the message box while replying: "Replying to Harjit K.", the quoted
 * line, and a button to stop replying.
 */
export function ReplyBar({
  title,
  text,
  cancelLabel,
  onCancel,
}: {
  /** "Replying to Harjit K." */
  title: string;
  text: string;
  cancelLabel: string;
  onCancel: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.replyBar}>
      <View style={styles.bar} />
      <View style={styles.text} accessible accessibilityLabel={`${title}: ${text}`}>
        <AppText variant="label" weight={700} color="primary" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" color="text2" numberOfLines={1}>
          {text}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cancelLabel}
        onPress={onCancel}
        hitSlop={4}
        style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
      >
        <Icon name="close" size={22} color={Colors.text2} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  quote: {
    flexDirection: 'row',
    gap: Spacing.sm,
    maxWidth: 280,
    paddingVertical: Spacing.xs,
    paddingRight: Spacing.md,
    paddingLeft: Spacing.sm,
    marginBottom: 2,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: Colors.fill,
  },
  bar: {
    alignSelf: 'stretch',
    width: 3,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  text: {
    flexShrink: 1,
    flexGrow: 1,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingLeft: Sizes.pageGutter,
    paddingTop: Spacing.sm,
  },
  cancel: {
    width: Sizes.tapTarget,
    height: Sizes.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
}));
