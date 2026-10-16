import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, Spacing, useColors } from '@/constants/theme';
import { Motion } from '@/lib/motion';

export type Step = {
  label: string;
  /** done, happening now, or still to come. Ignored while `live` plays. */
  state?: 'done' | 'now' | 'next';
  time?: string;
  /** Where it looked or what it found, under the step: "Wedded: 3 near Yuba City". */
  source?: string;
};

/**
 * What Wed did, step by step, in plain words: "Reading your plan",
 * "Searching Wedded for dhol players", each with what it found under it.
 * The step happening now has a still maroon dot (nothing spins; the working
 * line above it is what moves). With `live` the steps tick through one after
 * another.
 */
export function StepList({
  steps,
  live = false,
  onDone,
}: {
  steps: Step[];
  live?: boolean;
  onDone?: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const [reached, setReached] = useState(live ? 0 : steps.length);
  const [finished, setFinished] = useState(!live);

  // One step every 850 ms, then onDone once, a moment after the last lands
  useEffect(() => {
    if (finished) return;
    const last = reached >= steps.length;
    const timer = setTimeout(
      () => {
        if (!last) return setReached((n) => n + 1);
        setFinished(true);
        onDone?.();
      },
      last ? 300 : 850,
    );
    return () => clearTimeout(timer);
  }, [finished, reached, steps.length, onDone]);

  return (
    <View style={styles.list}>
      {steps.map((step, index) => {
        if (live && index > reached) return null;
        const state = live ? (index < reached ? 'done' : 'now') : (step.state ?? 'done');
        return (
          <Animated.View key={`${index}-${step.label}`} entering={Motion.enter} style={styles.row}>
            <View style={styles.mark}>
              {state === 'done' ? (
                <Icon name="checkmark-circle" size={22} color={Colors.success} />
              ) : state === 'now' ? (
                <View style={styles.dot} />
              ) : (
                <Icon name="ellipse-outline" size={22} color={Colors.chevron} />
              )}
            </View>
            <View style={styles.grow}>
              <AppText color={state === 'next' ? 'text2' : 'text'}>{step.label}</AppText>
              {step.source ? (
                <AppText variant="label" weight={400} color="text2">
                  {step.source}
                </AppText>
              ) : null}
              {step.time ? (
                <AppText variant="caption" color="text2">
                  {step.time}
                </AppText>
              ) : null}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  list: {
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  mark: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  grow: {
    flex: 1,
    gap: 2,
  },
}));
