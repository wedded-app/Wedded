import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Calendar } from '@/components/calendar';
import { makeStyles, Spacing, useColors } from '@/constants/theme';
import { useVendorDateStatus } from '@/data/availability';
import { setAsk } from '@/features/inquiry/ask-draft';
import { shortDay } from '@/features/inquiry/ask-message';
import { AskScreen } from '@/features/inquiry/ask-screen';
import { AskStep } from '@/features/inquiry/ask-step';
import { useAsk } from '@/features/inquiry/use-ask';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

/**
 * Ask for a quote, page 2 of 5: when. A month to tap (the Wedding tab's
 * calendar), their other events marked with a dot, starting on the day in
 * their plan; "Not sure of the day yet" sits in the same card and dims the
 * month. Under it, whether the vendor is free that day, from the calendar
 * vendors keep (nothing when there's no recent calendar).
 */
export default function AskWhenStep() {
  const ask = useAsk();
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { draft, date, eventDates, view, allEvents } = ask;
  const status = useVendorDateStatus(draft.vendorId || null, date);

  const events = draft.eventSlugs.flatMap((slug) => {
    const event = allEvents.find((e) => e.slug === slug);
    return event ? [localized(event.name)] : [];
  });
  // The family's other events, as dots on their days
  const marks: Record<string, string[]> = {};
  for (const event of view.chosen) {
    const day = view.plan.eventDates?.[event.slug];
    if (day) marks[day] = [...(marks[day] ?? []), localized(event.name)];
  }
  const fromPlan = !draft.pickedDate && !draft.dateUnsure && date !== null;
  const subtitle =
    eventDates.length >= 2
      ? t('ask.when.fromPlanMany')
      : fromPlan && date
        ? t('ask.when.fromPlan', { date: shortDay(date) })
        : t('ask.when.pick');
  const state = !draft.dateUnsure && date ? (status.data ?? 'unknown') : 'unknown';
  const tone = state === 'open' ? 'success' : state === 'booked' ? 'primary' : 'text2';

  return (
    <AskScreen ask={ask}>
      <AskStep
        step={2}
        heading={ask.heading}
        photo={ask.photo}
        title={
          events.length === 1 ? t('ask.when.titleOne', { event: events[0] }) : t('ask.when.title')
        }
        subtitle={subtitle}
        summary={draft.dateUnsure ? t('ask.when.summaryUnsure') : date ? shortDay(date) : undefined}
        canContinue={draft.dateUnsure || date !== null}
        onContinue={() => router.push('/ask/guests')}
      >
        <View style={styles.block}>
          <View style={styles.card}>
            <View style={draft.dateUnsure && styles.dim}>
              <Calendar
                value={draft.dateUnsure ? null : date}
                near={date}
                marks={marks}
                onChange={(day) => setAsk({ pickedDate: day, dateUnsure: false })}
              />
            </View>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: draft.dateUnsure }}
              onPress={() => {
                selectionHaptic();
                setAsk({ dateUnsure: !draft.dateUnsure });
              }}
              style={({ pressed }) => [styles.unsure, pressed && styles.pressed]}
            >
              <View style={[styles.radio, draft.dateUnsure && styles.radioOn]}>
                {draft.dateUnsure && <View style={styles.radioDot} />}
              </View>
              <View style={styles.grow}>
                <AppText weight={600}>{t('ask.when.unsure')}</AppText>
                <AppText variant="label" color="text2">
                  {t('ask.when.unsureHint')}
                </AppText>
              </View>
            </Pressable>
          </View>

          {state !== 'unknown' && date && (
            <View style={styles.status} accessibilityLiveRegion="polite">
              <View style={[styles.dot, { backgroundColor: Colors[tone] }]} />
              <AppText weight={600} color={tone} style={styles.grow}>
                {t(`ask.when.status.${state}`, { date: shortDay(date) })}
              </AppText>
            </View>
          )}
          {eventDates.length >= 2 && (
            <View style={styles.planDays}>
              {eventDates.map((d) => (
                <AppText key={d.slug} variant="label" color="text2">
                  {`${d.event}: ${shortDay(d.date)}`}
                </AppText>
              ))}
            </View>
          )}
        </View>
      </AskStep>
    </AskScreen>
  );
}

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.md,
  },
  card: {
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dim: {
    opacity: 0.35,
  },
  unsure: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  pressed: {
    opacity: 0.6,
  },
  grow: {
    flex: 1,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.separator,
  },
  radioOn: {
    borderColor: Colors.primaryFill,
    backgroundColor: Colors.primaryFill,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.onPrimary,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  planDays: {
    gap: 2,
  },
}));
