import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

import { AppText, useFontScale } from '@/components/app-text';
import { eventIcon } from '@/components/event-icon';
import { Icon } from '@/components/icon';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import type { EventNeedsSection, TraditionEvent } from '@/data/reference';
import { stubParts } from '@/features/home/greeting';
import type { Translate } from '@/features/vendors/profile-format';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

import { essentialNeeds } from './plan';
import { bookedNames, bookedText, stillNeedsText, unbookedNames } from './still-needs';

const STUB = 78;
const NOTCH = 20;

/** One event on a day's ticket, in words. */
export type TicketEntry = {
  slug: string;
  name: string;
  /** When and where, as far as the family has said, or when it usually happens. */
  when: string | null;
  /** What it still needs, in words ("To book: DJ, cake"), or All set. */
  stillNeeds: string;
  complete: boolean;
  /** Who's booked, in words, when anyone is. */
  booked: string | null;
  /** How many are coming, from the RSVPs, when anyone's invited. */
  coming: string | null;
};

/** An event's line on its ticket, from the plan. */
export function ticketEntry(
  event: TraditionEvent,
  {
    sections,
    booked,
    bookedVendors,
    dated,
    when,
    coming,
  }: {
    sections: EventNeedsSection[];
    booked: string[];
    bookedVendors: Record<string, { slug: string; name: string }>;
    /** Whether it has a day yet; until it does, when it usually happens shows. */
    dated: boolean;
    when: string | null;
    coming: string | null;
  },
  t: Translate,
): TicketEntry {
  const essential = essentialNeeds(sections);
  const extras = sections.filter((s) => s.importance !== 'essential').flatMap((s) => s.needs);
  const complete =
    essential.length > 0 && essential.every((need) => booked.includes(need.categorySlug));
  return {
    slug: event.slug,
    name: localized(event.name),
    when: when ?? (!dated && event.timing ? localized(event.timing) : null),
    // In words, not "0/6" (the final look, 2026-10-23)
    stillNeeds: stillNeedsText(unbookedNames(essential, booked), t),
    complete,
    booked: bookedText(
      bookedNames(
        [...essential, ...extras],
        booked,
        (category) => bookedVendors[`${event.slug}/${category}`]?.name ?? null,
      ),
      t,
    ),
    coming,
  };
}

/**
 * One day of the wedding as a ticket (the final look, 2026-10-23, now a day
 * at a time): the day on a stub, a dashed perforation with notches cut top
 * and bottom, and the events on that day beside it, one under the other
 * when two share it (a Nikah and Walima together). Each event says what it
 * still needs in words, who's booked and how many are coming, and a tap
 * opens its own page. Before a day is picked, the stub shows the event's
 * icon.
 */
export function DayTicket({ date, entries }: { date: string | null; entries: TicketEntry[] }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  // The stub widens a little with large text so the day still fits
  const stubWidth = Math.round(STUB * Math.min(useFontScale('caption'), 1.3));
  const stub = stubParts(date);

  return (
    <Animated.View entering={Motion.enter} layout={Motion.layout} style={styles.ticket}>
      <View
        style={[styles.stub, { width: stubWidth }]}
        accessible
        accessibilityLabel={
          stub ? `${stub.weekday} ${stub.month} ${stub.day}` : t('planner.days.pick')
        }
      >
        {stub ? (
          <>
            <AppText variant="caption" weight={600} color="primary" style={styles.caps}>
              {stub.month}
            </AppText>
            <AppText weight={700} style={styles.day} maxFontSizeMultiplier={1.3}>
              {stub.day}
            </AppText>
            <AppText variant="caption" weight={600} color="text2" style={styles.caps}>
              {stub.weekday}
            </AppText>
          </>
        ) : (
          <Icon name={eventIcon(entries[0]?.slug ?? '')} size={28} color={Colors.primary} />
        )}
      </View>
      {/* Drawn over the ticket's height, so it never sets the height itself */}
      <View style={styles.perforation}>
        <Svg width={2} height="100%" style={StyleSheet.absoluteFill}>
          <Line
            x1={1}
            y1={10}
            x2={1}
            y2="100%"
            stroke={Colors.separator}
            strokeWidth={2}
            strokeDasharray="5 5"
          />
        </Svg>
      </View>
      <View style={styles.body}>
        {entries.map((entry, index) => (
          <Pressable
            key={entry.slug}
            accessibilityRole="link"
            accessibilityLabel={[
              entry.name,
              entry.when,
              entry.stillNeeds,
              entry.booked,
              entry.coming,
            ]
              .filter(Boolean)
              .join(', ')}
            onPress={() => {
              selectionHaptic();
              router.push({ pathname: '/plan-event/[slug]', params: { slug: entry.slug } });
            }}
            style={({ pressed }) => [
              styles.entry,
              index > 0 && styles.divided,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.titleRow}>
              <AppText variant="heading" weight={600} style={styles.grow}>
                {entry.name}
              </AppText>
              <View style={styles.chevron}>
                <Icon name="chevron-forward" size={18} color={Colors.chevron} weight="semibold" />
              </View>
            </View>
            {entry.when && (
              <AppText variant="label" weight={400} color="text2">
                {entry.when}
              </AppText>
            )}
            <View style={styles.status}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: entry.complete ? Colors.success : Colors.primary },
                ]}
              />
              <AppText
                variant="label"
                weight={600}
                color={entry.complete ? 'success' : 'primary'}
                style={styles.grow}
              >
                {entry.stillNeeds}
              </AppText>
            </View>
            {entry.booked && (
              <AppText variant="label" weight={400} color="text2">
                {entry.booked}
              </AppText>
            )}
            {entry.coming && (
              <AppText variant="label" weight={400} color="text2">
                {entry.coming}
              </AppText>
            )}
          </Pressable>
        ))}
      </View>
      <View style={[styles.notch, styles.notchTop, { left: stubWidth - NOTCH / 2 }]} />
      <View style={[styles.notch, styles.notchBottom, { left: stubWidth - NOTCH / 2 }]} />
    </Animated.View>
  );
}

const useStyles = makeStyles((Colors) => ({
  ticket: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  stub: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: Spacing.lg,
  },
  caps: {
    letterSpacing: 0.6,
  },
  day: {
    fontSize: 34,
    lineHeight: 38,
  },
  perforation: {
    width: 2,
    marginVertical: Spacing.sm,
  },
  body: {
    flex: 1,
  },
  entry: {
    gap: Spacing.xs,
    paddingVertical: Spacing.lg,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.md,
  },
  divided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
  },
  pressed: {
    backgroundColor: Colors.rowPressed,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  chevron: {
    marginTop: 3,
  },
  grow: {
    flex: 1,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 7,
  },
  // Cut out of the ticket in the page's colour, where the perforation meets the edges
  notch: {
    position: 'absolute',
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
    backgroundColor: Colors.bg,
  },
  notchTop: {
    top: -NOTCH / 2,
  },
  notchBottom: {
    bottom: -NOTCH / 2,
  },
}));
