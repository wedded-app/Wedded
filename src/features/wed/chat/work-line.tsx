import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText, useFontScale, useTypeStyle } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, Sizes, Spacing, useColors, useTextScale } from '@/constants/theme';
import { Motion } from '@/lib/motion';

import { ShimmerText } from '../shimmer-text';
import { StepList } from '../step-list';
import { useWed } from '../wed-store';
import { WedMark } from '../wed-mark';

import { SourceCard } from './source-card';

const MARK = 18;
const MARK_HEIGHT = Math.round(MARK / (509 / 430));
// The source card and the steps line up with the words, past the mark
export const WORK_INDENT = MARK + Spacing.sm;

/**
 * Wed at work, in the thread. While a task runs: the mark and the current
 * step in words with a band of light sweeping across them ("Finding dhol
 * players' Instagram pages near Yuba City"), the one thing in Wed that
 * moves, and under it the live source card. Once done it settles into one
 * grey line ("Worked 1 min · checked 14 pages") that opens the steps,
 * each with what it found.
 */
export function WorkLine({ taskId }: { taskId: string }) {
  const Colors = useColors();
  const styles = useStyles();
  const scale = Math.min(useFontScale('body'), 1.4);
  const lineBox = useFirstLine();
  const task = useWed((s) => s.tasks.find((t) => t.id === taskId));
  const [open, setOpen] = useState(false);
  if (!task) return null;
  // The mark sits level with the first line when the words wrap
  const markSlot = { height: lineBox, justifyContent: 'center' as const };

  if (task.state === 'running') {
    const label = task.plan[task.now]?.label ?? task.short;
    return (
      <View style={styles.block}>
        <View
          style={styles.line}
          accessible
          accessibilityLabel={`Wed is working: ${label}`}
          accessibilityLiveRegion="polite"
        >
          <View style={markSlot}>
            <WedMark size={MARK} />
          </View>
          <View style={styles.grow}>
            <ShimmerText text={label} active />
          </View>
        </View>
        {task.sources.length > 0 ? (
          <View style={styles.indent}>
            <SourceCard key={task.now} sources={task.sources} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <Animated.View layout={Motion.layout} style={styles.block}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${task.summary ?? task.title}. ${open ? 'Hide' : 'Show'} the steps`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((was) => !was)}
        // At least 48 tall, with one line of words in the middle of it
        style={({ pressed }) => [
          styles.line,
          styles.tap,
          { paddingVertical: Math.max(0, (Sizes.tapTarget - lineBox) / 2) },
          pressed && styles.pressed,
        ]}
      >
        <View style={markSlot}>
          <WedMark size={MARK} color="text2" />
        </View>
        <AppText color="text2" style={styles.shrink}>
          {task.summary ?? task.title}
        </AppText>
        <View style={markSlot}>
          <Icon
            name={open ? 'chevron-up' : 'chevron-down'}
            size={Math.round(15 * scale)}
            color={Colors.chevron}
            weight="semibold"
          />
        </View>
      </Pressable>
      {open ? (
        <Animated.View entering={Motion.enter} style={[styles.indent, styles.steps]}>
          <StepList steps={task.steps} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

// The height of one line of body text, as drawn (the app's and the phone's text size)
function useFirstLine() {
  const { lineHeight } = useTypeStyle({ variant: 'body' });
  return Math.max(MARK_HEIGHT, (lineHeight * useFontScale('body')) / useTextScale());
}

const useStyles = makeStyles(() => ({
  block: {
    gap: Spacing.sm,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  tap: {
    alignSelf: 'flex-start',
    paddingRight: Spacing.sm,
  },
  indent: {
    marginLeft: WORK_INDENT,
  },
  steps: {
    paddingBottom: Spacing.xs,
  },
  grow: {
    flex: 1,
  },
  shrink: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.55,
  },
}));
