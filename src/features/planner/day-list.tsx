import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';

import { AppText, useFontScale } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { stubParts } from '@/features/home/greeting';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

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

/** "Sat". */
function weekday(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'short' });
}

/**
 * The wedding's days, one card each, in ceremony order: a little calendar
 * leaf on the left (month over day) and the day's events stacked beside
 * it, so two events on one day plainly share a card. Tapping an event opens
 * the calendar for its day. An event without a day, after one that has
 * one, offers a single tap under its card, "Same day as the Anand Karaj",
 * which slides it into that day; the × beside a joined event gives it a
 * day of its own again. Used by
 * "When is each one?" and by Your days on the Wedding tab; `onChange` gets
 * the new days to keep.
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
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const order = events.map((event) => event.slug);
  const groups = dayGroups(order, state);
  const nameOf = (slug: string) => events.find((event) => event.slug === slug)?.name ?? slug;
  const timingOf = (slug: string) => events.find((event) => event.slug === slug)?.timing ?? null;
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
    <View style={styles.days}>
      {/* Only what changes animates, never the list arriving */}
      <LayoutAnimationConfig skipEntering>
        {groups.map((group, index) => {
          const before = index > 0 ? groups[index - 1] : null;
          const lead = group.slugs[0];
          // "Same day as" offers the day before only once that day has a date
          const previous = before?.date ? nameOf(before.slugs[before.slugs.length - 1]) : null;
          return (
            <Animated.View
              key={lead}
              entering={Motion.rise}
              layout={Motion.layout}
              style={styles.group}
            >
              <View style={styles.card}>
                <Leaf date={group.date} />
                <View style={styles.events}>
                  {group.slugs.map((slug, row) => {
                    const joined = row > 0;
                    const timing = !joined && !group.date ? timingOf(slug) : null;
                    return (
                      <Animated.View
                        key={slug}
                        entering={joined ? Motion.rise : undefined}
                        style={[styles.eventRow, joined && styles.divided]}
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={[
                            nameOf(slug),
                            group.date ? longDate(group.date) : t('planner.days.pick'),
                          ].join(', ')}
                          disabled={!editable}
                          onPress={() => {
                            selectionHaptic();
                            setOpen(slug);
                          }}
                          style={({ pressed }) => [styles.event, pressed && styles.pressed]}
                        >
                          <View style={styles.grow}>
                            <AppText variant="bodyLg" weight={600}>
                              {nameOf(slug)}
                            </AppText>
                            {timing && (
                              <AppText variant="caption" color="text2">
                                {timing}
                              </AppText>
                            )}
                          </View>
                          {!joined &&
                            (group.date ? (
                              <AppText variant="label" weight={500} color="text2">
                                {weekday(group.date)}
                              </AppText>
                            ) : (
                              <AppText variant="label" weight={600} color="primary">
                                {t('planner.days.pick')}
                              </AppText>
                            ))}
                        </Pressable>
                        {joined && editable && (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('planner.days.ownDay', { event: nameOf(slug) })}
                            hitSlop={10}
                            onPress={() => {
                              selectionHaptic();
                              onChange(splitDay(order, state, slug));
                              setOpen(slug);
                            }}
                            style={({ pressed }) => [styles.unlink, pressed && styles.pressed]}
                          >
                            <Icon name="close" size={14} color={Colors.text2} weight="bold" />
                          </Pressable>
                        )}
                      </Animated.View>
                    );
                  })}
                </View>
              </View>
              {editable && !group.date && previous && (
                <Animated.View entering={Motion.enter}>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={t('planner.days.join', {
                      event: nameOf(lead),
                      before: previous,
                    })}
                    pressedScale={0.96}
                    onPress={() => {
                      selectionHaptic();
                      onChange(joinDay(order, state, lead));
                    }}
                    style={styles.same}
                  >
                    <Icon name="link" size={17} color={Colors.text} weight="semibold" />
                    <AppText variant="label" weight={600}>
                      {t('planner.days.sameDayAs', { event: previous })}
                    </AppText>
                  </PressableScale>
                </Animated.View>
              )}
            </Animated.View>
          );
        })}
      </LayoutAnimationConfig>

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

/**
 * A day's date on a little white calendar leaf, month over day; a dashed
 * leaf with a plus before there's one.
 */
function Leaf({ date }: { date: string | null }) {
  const Colors = useColors();
  const styles = useStyles();
  const scale = Math.min(useFontScale('caption'), 1.3);
  const stub = stubParts(date);
  const size = Math.round(LEAF * scale);
  return (
    <View
      style={[
        styles.leaf,
        { width: size, minHeight: size },
        stub ? styles.leafDay : styles.leafEmpty,
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {stub ? (
        <>
          <AppText
            variant="caption"
            weight={700}
            color="primary"
            style={styles.month}
            maxFontSizeMultiplier={1.3}
          >
            {stub.month}
          </AppText>
          <AppText weight={700} style={styles.day} maxFontSizeMultiplier={1.3}>
            {stub.day}
          </AppText>
        </>
      ) : (
        <Icon name="add" size={20} color={Colors.text2} weight="semibold" />
      )}
    </View>
  );
}

const LEAF = 46;

const useStyles = makeStyles((Colors) => ({
  days: {
    gap: Spacing.sm,
  },
  group: {
    gap: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.md,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  leaf: {
    marginTop: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  leafDay: {
    backgroundColor: Colors.canvas,
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
  },
  leafEmpty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.borderInput,
  },
  month: {
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0.6,
  },
  day: {
    fontSize: 19,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
  events: {
    flex: 1,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  divided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
  },
  event: {
    flex: 1,
    minHeight: Sizes.tapTarget + 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  grow: {
    flex: 1,
    gap: 1,
  },
  pressed: {
    opacity: 0.55,
  },
  unlink: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.separator,
  },
  same: {
    alignSelf: 'flex-start',
    minHeight: Sizes.tapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginLeft: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Sizes.tapTarget / 2,
    borderWidth: 1.5,
    borderColor: Colors.text,
    backgroundColor: Colors.canvas,
  },
}));
