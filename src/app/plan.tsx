import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { BilingualName } from '@/components/bilingual-name';
import { Button } from '@/components/button';
import { CheckCircle } from '@/components/check-circle';
import { Chip } from '@/components/chip';
import { DateField } from '@/components/date-field';
import { eventIcon } from '@/components/event-icon';
import { groupIcon } from '@/components/group-icon';
import { Icon } from '@/components/icon';
import { SectionTitle } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { ProgressBar } from '@/components/progress-bar';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Sizes, Spacing, Springs, useColors } from '@/constants/theme';
import type { EventNeed, EventNeedsSection, TraditionEvent } from '@/data/reference';
import { GUEST_BANDS } from '@/features/inquiry/inquiry-helpers';
import { CountdownCard } from '@/features/planner/countdown-card';
import { FamilyShortlist } from '@/features/planner/family-shortlist';
import { findForPlan } from '@/features/planner/find-for-plan';
import { essentialNeeds } from '@/features/planner/plan';
import { PlanTogether } from '@/features/planner/plan-together';
import { StartPlanCard } from '@/features/planner/start-plan-card';
import { usePlanView } from '@/features/planner/use-plan-view';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

type BookedVendors = Record<string, { slug: string; name: string }>;

/**
 * My Wedding: the countdown, then what to book for each of the family's
 * events (essential first), ticked off as they book and with a shortcut to
 * find each one. The events themselves are picked in the "Your events"
 * sheet (/plan-events). Saved on this phone, or to the account and shared
 * with family (Plan together, src/data/wedding.ts); viewers see the plan but
 * can't change it.
 */
export default function PlanScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const { t, locale } = useLocale();
  const view = usePlanView();
  const { plan, wedding, canEdit, saveFailed, active, chosen, needsByEvent, progress } = view;

  // The first event with an essential left to book starts open.
  const firstOpen =
    chosen.find((event) => {
      const booked = plan.booked[event.slug] ?? [];
      return essentialNeeds(needsByEvent[event.slug]).some(
        (need) => !booked.includes(need.categorySlug),
      );
    })?.slug ?? chosen[0]?.slug;
  const [open, setOpen] = useState<string[] | null>(null);
  const openSlugs = open ?? (firstOpen ? [firstOpen] : []);
  const toggleOpen = (slug: string) =>
    setOpen(openSlugs.includes(slug) ? openSlugs.filter((s) => s !== slug) : [...openSlugs, slug]);

  const openPicker = () => router.push('/plan-events');

  // Booking an event's last essential: say so, fold it away and open the
  // next event with something left, so there's always a clear next step.
  const [cheer, setCheer] = useState<{ done: string; next: string | null } | null>(null);
  useEffect(() => {
    if (!cheer) return;
    const timer = setTimeout(() => setCheer(null), 5000);
    return () => clearTimeout(timer);
  }, [cheer]);
  function eventCompleted(slug: string) {
    const done = chosen.find((event) => event.slug === slug);
    const next = chosen.find(
      (event) =>
        event.slug !== slug &&
        essentialNeeds(needsByEvent[event.slug]).some(
          (need) => !(plan.booked[event.slug] ?? []).includes(need.categorySlug),
        ),
    );
    successHaptic();
    setCheer({
      done: done ? localized(done.name, locale) : '',
      next: next ? localized(next.name, locale) : null,
    });
    setTimeout(() => setOpen(next ? [next.slug] : []), 700);
  }

  return (
    <NavScreen title={t('planner.title')} subtitle={t('planner.subtitle')}>
      {/* A plan belongs to an account: signed out, or not started yet, offer to start one. */}
      {!wedding && !view.loading && (
        <Animated.View entering={Motion.rise}>
          <StartPlanCard />
        </Animated.View>
      )}
      {!wedding && view.loading && <StateView state="loading" />}

      {wedding && (
        <View style={styles.hero}>
          <CountdownCard plan={plan} progress={progress} eventsCount={chosen.length} />
          {canEdit && (
            <DateField
              value={plan.weddingDate}
              onChange={(date) => {
                successHaptic();
                view.setWeddingDate(date);
              }}
              placeholder={plan.weddingDate ? t('planner.changeDate') : t('planner.pickDate')}
            />
          )}
        </View>
      )}

      {saveFailed && (
        <AppText color="error" style={styles.pad}>
          {t('planTogether.saveFailed')}
        </AppText>
      )}
      {wedding && view.isPending && <StateView state="loading" />}
      {view.isError && <StateView state="error" onRetry={() => void view.refetch()} />}

      {wedding && !view.isPending && !view.isError && chosen.length === 0 && canEdit && (
        <Animated.View entering={Motion.rise} style={styles.start}>
          <View style={styles.startIcon}>
            <Icon name="sparkles-outline" size={28} color={Colors.primary} />
          </View>
          <AppText variant="heading" weight={700}>
            {t('planner.startTitle')}
          </AppText>
          <AppText color="text2">{t('planner.startBody')}</AppText>
          <Button label={t('planner.chooseEvents')} icon="add" onPress={openPicker} />
        </Animated.View>
      )}

      {chosen.length > 0 && (
        <View style={styles.block}>
          <View style={styles.heading}>
            <View style={styles.titleRow}>
              <SectionTitle>{t('planner.checklistTitle')}</SectionTitle>
              {canEdit && (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={12}
                  onPress={openPicker}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <AppText weight={600} color="primary">
                    {t('planner.editEvents')}
                  </AppText>
                </Pressable>
              )}
            </View>
            <AppText variant="label" weight={400} color="text2" style={styles.pad}>
              {[
                ...active.map((tradition) => localized(tradition.name, locale)),
                t('planner.eventsCount', { count: chosen.length }),
              ].join(' · ')}
            </AppText>
          </View>
          {cheer && (
            <Animated.View
              entering={Motion.rise}
              exiting={Motion.exit}
              layout={Motion.layout}
              style={styles.cheer}
              accessibilityLiveRegion="polite"
            >
              <View style={styles.cheerIcon}>
                <Icon name="checkmark" size={20} color={Colors.onPrimary} weight="bold" />
              </View>
              <View style={styles.grow}>
                <AppText weight={700}>
                  {cheer.next
                    ? t('planner.cheerDone', { event: cheer.done })
                    : t('planner.cheerAll')}
                </AppText>
                {cheer.next && (
                  <AppText variant="label" weight={400} color="text2">
                    {t('planner.cheerNext', { event: cheer.next })}
                  </AppText>
                )}
              </View>
            </Animated.View>
          )}
          {chosen.map((event) => (
            <EventPlan
              key={event.slug}
              event={event}
              sections={needsByEvent[event.slug] ?? []}
              booked={plan.booked[event.slug] ?? []}
              bookedVendors={wedding?.bookedVendors ?? {}}
              guests={plan.guests?.[event.slug] ?? null}
              canEdit={canEdit}
              open={openSlugs.includes(event.slug)}
              onToggle={() => toggleOpen(event.slug)}
              onComplete={() => eventCompleted(event.slug)}
              onToggleBooked={(category) => view.toggleBooked(event.slug, category)}
              onGuests={(band) => view.setEventGuests(event.slug, band)}
            />
          ))}
        </View>
      )}

      {wedding && <PlanTogether wedding={wedding} />}
      {wedding && <FamilyShortlist weddingId={wedding.id} />}
    </NavScreen>
  );
}

/** One event's checklist; the header opens and closes it. */
function EventPlan({
  event,
  sections,
  booked,
  bookedVendors,
  guests,
  canEdit,
  open,
  onToggle,
  onComplete,
  onToggleBooked,
  onGuests,
}: {
  event: TraditionEvent;
  sections: EventNeedsSection[];
  booked: string[];
  bookedVendors: BookedVendors;
  guests: string | null;
  canEdit: boolean;
  open: boolean;
  onToggle: () => void;
  /** Its last essential was just booked. */
  onComplete: () => void;
  onToggleBooked: (categorySlug: string) => void;
  onGuests: (band: string | null) => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t, locale } = useLocale();
  const reduceMotion = useReducedMotion();
  const [showNice, setShowNice] = useState(false);
  const essential = essentialNeeds(sections);
  const extras = sections.filter((s) => s.importance !== 'essential').flatMap((s) => s.needs);
  const done = essential.filter((need) => booked.includes(need.categorySlug)).length;
  const complete = essential.length > 0 && done === essential.length;
  const name = localized(event.name, locale);

  const wasComplete = useRef(complete);
  useEffect(() => {
    if (complete && !wasComplete.current) onComplete();
    wasComplete.current = complete;
  }, [complete, onComplete]);

  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.value = reduceMotion ? (open ? 1 : 0) : withSpring(open ? 1 : 0, Springs.snappy);
  }, [open, reduceMotion, turn]);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));

  const row = (need: EventNeed, isEssential: boolean) => (
    <NeedRow
      key={need.categorySlug}
      need={need}
      eventSlug={event.slug}
      booked={booked.includes(need.categorySlug)}
      bookedWith={bookedVendors[`${event.slug}/${need.categorySlug}`]?.name ?? null}
      guests={guests}
      essential={isEssential}
      canEdit={canEdit}
      onToggle={() => onToggleBooked(need.categorySlug)}
    />
  );

  return (
    <Animated.View layout={Motion.layout} style={styles.eventCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${name}, ${t('planner.progress', { done, total: essential.length })}`}
        onPress={() => {
          selectionHaptic();
          onToggle();
        }}
        style={({ pressed }) => [styles.eventHead, pressed && styles.headPressed]}
      >
        <View style={[styles.eventIcon, complete && styles.eventIconDone]}>
          <Icon
            name={complete ? 'checkmark' : eventIcon(event.slug)}
            size={22}
            color={complete ? Colors.onPrimary : Colors.primary}
            weight={complete ? 'bold' : 'regular'}
          />
        </View>
        <View style={styles.grow}>
          <BilingualName name={event.name} variant="bodyLg" weight={600} />
          {event.timing && (
            <AppText variant="caption" color="text2">
              {localized(event.timing, locale)}
            </AppText>
          )}
          <View style={styles.progressRow}>
            <ProgressBar
              value={essential.length > 0 ? done / essential.length : 0}
              color={Colors.success}
              trackColor={Colors.fill}
              style={styles.grow}
            />
            <AppText variant="caption" weight={600} color={complete ? 'success' : 'text2'}>
              {complete ? t('planner.allBooked') : `${done}/${essential.length}`}
            </AppText>
          </View>
        </View>
        <Animated.View style={chevron}>
          <Icon name="chevron-down" size={18} color={Colors.chevron} weight="semibold" />
        </Animated.View>
      </Pressable>

      {open && (
        <Animated.View entering={Motion.enter} exiting={Motion.exit}>
          <View style={styles.guests}>
            <AppText variant="label" weight={600} color="text2">
              {t('planner.guestsTitle')}
            </AppText>
            <View style={styles.guestChips} accessibilityRole="radiogroup">
              {GUEST_BANDS.map((band) => (
                <Chip
                  key={band}
                  role="radio"
                  label={t(`inquiry.guestBands.${band}`)}
                  selected={guests === band}
                  disabled={!canEdit}
                  onPress={() => onGuests(guests === band ? null : band)}
                />
              ))}
            </View>
          </View>
          {essential.map((need) => row(need, true))}
          {extras.length > 0 && showNice && (
            <Animated.View entering={Motion.enter} exiting={Motion.exit}>
              <AppText variant="label" weight={600} color="text2" style={styles.subhead}>
                {t('event.niceToHave')}
              </AppText>
              {extras.map((need) => row(need, false))}
            </Animated.View>
          )}
          {extras.length > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowNice((shown) => !shown)}
              style={({ pressed }) => [styles.more, pressed && styles.headPressed]}
            >
              <AppText weight={600} color="primary">
                {showNice ? t('planner.showLess') : t('planner.showNice', { count: extras.length })}
              </AppText>
              <Icon
                name={showNice ? 'chevron-up' : 'chevron-down'}
                size={15}
                color={Colors.primary}
                weight="semibold"
              />
            </Pressable>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}

/** A vendor type to book: tick when booked, Find to look for one. */
function NeedRow({
  need,
  eventSlug,
  booked,
  bookedWith,
  guests,
  essential,
  canEdit,
  onToggle,
}: {
  need: EventNeed;
  eventSlug: string;
  booked: boolean;
  /** The vendor's name, when the booking names one. */
  bookedWith: string | null;
  /** The event's guest band, which Find turns into filters. */
  guests: string | null;
  essential: boolean;
  canEdit: boolean;
  onToggle: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t, locale } = useLocale();
  const name = localized(need.name, locale);

  return (
    <Animated.View layout={Motion.layout} style={styles.need}>
      <CheckCircle
        checked={booked}
        disabled={!canEdit}
        accessibilityLabel={t('planner.markBooked', { name })}
        onPress={() => {
          if (booked) selectionHaptic();
          else successHaptic();
          onToggle();
        }}
      />
      <Icon
        name={groupIcon(need.groupSlug)}
        size={20}
        color={booked ? Colors.textDisabled : Colors.primary}
      />
      <View style={styles.grow}>
        <AppText color={booked ? 'text2' : 'text'} style={booked && styles.doneText}>
          {name}
        </AppText>
        {booked && bookedWith && (
          <AppText variant="caption" color="success" weight={600}>
            {t('planner.bookedWith', { name: bookedWith })}
          </AppText>
        )}
        {essential && !booked && (
          <AppText variant="caption" color="kesari" weight={600}>
            {t('event.essential')}
          </AppText>
        )}
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('planner.find', { name })}
        hitSlop={6}
        onPress={() => findForPlan(need.categorySlug, need.groupSlug, eventSlug, guests)}
        style={({ pressed }) => [styles.find, pressed && styles.findPressed]}
      >
        <AppText variant="label" weight={600} color="primary">
          {t('planner.findShort')}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

const useStyles = makeStyles((Colors) => ({
  hero: {
    gap: Spacing.md,
  },
  start: {
    gap: Spacing.md,
    padding: Spacing.xl,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  startIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  block: {
    gap: Spacing.md,
  },
  heading: {
    gap: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingRight: Spacing.xs,
  },
  pad: {
    paddingHorizontal: Spacing.xs,
  },
  pressed: {
    opacity: 0.5,
  },
  cheer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.success,
  },
  cheerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
  },
  eventCard: {
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  eventHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  headPressed: {
    backgroundColor: Colors.rowPressed,
  },
  eventIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  eventIconDone: {
    backgroundColor: Colors.success,
  },
  grow: {
    flex: 1,
    gap: 2,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  guests: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  guestChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  subhead: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  more: {
    minHeight: Sizes.tapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  need: {
    minHeight: Sizes.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  doneText: {
    textDecorationLine: 'line-through',
  },
  find: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.button,
    backgroundColor: Colors.primaryTint,
  },
  findPressed: {
    opacity: 0.6,
  },
}));
