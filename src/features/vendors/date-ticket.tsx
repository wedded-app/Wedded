import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Sizes, Spacing, Timing, useColors } from '@/constants/theme';
import { useVendorDateStatus, type DateStatus } from '@/data/availability';
import type { VendorProfile } from '@/data/vendors';
import { stubParts } from '@/features/home/greeting';
import { likelyEvent } from '@/features/inquiry/ask-plan';
import { toDateString } from '@/features/inquiry/inquiry-helpers';
import { useFamilyPlan } from '@/features/planner/use-family-plan';
import { openWed } from '@/features/wed/open-wed';
import { WedMark } from '@/features/wed/wed-mark';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

import { wedLine } from './wed-line';

const STUB = 82;
const NOTCH = 20;

type Day = { slug: string; name: string; date: string };

/**
 * Under a vendor's name, what it means for the family (Fezy's mockup,
 * 2026-11-11): the date ticket, their likely event's day with whether the
 * vendor is free (from the calendar vendors keep; nothing promised when
 * there's no recent calendar), which opens to all their event days, each
 * with a green or red dot, to check another; and one line Wed writes, with
 * its bow, from the vendor's facts and their plan, opening Wed about this
 * vendor. No plan: just Wed's line, when there's something to say.
 */
export function ForYourEvent({
  vendor: v,
  fromEvent,
  thumb,
}: {
  vendor: VendorProfile;
  fromEvent?: string;
  thumb?: string;
}) {
  const { t } = useLocale();
  const view = useFamilyPlan();
  const today = toDateString(new Date());
  const categorySlugs = v.categories.map((category) => category.slug);
  // Each of their events with a day still ahead, in date order
  const days: Day[] = view.chosen
    .flatMap((event) => {
      const date =
        view.plan.eventDates?.[event.slug] ??
        (event.phase === 'wedding_day' ? view.plan.weddingDate : null);
      return date && date >= today ? [{ slug: event.slug, name: localized(event.name), date }] : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const likely = likelyEvent(
    view.chosen.filter((event) => days.some((day) => day.slug === event.slug)),
    view.needsByEvent,
    categorySlugs,
    view.plan.guests,
    fromEvent,
  );
  const [picked, setPicked] = useState<string | null>(null);
  const day = days.find((d) => d.slug === (picked ?? likely)) ?? days[0] ?? null;
  const status = useVendorDateStatus(v.id, day?.date ?? null);
  const state: DateStatus = status.data ?? 'unknown';
  const name = localized(v.name);

  const line = wedLine(t, {
    event: day?.name ?? null,
    band: day ? (view.plan.guests?.[day.slug] ?? null) : null,
    status: state,
    hall: v.facts,
  });

  return (
    <>
      {day && (
        <Ticket
          vendorId={v.id}
          days={days}
          day={day}
          state={state}
          onPick={(slug) => setPicked(slug)}
        />
      )}
      {line && (
        <WedLine
          bold={line.bold}
          rest={line.rest}
          vendorName={name}
          onPress={() =>
            openWed({
              about: { kind: 'vendor', id: v.slug, label: name, thumb },
              ask: day
                ? t('vendor.wed.ask', { name, event: day.name })
                : t('vendor.wed.askNoEvent', { name }),
            })
          }
        />
      )}
    </>
  );
}

/** The ticket: the day on a stub, free or not, and a tap to open their other days. */
function Ticket({
  vendorId,
  days,
  day,
  state,
  onPick,
}: {
  vendorId: string;
  days: Day[];
  day: Day;
  state: DateStatus;
  onPick: (slug: string) => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const stub = stubParts(day.date);
  const title =
    state === 'open'
      ? t('vendorTicket.free', { event: day.name })
      : state === 'booked'
        ? t('vendorTicket.booked', { event: day.name })
        : state === 'held'
          ? t('vendorTicket.held', { event: day.name })
          : state === 'partly'
            ? t('vendorTicket.partly', { event: day.name })
            : t('vendorTicket.ask', { event: day.name });
  const tone = toneOf(state, Colors);
  const several = days.length > 1;
  // "As of their calendar" only when they keep one
  const sub = [
    state !== 'unknown' ? t('vendorTicket.calendar') : null,
    several
      ? t(open ? 'vendorTicket.pickBelow' : 'vendorTicket.tapToCheck')
      : t('vendorTicket.askLine'),
  ]
    .filter(Boolean)
    .join(' ');
  const ask = () => router.push({ pathname: '/ask', params: { vendorId, event: day.slug } });

  return (
    <View style={styles.ticket}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${sub}`}
        accessibilityState={several ? { expanded: open } : undefined}
        pressedScale={0.98}
        onPress={() => {
          selectionHaptic();
          if (several) setOpen((shown) => !shown);
          else ask();
        }}
        style={styles.head}
      >
        <View style={styles.stub}>
          <AppText variant="caption" weight={600} color="primary" style={styles.caps}>
            {stub?.month}
          </AppText>
          <AppText weight={700} style={styles.day} maxFontSizeMultiplier={1.3}>
            {stub?.day}
          </AppText>
          <AppText variant="caption" weight={600} color="text2" style={styles.caps}>
            {stub?.weekday}
          </AppText>
        </View>
        <Svg width={2} height="100%" style={styles.perforation}>
          <Line
            x1={1}
            y1={8}
            x2={1}
            y2="100%"
            stroke={Colors.separator}
            strokeWidth={2}
            strokeDasharray="5 5"
          />
        </Svg>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            {state !== 'unknown' && <View style={[styles.dot, { backgroundColor: tone }]} />}
            <AppText weight={700} style={[styles.grow, { color: tone }]}>
              {title}
            </AppText>
          </View>
          <AppText variant="label" color="text2">
            {sub}
          </AppText>
        </View>
        <View style={styles.chevron}>
          <Icon
            name={several ? (open ? 'chevron-up' : 'chevron-down') : 'chevron-forward'}
            size={18}
            color={Colors.text2}
            weight="semibold"
          />
        </View>
        <View style={[styles.notch, styles.notchTop]} />
        {!open && <View style={[styles.notch, styles.notchBottom]} />}
      </PressableScale>

      {open && (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(Timing.quick)}
          style={styles.days}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayRow}
            accessibilityRole="radiogroup"
          >
            {days.map((d) => (
              <DayTile
                key={d.slug}
                vendorId={vendorId}
                day={d}
                on={d.slug === day.slug}
                onPress={() => onPick(d.slug)}
              />
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                selectionHaptic();
                ask();
              }}
              style={({ pressed }) => [styles.other, pressed && styles.pressed]}
            >
              <Icon name="calendar-outline" size={22} color={Colors.text2} />
              <AppText variant="caption" weight={600} color="text2">
                {t('vendorTicket.otherDay')}
              </AppText>
            </Pressable>
          </ScrollView>
          <View style={styles.legend}>
            {/* The dots explained, when this vendor keeps a calendar */}
            {state !== 'unknown' && (
              <>
                <View style={[styles.dot, { backgroundColor: Colors.success }]} />
                <AppText variant="caption" color="text2">
                  {t('vendorTicket.open')}
                </AppText>
                <View style={[styles.dot, styles.legendGap, { backgroundColor: Colors.primary }]} />
                <AppText variant="caption" color="text2">
                  {t('vendorTicket.notFree')}
                </AppText>
              </>
            )}
            <View style={styles.grow} />
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => {
                selectionHaptic();
                ask();
              }}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <AppText variant="label" weight={700}>
                {t('vendorTicket.askHere')}
              </AppText>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

/** One of their days: the date, the event, and the vendor's dot for it. */
function DayTile({
  vendorId,
  day,
  on,
  onPress,
}: {
  vendorId: string;
  day: Day;
  on: boolean;
  onPress: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const status = useVendorDateStatus(vendorId, day.date);
  const state = status.data ?? 'unknown';
  const stub = stubParts(day.date);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${day.name}, ${stub?.weekday} ${stub?.month} ${stub?.day}`}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.tile, on && styles.tileOn, pressed && styles.pressed]}
    >
      <AppText variant="caption" weight={600} color="text2" style={styles.caps}>
        {`${stub?.weekday} · ${stub?.month}`}
      </AppText>
      <AppText weight={700} style={styles.tileDay}>
        {stub?.day}
      </AppText>
      <AppText variant="caption" weight={600} numberOfLines={1} style={styles.tileName}>
        {day.name}
      </AppText>
      <View
        style={[
          styles.dot,
          { backgroundColor: state === 'unknown' ? Colors.separator : toneOf(state, Colors) },
        ]}
      />
    </Pressable>
  );
}

/** Green when free, maroon when not, ink when we can't say. */
function toneOf(state: DateStatus, Colors: ReturnType<typeof useColors>): string {
  return state === 'open' ? Colors.success : state === 'unknown' ? Colors.text : Colors.primary;
}

/** Wed's line: its bow, a sentence in bold and one more, opening Wed about this vendor. */
function WedLine({
  bold,
  rest,
  vendorName,
  onPress,
}: {
  bold: string;
  rest: string;
  vendorName: string;
  onPress: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('vendor.wed.spoken', { line: `${bold} ${rest}`, name: vendorName })}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.wed, pressed && styles.pressed]}
    >
      <WedMark size={24} color="ombre" style={styles.bow} />
      <AppText color="text2" style={styles.grow}>
        <AppText weight={700}>{bold}</AppText>
        {rest ? ` ${rest}` : ''}
      </AppText>
      <Icon name="chevron-forward" size={16} color={Colors.chevron} weight="semibold" />
    </Pressable>
  );
}

const useStyles = makeStyles((Colors) => ({
  ticket: {
    overflow: 'hidden',
    borderRadius: Radius.card - 4,
    borderCurve: 'continuous',
    backgroundColor: Colors.sand,
  },
  head: {
    flexDirection: 'row',
    minHeight: 96,
  },
  stub: {
    width: STUB,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: Spacing.lg,
  },
  caps: {
    letterSpacing: 0.6,
  },
  day: {
    fontSize: 38,
    lineHeight: 42,
  },
  perforation: {
    marginVertical: Spacing.sm,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.lg,
    paddingLeft: Spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  grow: {
    flex: 1,
  },
  chevron: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notch: {
    position: 'absolute',
    left: STUB - NOTCH / 2,
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
  days: {
    gap: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  dayRow: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 2,
  },
  tile: {
    width: 84,
    minHeight: 106,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: Spacing.xs,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  tileOn: {
    borderWidth: 2,
    borderColor: Colors.text,
  },
  tileDay: {
    fontSize: 24,
    lineHeight: 28,
  },
  tileName: {
    maxWidth: 76,
  },
  other: {
    width: 84,
    minHeight: 106,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.separator,
  },
  legend: {
    minHeight: Sizes.tapTarget - 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.lg,
  },
  legendGap: {
    marginLeft: Spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  wed: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  bow: {
    marginTop: 1,
  },
}));
