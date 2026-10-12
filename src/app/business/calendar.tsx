import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useSetDayStatus, useTouchCalendar, useVendorCalendar } from '@/data/vendor-self';
import { dayLook, type DayLook } from '@/features/business/calendar-day';
import { isoDay, isoMonth, monthWeeks, shiftMonth } from '@/features/business/month-grid';
import { useCurrentBusiness } from '@/features/business/use-current-business';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';

type Choice = 'open' | 'booked' | 'held';
const CHOICES: {
  status: Choice;
  icon: 'checkmark-circle-outline' | 'close-circle' | 'time-outline';
}[] = [
  { status: 'open', icon: 'checkmark-circle-outline' },
  { status: 'booked', icon: 'close-circle' },
  { status: 'held', icon: 'time-outline' },
];

/**
 * My business → Calendar: a month at a time, each day open, booked or held
 * (all day, or part of the day when set that way elsewhere). Tap a day to
 * change it. "My calendar is up to date" tells families unmarked days are
 * open for the next 60 days. Past days can't be changed.
 */
export default function BusinessCalendarScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const business = useCurrentBusiness();
  const thisMonth = isoMonth(new Date());
  const today = isoDay(new Date());
  const [month, setMonth] = useState(thisMonth);
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const calendar = useVendorCalendar(business.vendorId, month);
  const setDay = useSetDayStatus(business.vendorId);
  const touch = useTouchCalendar(business.vendorId);

  const [year, monthNumber] = month.split('-').map(Number);
  const monthName = t(`business.calendar.months.${monthNumber}`);
  const dayTitle = (day: string) => {
    const date = new Date(`${day}T12:00:00`);
    return t('business.calendar.dayTitle', {
      weekday: t(`business.calendar.days.${date.getDay()}`),
      month: t(`business.calendar.months.${date.getMonth() + 1}`),
      day: date.getDate(),
    });
  };
  const lookOf = (day: string): DayLook => dayLook(calendar.data?.[day] ?? []);

  const choose = async (day: string, status: Choice) => {
    setPicked(null);
    setError(null);
    try {
      await setDay.mutateAsync({ day, status });
      selectionHaptic();
    } catch {
      setError(t('business.calendar.saveFailed'));
    }
  };

  if (business.isPending) {
    return (
      <NavScreen title={t('business.calendar.title')}>
        <StateView state="loading" />
      </NavScreen>
    );
  }
  if (!business.isVendor) {
    return (
      <NavScreen title={t('business.calendar.title')}>
        <StateView state="empty" icon="storefront-outline" message={t('business.notVendor')} />
      </NavScreen>
    );
  }

  return (
    <NavScreen title={t('business.calendar.title')}>
      <AppText color="text2">{t('business.calendar.intro')}</AppText>

      <View style={styles.monthBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('business.calendar.previous')}
          accessibilityState={{ disabled: month <= thisMonth }}
          disabled={month <= thisMonth}
          onPress={() => setMonth(shiftMonth(month, -1))}
          style={({ pressed }) => [
            styles.arrow,
            month <= thisMonth && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Icon name="chevron-back" size={Sizes.icon} color={Colors.primary} />
        </Pressable>
        <AppText variant="heading" weight={700} accessibilityRole="header" style={styles.monthName}>
          {t('business.calendar.monthTitle', { month: monthName, year })}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('business.calendar.next')}
          onPress={() => setMonth(shiftMonth(month, 1))}
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        >
          <Icon name="chevron-forward" size={Sizes.icon} color={Colors.primary} />
        </Pressable>
      </View>

      {calendar.isError ? (
        <StateView state="error" onRetry={() => void calendar.refetch()} />
      ) : (
        <View style={styles.grid}>
          <View style={styles.week} importantForAccessibility="no-hide-descendants">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <AppText key={d} variant="label" weight={600} color="text2" style={styles.weekday}>
                {t(`business.calendar.weekdays.${d}`)}
              </AppText>
            ))}
          </View>
          {monthWeeks(month).map((week, w) => (
            <View key={w} style={styles.week}>
              {week.map((day, d) =>
                day ? (
                  <DayCell
                    key={day}
                    day={day}
                    look={lookOf(day)}
                    past={day < today}
                    today={day === today}
                    label={`${dayTitle(day)}: ${t(`business.calendar.status.${lookOf(day)}`)}`}
                    onPress={() => setPicked(day)}
                  />
                ) : (
                  <View key={`blank-${d}`} style={styles.cell} />
                ),
              )}
            </View>
          ))}
        </View>
      )}

      <Legend />
      {error && <FieldError message={error} />}

      <View style={styles.fresh}>
        <AppText variant="heading" weight={700}>
          {t('business.calendar.freshTitle')}
        </AppText>
        <AppText color="text2">{t('business.calendar.freshBody')}</AppText>
        <Button
          icon="checkmark-circle-outline"
          label={t('business.calendar.upToDate')}
          loading={touch.isPending}
          onPress={() =>
            touch.mutate(undefined, {
              onSuccess: () => successHaptic(),
            })
          }
        />
        {touch.isSuccess && (
          <AppText color="success" accessibilityLiveRegion="polite">
            {t('business.calendar.upToDateDone')}
          </AppText>
        )}
        {touch.isError && <FieldError message={t('business.calendar.saveFailed')} />}
      </View>

      <Modal
        visible={picked !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicked(null)}
      >
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={t('business.cancel')}
          onPress={() => setPicked(null)}
        />
        {picked && (
          <View style={styles.sheet}>
            <AppText variant="title" accessibilityRole="header">
              {dayTitle(picked)}
            </AppText>
            {lookOf(picked).startsWith('part') && (
              <AppText color="text2">{t('business.calendar.partNote')}</AppText>
            )}
            {CHOICES.map(({ status, icon }) => {
              const current = lookOf(picked) === status;
              return (
                <Pressable
                  key={status}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: current }}
                  onPress={() => void choose(picked, status)}
                  style={({ pressed }) => [
                    styles.choice,
                    current && styles.choiceOn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon name={icon} size={Sizes.icon} color={Colors.primary} />
                  <View style={styles.choiceText}>
                    <AppText variant="bodyLg" weight={700}>
                      {t(`business.calendar.choice.${status}`)}
                    </AppText>
                    <AppText color="text2">{t(`business.calendar.choiceHint.${status}`)}</AppText>
                  </View>
                  {current && <Icon name="checkmark" size={Sizes.icon} color={Colors.primary} />}
                </Pressable>
              );
            })}
            <Button variant="text" label={t('business.cancel')} onPress={() => setPicked(null)} />
          </View>
        )}
      </Modal>
    </NavScreen>
  );
}

function DayCell({
  day,
  look,
  past,
  today,
  label,
  onPress,
}: {
  day: string;
  look: DayLook;
  past: boolean;
  today: boolean;
  label: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const booked = look === 'booked';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: past }}
      disabled={past}
      onPress={onPress}
      style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.day,
          booked && styles.dayBooked,
          look === 'held' && styles.dayHeld,
          today && !booked && styles.dayToday,
          past && styles.disabled,
        ]}
      >
        <AppText weight={today ? 700 : 500} color={booked ? 'onPrimary' : 'text'}>
          {String(Number(day.slice(8)))}
        </AppText>
        {look.startsWith('part') && (
          <View style={[styles.partBar, look === 'partHeld' && styles.partHeld]} />
        )}
      </View>
    </Pressable>
  );
}

function Legend() {
  const styles = useStyles();
  const { t } = useLocale();
  const items: { look: DayLook; style: object }[] = [
    { look: 'open', style: styles.day },
    { look: 'booked', style: [styles.day, styles.dayBooked] },
    { look: 'held', style: [styles.day, styles.dayHeld] },
    { look: 'partBooked', style: styles.day },
  ];
  return (
    <View style={styles.legend}>
      {items.map(({ look, style }) => (
        <View key={look} style={styles.legendItem}>
          <View style={[style, styles.legendSwatch]}>
            {look === 'partBooked' && <View style={styles.partBar} />}
          </View>
          <AppText variant="label" weight={400}>
            {t(`business.calendar.legend.${look}`)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthName: {
    flex: 1,
    textAlign: 'center',
  },
  arrow: {
    width: Sizes.tapTarget,
    height: Sizes.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.6,
  },
  grid: {
    gap: 4,
  },
  week: {
    flexDirection: 'row',
    gap: 4,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    minHeight: 44,
  },
  day: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.chip,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  dayBooked: {
    backgroundColor: Colors.primaryFill,
  },
  dayHeld: {
    borderColor: Colors.kesari,
    borderStyle: 'dashed',
    backgroundColor: Colors.kesariTint,
  },
  dayToday: {
    borderColor: Colors.primary,
  },
  partBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 8,
    backgroundColor: Colors.primaryFill,
  },
  partHeld: {
    backgroundColor: Colors.kesari,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendSwatch: {
    flex: 0,
    width: 24,
    height: 24,
  },
  fresh: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    gap: Spacing.md,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    backgroundColor: Colors.bg,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 64,
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: Colors.surface,
  },
  choiceOn: {
    borderColor: Colors.primary,
  },
  choiceText: {
    flex: 1,
    gap: 2,
  },
}));
