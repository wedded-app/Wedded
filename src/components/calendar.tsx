import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Spacing, Timing, useColors } from '@/constants/theme';
import { toDateString } from '@/features/inquiry/inquiry-helpers';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { iosEasing } from '@/lib/motion';

export type CalendarProps = {
  /** The picked day, yyyy-mm-dd. */
  value: string | null;
  onChange: (date: string) => void;
  /** Days that already have something on them, with what's on (a dot under the day). */
  marks?: Record<string, string[]>;
  /** The month to open on when there's no picked day yet, yyyy-mm-dd. */
  near?: string | null;
  /** The earliest day that can be picked (today by default). */
  min?: string;
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** The first day of the month that `date` is in, as a { year, month } pair (month 0-11). */
function monthOf(date: string): { year: number; month: number } {
  const [year, month] = date.split('-').map(Number);
  return { year, month: month - 1 };
}

/** The month's days as weeks of seven, padded with nulls before the 1st and after the last. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: first }, () => null);
  for (let day = 1; day <= count; day++) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const monthName = (year: number, month: number) =>
  new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

const spokenDay = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * A month of days to tap, the same on iPhone, Android and the web: the
 * month and two arrows at the top, then the weeks. The picked day is filled
 * ink, today is in maroon, and a day that already has an event on it has a
 * small dot, so the family sees their other days while they pick. Days
 * before `min` are greyed out. Every day is a 44-point target.
 */
export function Calendar({ value, onChange, marks = {}, near, min }: CalendarProps) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const today = toDateString(new Date());
  const earliest = min ?? today;
  const [shown, setShown] = useState(() => monthOf(value ?? near ?? today));
  const [moved, setMoved] = useState(false);
  const weeks = monthGrid(shown.year, shown.month);
  const atStart =
    shown.year < monthOf(earliest).year ||
    (shown.year === monthOf(earliest).year && shown.month <= monthOf(earliest).month);

  const step = (by: number) => {
    selectionHaptic();
    setMoved(true);
    setShown(({ year, month }) => {
      const next = new Date(year, month + by, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  return (
    <View style={styles.calendar}>
      <View style={styles.head}>
        <AppText variant="heading" weight={600} accessibilityRole="header" style={styles.grow}>
          {monthName(shown.year, shown.month)}
        </AppText>
        <Arrow
          icon="chevron-back"
          label={t('common.previousMonth')}
          disabled={atStart}
          onPress={() => step(-1)}
        />
        <Arrow icon="chevron-forward" label={t('common.nextMonth')} onPress={() => step(1)} />
      </View>

      <View style={styles.week} accessibilityElementsHidden importantForAccessibility="no">
        {WEEKDAYS.map((day, index) => (
          <AppText
            key={index}
            variant="caption"
            weight={600}
            color="text2"
            style={styles.weekday}
            maxFontSizeMultiplier={1.3}
          >
            {day}
          </AppText>
        ))}
      </View>

      <Animated.View
        key={`${shown.year}-${shown.month}`}
        entering={
          moved && !reduceMotion ? FadeIn.duration(Timing.quick).easing(iosEasing) : undefined
        }
        style={styles.weeks}
      >
        {weeks.map((week, row) => (
          <View key={row} style={styles.week}>
            {week.map((date, col) => {
              if (!date) return <View key={col} style={styles.cell} />;
              const picked = date === value;
              const past = date < earliest;
              const on = marks[date] ?? [];
              const isToday = date === today;
              return (
                <Pressable
                  key={col}
                  accessibilityRole="button"
                  accessibilityLabel={[spokenDay(date), ...on].join(', ')}
                  accessibilityState={{ selected: picked, disabled: past }}
                  disabled={past}
                  onPress={() => {
                    selectionHaptic();
                    onChange(date);
                  }}
                  style={styles.cell}
                >
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.day,
                        picked && { backgroundColor: Colors.primaryFill },
                        !picked && pressed && { backgroundColor: Colors.rowPressed },
                      ]}
                    >
                      <AppText
                        weight={picked || isToday ? 700 : 500}
                        color={
                          picked
                            ? 'onPrimary'
                            : past
                              ? 'textDisabled'
                              : isToday
                                ? 'primary'
                                : 'text'
                        }
                        maxFontSizeMultiplier={1.3}
                        style={styles.number}
                      >
                        {String(Number(date.slice(8)))}
                      </AppText>
                      {on.length > 0 && (
                        <View
                          style={[
                            styles.dot,
                            { backgroundColor: picked ? Colors.onPrimary : Colors.primary },
                          ]}
                        />
                      )}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

function Arrow({
  icon,
  label,
  disabled = false,
  onPress,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      pressedScale={0.9}
      hitSlop={4}
      onPress={onPress}
      style={[styles.arrow, disabled && styles.off]}
    >
      <Icon name={icon} size={20} color={Colors.text} weight="semibold" />
    </PressableScale>
  );
}

const DAY = 42;

const useStyles = makeStyles((Colors) => ({
  calendar: {
    gap: Spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  grow: {
    flex: 1,
  },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  off: {
    opacity: 0.35,
  },
  weeks: {
    gap: 2,
  },
  week: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
  },
  cell: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    width: DAY,
    height: DAY,
    borderRadius: DAY / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    fontVariant: ['tabular-nums'],
  },
  dot: {
    position: 'absolute',
    bottom: 5,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
}));
