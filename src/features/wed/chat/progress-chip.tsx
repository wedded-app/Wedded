import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Glass } from '@/components/glass';
import { makeStyles, Radius, Sizes, Spacing } from '@/constants/theme';
import { Motion } from '@/lib/motion';

import { useWed } from '../wed-store';

/**
 * While Wed works on something that has scrolled out of sight, a small
 * glass capsule under the header says what and how far along: "Finding
 * dhol players · 3 of 4". Still (only the working line itself shimmers);
 * a tap scrolls back to it. Pops in rather than fading, because iOS drops
 * the glass on a view that fades from transparent.
 */
export function ProgressChip({
  taskId,
  top,
  onPress,
}: {
  taskId: string;
  top: number;
  onPress: () => void;
}) {
  const styles = useStyles();
  const task = useWed((s) => s.tasks.find((t) => t.id === taskId));
  if (!task || task.state !== 'running') return null;
  const words = `${task.title} · ${task.now + 1} of ${task.steps.length}`;

  return (
    <View style={[styles.wrap, { top }]}>
      <Animated.View entering={Motion.popIn} exiting={Motion.popOut} style={styles.limit}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={words}
          accessibilityHint="Scrolls to what Wed is doing"
          onPress={onPress}
          hitSlop={4}
          style={styles.limit}
        >
          {({ pressed }) => (
            <Glass interactive style={[styles.chip, pressed && styles.pressed]}>
              <AppText weight={600} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                {words}
              </AppText>
            </Glass>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: {
    position: 'absolute',
    left: Sizes.pageGutter,
    right: Sizes.pageGutter,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  // Each layer stays within the screen, so a long title ends in "…"
  limit: {
    maxWidth: '100%',
  },
  chip: {
    minHeight: 40,
    maxWidth: '100%',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.chip,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
}));
