import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { OmbreBackground } from '@/components/ombre-background';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import type { BusinessStats, Lead } from '@/data/business';
import { useVendorDateStatus } from '@/data/availability';
import type { MonthMarks } from '@/data/vendor-self';
import { useEventNames } from '@/features/business/business-parts';
import { dayLook } from '@/features/business/calendar-day';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { useRequestWords } from '@/features/requests/use-request-words';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

/**
 * The top of Today (the final look, 2026-10-23): business mode's moving
 * saffron card, so this side never looks like the family's. How many families
 * wait for a reply and how long the first has waited; a tap opens Leads. With
 * nobody waiting it says so, warmly.
 */
export function WaitingCard({ count, oldest }: { count: number; oldest: Lead | null }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const words = useRequestWords();
  const title =
    count > 0 ? t('businessToday.waiting', { count }) : t('businessToday.nobodyWaiting');
  const line =
    count > 0 && oldest
      ? t('businessToday.oldest', { ago: words.ago(oldest.createdAt).toLowerCase() })
      : t('businessToday.nobodyWaitingBody');

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${line}`}
      pressedScale={0.98}
      onPress={() => {
        selectionHaptic();
        router.navigate('/leads');
      }}
      style={styles.card}
    >
      <OmbreBackground tone="saffron" />
      <AppText variant="caption" weight={600} style={styles.cardCaps}>
        {t('businessToday.leadsCaps').toUpperCase()}
      </AppText>
      <View style={styles.cardBottom}>
        <View style={styles.grow}>
          <AppText weight={700} style={styles.cardTitle} maxFontSizeMultiplier={1.4}>
            {title}
          </AppText>
          <AppText weight={500} style={styles.cardLine}>
            {line}
          </AppText>
        </View>
        <View style={styles.cardArrow}>
          <Icon name="arrow-forward" size={20} color={Colors.saffronBase} weight="semibold" />
        </View>
      </View>
    </PressableScale>
  );
}

/**
 * A family waiting for a reply: who, for which event and day, how many
 * guests, and whether the vendor is free that day from their own calendar.
 */
export function WaitingLead({ lead, vendorId }: { lead: Lead; vendorId: string }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const eventName = useEventNames();
  const status = useVendorDateStatus(vendorId, lead.eventDate);
  const who = lead.familyName ?? t('chat.aFamily');
  const what = [
    lead.eventSlugs.map(eventName).join(', ') ||
      (lead.kind === 'tour' ? t('business.leads.tour') : null),
    lead.eventDate ? formatDate(lead.eventDate) : t('business.leads.dateNotSure'),
    t('business.leads.guests', { band: t(`inquiry.guestBands.${lead.guestBand}`) }),
  ]
    .filter(Boolean)
    .join(' · ');
  const state = lead.eventDate ? status.data : undefined;
  const free = state === 'open';
  const busy = state === 'booked';
  const day =
    state === 'open'
      ? t('businessToday.freeThatDay')
      : state === 'booked'
        ? t('businessToday.bookedThatDay')
        : state === 'held' || state === 'partly'
          ? t('businessToday.partlyThatDay')
          : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[who, what, day].filter(Boolean).join(', ')}
      onPress={() => router.push({ pathname: '/business/lead', params: { id: lead.id } })}
      style={({ pressed }) => [styles.lead, pressed && styles.pressed]}
    >
      <View style={styles.initial}>
        <AppText weight={700} color="kesari">
          {who.charAt(0).toUpperCase()}
        </AppText>
      </View>
      <View style={styles.grow}>
        <AppText weight={600} numberOfLines={1}>
          {who}
        </AppText>
        <AppText variant="label" color="text2" numberOfLines={2}>
          {what}
        </AppText>
        {day && (
          <View style={styles.dayRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: free ? Colors.success : busy ? Colors.error : Colors.accent },
              ]}
            />
            <AppText
              variant="label"
              weight={600}
              color={free ? 'success' : busy ? 'error' : 'kesari'}
            >
              {day}
            </AppText>
          </View>
        )}
      </View>
      <Icon name="chevron-forward" size={16} color={Colors.chevron} weight="semibold" />
    </Pressable>
  );
}

/**
 * The week as seven days: open days white, held saffron, booked ink, part of
 * the day half filled. A tap opens the Calendar tab.
 */
export function WeekStrip({
  days,
  marks,
  today,
}: {
  days: string[];
  marks: MonthMarks;
  today: string;
}) {
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={days
        .map((day) => {
          const date = new Date(`${day}T12:00:00`);
          return `${t(`business.calendar.days.${date.getDay()}`)} ${date.getDate()}: ${t(`business.calendar.status.${dayLook(marks[day] ?? [])}`)}`;
        })
        .join(', ')}
      onPress={() => router.navigate('/calendar')}
      style={styles.week}
    >
      {days.map((day, index) => {
        const date = new Date(`${day}T12:00:00`);
        const look = dayLook(marks[day] ?? []);
        const filled = look === 'booked' || look === 'partBooked';
        const held = look === 'held' || look === 'partHeld';
        return (
          <Animated.View key={day} entering={Motion.stagger(index)} style={styles.weekDay}>
            <AppText variant="caption" weight={600} color="text2" maxFontSizeMultiplier={1.2}>
              {t(`business.calendar.weekdays.${date.getDay()}`)}
            </AppText>
            <View
              style={[
                styles.dayChip,
                filled && styles.dayBooked,
                held && styles.dayHeld,
                day === today && !filled && !held && styles.dayToday,
              ]}
            >
              <AppText
                weight={700}
                color={filled ? 'onPrimary' : 'text'}
                maxFontSizeMultiplier={1.2}
              >
                {date.getDate()}
              </AppText>
            </View>
          </Animated.View>
        );
      })}
    </Pressable>
  );
}

/** Last month's numbers in one sentence: saw, saved, asked. */
export function MonthWords({ stats }: { stats: BusinessStats }) {
  const { t } = useLocale();
  return (
    <AppText variant="bodyLg">
      {t('businessToday.month.sentence', {
        saw: t('businessToday.month.saw', { count: stats.views }),
        saved: t('businessToday.month.saved', { count: stats.saves }),
        asked: t('businessToday.month.asked', { count: stats.inquiries }),
      })}
    </AppText>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    minHeight: 168,
    justifyContent: 'space-between',
    gap: Spacing.lg,
    padding: Spacing.xl,
    overflow: 'hidden',
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.saffronBase,
  },
  cardCaps: {
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.8,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.md,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.4,
  },
  cardLine: {
    color: 'rgba(255,255,255,0.9)',
    marginTop: Spacing.xs,
  },
  cardArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  grow: {
    flex: 1,
  },
  lead: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  pressed: {
    opacity: 0.6,
  },
  initial: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.kesariTint,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dayChip: {
    width: '100%',
    maxWidth: 46,
    aspectRatio: 0.82,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: Colors.bg,
    boxShadow: `inset 0 0 0 1px ${Colors.border}`,
  },
  dayBooked: {
    backgroundColor: Colors.primaryFill,
    boxShadow: 'none',
  },
  dayHeld: {
    backgroundColor: Colors.accent,
    boxShadow: 'none',
  },
  dayToday: {
    boxShadow: `inset 0 0 0 2px ${Colors.text}`,
  },
}));
