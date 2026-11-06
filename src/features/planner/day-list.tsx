import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, useFontScale } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Spacing, useColors } from '@/constants/theme';
import { stubParts } from '@/features/home/greeting';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

import { DaySheet } from './day-sheet';
import { dayGroups, groupOf, joinDay, setDay, splitDay, type DaysState } from './days';

export type DayListEvent = {
  slug: string;
  name: string;
  /** When it usually happens ("The night before the wedding"), shown until it has a day. */
  timing: string | null;
};

/** "Friday, June 11, 2027". */
export function longDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * The wedding's events down the page, each with its day: a date stub on
 * the left (month over day) and the event beside it. Tapping an event opens
 * the calendar for its day. Between two events sits a small link: tap it
 * and they're on the same day (one stub, a line down to the second), tap
 * it again to give the second its own day. Used by "When is each one?" and
 * by Your days on the Wedding tab; `onChange` gets the new days to keep.
 */
export function DayList({
  events,
  state,
  onChange,
  editable = true,
}: {
  /** The events with their own day, in ceremony order. */
  events: DayListEvent[];
  state: DaysState;
  onChange: (next: DaysState) => void;
  editable?: boolean;
}) {
  const styles = useStyles();
  const { t } = useLocale();
  const order = events.map((event) => event.slug);
  const groups = dayGroups(order, state);
  const nameOf = (slug: string) => events.find((event) => event.slug === slug)?.name ?? slug;
  const [open, setOpen] = useState<string | null>(null);
  const openGroup = open ? groupOf(groups, open) : undefined;

  // The other days, dotted on the calendar
  const marks: Record<string, string[]> = {};
  for (const group of groups) {
    if (!group.date || group === openGroup) continue;
    marks[group.date] = [...(marks[group.date] ?? []), ...group.slugs.map(nameOf)];
  }
  const sheetTitle = openGroup
    ? openGroup.slugs.length === 1
      ? t('planner.days.sheetTitle', { event: nameOf(openGroup.slugs[0]) })
      : t('planner.days.sheetTitleMany', {
          events: t('planner.days.and', {
            first: openGroup.slugs.slice(0, -1).map(nameOf).join(', '),
            last: nameOf(openGroup.slugs[openGroup.slugs.length - 1]),
          }),
        })
    : null;
  // With nothing picked yet, the calendar opens near the days around it
  const near = groups.find((group) => group.date)?.date ?? null;

  return (
    <View>
      {events.map((event, index) => {
        const group = groupOf(groups, event.slug);
        const first = group?.slugs[0] === event.slug;
        const lastOfDay = group?.slugs[group.slugs.length - 1] === event.slug;
        const date = group?.date ?? null;
        const before = index > 0 ? events[index - 1] : null;
        return (
          <View key={event.slug}>
            {before && (
              <Joint
                linked={!first}
                editable={editable}
                label={
                  first
                    ? t('planner.days.join', { event: event.name, before: before.name })
                    : t('planner.days.split', { event: event.name, before: before.name })
                }
                onPress={() => {
                  selectionHaptic();
                  if (first) onChange(joinDay(order, state, event.slug));
                  else {
                    onChange(splitDay(order, state, event.slug));
                    setOpen(event.slug);
                  }
                }}
              />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={[
                event.name,
                first
                  ? date
                    ? longDate(date)
                    : t('planner.days.pick')
                  : t('planner.days.sameDayAs', { event: nameOf(group?.slugs[0] ?? '') }),
              ].join(', ')}
              disabled={!editable}
              onPress={() => {
                selectionHaptic();
                setOpen(event.slug);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.left}>
                {first ? (
                  <Stub date={date} />
                ) : (
                  <>
                    <View style={[styles.rail, lastOfDay && styles.railEnd]} />
                    <View style={styles.node} />
                  </>
                )}
              </View>
              <View style={styles.text}>
                <AppText variant="bodyLg" weight={600}>
                  {event.name}
                </AppText>
                {first ? (
                  <AppText
                    variant="label"
                    weight={date ? 500 : 600}
                    color={date ? 'text2' : 'primary'}
                  >
                    {date ? longDate(date) : t('planner.days.pick')}
                  </AppText>
                ) : (
                  <AppText variant="label" weight={500} color="text2">
                    {t('planner.days.sameDayAs', { event: nameOf(group?.slugs[0] ?? '') })}
                  </AppText>
                )}
                {first && !date && event.timing && (
                  <AppText variant="caption" color="text2">
                    {event.timing}
                  </AppText>
                )}
              </View>
            </Pressable>
          </View>
        );
      })}

      <DaySheet
        title={sheetTitle}
        value={openGroup?.date ?? null}
        marks={marks}
        near={near}
        onPick={(date) => open && onChange(setDay(order, state, open, date))}
        onClear={() => open && onChange(setDay(order, state, open, null))}
        onClose={() => setOpen(null)}
      />
    </View>
  );
}

/** The date in a little block, month over day, like a tear-off calendar; a calendar icon before there's one. */
function Stub({ date }: { date: string | null }) {
  const Colors = useColors();
  const styles = useStyles();
  const stub = stubParts(date);
  return (
    <View style={styles.stub}>
      {stub ? (
        <>
          <AppText
            variant="caption"
            weight={700}
            color="primary"
            style={styles.caps}
            maxFontSizeMultiplier={1.2}
          >
            {stub.month}
          </AppText>
          <AppText weight={700} style={styles.day} maxFontSizeMultiplier={1.2}>
            {stub.day}
          </AppText>
        </>
      ) : (
        <Icon name="calendar-outline" size={22} color={Colors.text2} />
      )}
    </View>
  );
}

/**
 * The link between two events: an outline ring with a link in it while
 * they're on different days, filled ink once they share one. Its line
 * runs through it when they're joined.
 */
function Joint({
  linked,
  editable,
  label,
  onPress,
}: {
  linked: boolean;
  editable: boolean;
  label: string;
  onPress: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const size = Math.round(30 * Math.min(useFontScale('caption'), 1.2));
  return (
    <View style={styles.joint}>
      <View style={styles.left}>
        {linked && <View style={styles.railThrough} />}
        {editable && (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ checked: linked }}
            pressedScale={0.88}
            hitSlop={10}
            onPress={onPress}
            style={[
              styles.link,
              { width: size, height: size, borderRadius: size / 2 },
              linked ? styles.linkOn : styles.linkOff,
            ]}
          >
            <Icon
              name="link"
              size={15}
              color={linked ? Colors.onPrimary : Colors.text2}
              weight="semibold"
            />
          </PressableScale>
        )}
      </View>
      {!linked && <View style={styles.hairline} />}
    </View>
  );
}

const STUB = 52;

const useStyles = makeStyles((Colors) => ({
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  pressed: {
    opacity: 0.55,
  },
  left: {
    width: STUB,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  stub: {
    width: STUB,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  caps: {
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  day: {
    fontSize: 22,
    lineHeight: 26,
    fontVariant: ['tabular-nums'],
  },
  rail: {
    position: 'absolute',
    top: -Spacing.sm,
    bottom: -Spacing.sm,
    left: STUB / 2 - 1,
    width: 2,
    backgroundColor: Colors.primaryFill,
  },
  railEnd: {
    bottom: '50%',
  },
  node: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primaryFill,
  },
  railThrough: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: STUB / 2 - 1,
    width: 2,
    backgroundColor: Colors.primaryFill,
  },
  joint: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  hairline: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.separator,
  },
  link: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  linkOn: {
    backgroundColor: Colors.primaryFill,
    borderColor: Colors.primaryFill,
  },
  linkOff: {
    backgroundColor: Colors.bg,
    borderColor: Colors.borderInput,
  },
}));
