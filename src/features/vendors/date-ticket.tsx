import { router } from 'expo-router';
import { View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useVendorDateStatus } from '@/data/availability';
import { stubParts } from '@/features/home/greeting';
import { essentialNeeds } from '@/features/planner/plan-helpers';
import { usePlanView } from '@/features/planner/use-plan-view';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

const STUB = 82;
const NOTCH = 20;

/**
 * The date ticket on a vendor's page (the final look, 2026-10-23): their day
 * against the family's likely event, the one this kind of vendor is for (or
 * the event they came from). "Free on your Mehndi", booked, held or partly
 * free, from the calendar vendors keep; with no recent calendar it just
 * offers to ask, never promising a date. A tap opens Ask for a quote for that
 * event. Shows only once the family has a date.
 */
export function DateTicket({
  vendorId,
  categorySlugs,
  fromEvent,
}: {
  vendorId: string;
  categorySlugs: string[];
  fromEvent?: string;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { plan, chosen, needsByEvent } = usePlanView();
  const likely =
    chosen.find((event) => event.slug === fromEvent) ??
    chosen.find((event) =>
      essentialNeeds(needsByEvent[event.slug]).some((need) =>
        categorySlugs.includes(need.categorySlug),
      ),
    ) ??
    chosen[0];
  const date = (likely && plan.eventDates?.[likely.slug]) || plan.weddingDate || null;
  const status = useVendorDateStatus(vendorId || null, date);
  const stub = stubParts(date);
  if (!likely || !stub) return null;

  const event = localized(likely.name);
  const state = status.data ?? 'unknown';
  const title =
    state === 'open'
      ? t('vendorTicket.free', { event })
      : state === 'booked'
        ? t('vendorTicket.booked', { event })
        : state === 'held'
          ? t('vendorTicket.held', { event })
          : state === 'partly'
            ? t('vendorTicket.partly', { event })
            : t('vendorTicket.ask', { event });
  const tone =
    state === 'open' ? Colors.success : state === 'unknown' ? Colors.text : Colors.primary;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${t('vendorTicket.hint')}`}
      pressedScale={0.98}
      onPress={() => {
        selectionHaptic();
        router.push({ pathname: '/ask', params: { vendorId, event: likely.slug } });
      }}
      style={styles.ticket}
    >
      <View style={styles.stub}>
        <AppText variant="caption" weight={600} color="primary" style={styles.caps}>
          {stub.month}
        </AppText>
        <AppText weight={700} style={styles.day} maxFontSizeMultiplier={1.3}>
          {stub.day}
        </AppText>
        <AppText variant="caption" weight={600} color="text2" style={styles.caps}>
          {stub.weekday}
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
        <AppText variant="caption" weight={600} color="text2" style={styles.caps}>
          {t('vendorTicket.askLine').toUpperCase()}
        </AppText>
      </View>
      <View style={[styles.notch, styles.notchTop]} />
      <View style={[styles.notch, styles.notchBottom]} />
    </PressableScale>
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
    fontSize: 34,
    lineHeight: 38,
  },
  perforation: {
    marginVertical: Spacing.sm,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.lg,
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
}));
