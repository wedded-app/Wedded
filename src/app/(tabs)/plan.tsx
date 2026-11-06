import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { SectionTitle } from '@/components/list';
import { NavScreen, useNavTop } from '@/components/nav';
import { PressableScale } from '@/components/pressable-scale';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Spacing, useColors, useScheme } from '@/constants/theme';
import { useGuestSummary } from '@/data/guests';
import { FamilyChats } from '@/features/group-chat/family-chats';
import { DayTicket, ticketEntry } from '@/features/planner/day-ticket';
import { FamilyShortlist } from '@/features/planner/family-shortlist';
import { GuestTiles } from '@/features/planner/guest-tiles';
import { PlanTogether } from '@/features/planner/plan-together';
import { Suggestions } from '@/features/planner/suggestions';
import { StartPlanCard } from '@/features/planner/start-plan-card';
import { usePlanDays } from '@/features/planner/use-plan-days';
import { usePlanView } from '@/features/planner/use-plan-view';
import { comingLine, whenLine } from '@/features/planner/wedding-tab';
import { markTourSeen, useTourSeen } from '@/features/planner/tour-state';
import { heroHeight, WeddingHero } from '@/features/planner/wedding-hero';
import { useTourTargets, WeddingTour } from '@/features/planner/wedding-tour';
import { AskWedButton } from '@/features/wed/ask-wed-button';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

/**
 * Wedding, the tab (the final look, 2026-10-23; its top and days 2026-11-06),
 * in four parts:
 * 1. The top: Home's moving ombre across the top of the screen, with the
 *    couple's names, the days to go to the main day, the faces of everyone
 *    planning (they open Family below) and Your days (/plan-days).
 * 2. Your events a day at a time, in ceremony order: a ticket per day, with
 *    two events on one day sharing its stub, each saying in words what it
 *    still needs, who's booked and how many are coming. A tap opens the
 *    event's own page (/plan-event/{slug}). The events are picked in the
 *    "Your events" sheet (/plan-events).
 * 3. For your guests, as tiles: Guests, the website, invitations and the
 *    Memory Vault.
 * 4. Planning together: Family and their roles, suggestions, the family
 *    shortlist to vote on, and the family chats.
 * The first time it opens with events, a short tour lights each part up
 * in turn (WeddingTour). Saved to the account and shared with family (Plan together,
 * src/data/wedding.ts); viewers see the plan but can't change it.
 */
export default function PlanScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const view = usePlanView();
  const { plan, wedding, canEdit, saveFailed, active, chosen, needsByEvent } = view;
  const days = usePlanDays(view);
  // Only the owner and editors see who's coming: it's other people's numbers
  const guestSummary = useGuestSummary(canEdit ? (wedding?.id ?? null) : null);
  const { height } = useWindowDimensions();
  const scheme = useScheme();

  // White clock and battery over the ombre; the app's own once it scrolls away
  const [pastTop, setPastTop] = useState(false);
  const hero = !!wedding;
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(hero && !pastTop ? 'light' : scheme === 'dark' ? 'light' : 'dark');
      return () => setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
    }, [hero, pastTop, scheme]),
  );

  // The events a day at a time: those with a day of their own in their
  // days, then the Whole wedding card
  const entry = (slug: string) => {
    const event = chosen.find((e) => e.slug === slug)!;
    return ticketEntry(
      event,
      {
        sections: needsByEvent[slug] ?? [],
        booked: plan.booked[slug] ?? [],
        bookedVendors: wedding?.bookedVendors ?? {},
        dated: !!days.state.dates[slug],
        when: whenLine(wedding?.eventTimes[slug], wedding?.eventPlaces[slug]),
        coming: comingLine(
          guestSummary.data?.find((s) => s.eventSlug === slug),
          t,
        ),
      },
      t,
    );
  };
  const tickets = [
    ...days.groups.map((group) => ({ date: group.date, slugs: group.slugs })),
    ...chosen
      .filter((event) => !days.order.includes(event.slug))
      .map((event) => ({ date: null, slugs: [event.slug] })),
  ];

  // The faces at the top open Family, further down this page
  const scroll = useRef<ScrollViewInstance>(null);
  const familyY = useRef<number | null>(null);
  const navTop = useNavTop();
  const openFamily = () => {
    if (familyY.current === null) return;
    scroll.current?.scrollTo({
      y: Math.max(0, familyY.current - navTop - Spacing.sm),
      animated: !reduceMotion,
    });
  };

  // The first visit with events: a short tour of the page, once per phone
  const tour = useTourTargets();
  const tourSeen = useTourSeen();
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const [touring, setTouring] = useState(false);
  const ready = focused && !tourSeen && !!wedding && !view.isPending && chosen.length > 0;
  useEffect(() => {
    if (!ready) return;
    // Once the page has drawn and settled
    const timer = setTimeout(() => setTouring(true), 900);
    return () => clearTimeout(timer);
  }, [ready]);
  const endTour = () => {
    setTouring(false);
    markTourSeen();
    scroll.current?.scrollTo({ y: 0, animated: !reduceMotion });
  };
  const scrollTo = useCallback(
    (y: number) => scroll.current?.scrollTo({ y, animated: !reduceMotion }),
    [reduceMotion],
  );

  // Tapping an event on Home lands here (?event=mehndi): open its page
  const { event: openEvent } = useLocalSearchParams<{ event?: string }>();
  useEffect(() => {
    if (!openEvent) return;
    router.setParams({ event: undefined });
    router.push({ pathname: '/plan-event/[slug]', params: { slug: openEvent } });
  }, [openEvent]);

  const openPicker = () => router.push('/plan-events');

  return (
    <NavScreen
      scrollRef={scroll}
      // With a wedding, the couple's names are on the ombre at the top
      title={wedding ? null : t('planner.title')}
      collapseAt={wedding ? heroHeight(height) - navTop : undefined}
      onCollapsedChange={setPastTop}
      subtitle={wedding ? null : t('planner.subtitle')}
      navTitle={wedding?.title?.trim() || t('planner.title')}
      back={false}
      trailing={
        // Wed (mockup): the plan's next step, asked in the chat. Never sends.
        <View {...tour.spot('wed')}>
          <AskWedButton
            variant="round"
            a11y="Ask Wed"
            about={{ kind: 'plan', label: 'My Wedding' }}
            ask="What should we book next?"
          />
        </View>
      }
    >
      {/* A plan belongs to an account: signed out, or not started yet, offer to start one. */}
      {!wedding && !view.loading && (
        <Animated.View entering={Motion.rise}>
          <StartPlanCard />
        </Animated.View>
      )}
      {!wedding && view.loading && <StateView state="loading" />}

      {/* 1. The top */}
      {wedding && (
        <WeddingHero view={view} days={days} onFamily={openFamily} spotRef={tour.spot('top').ref} />
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

      {/* 2. Your events, a day at a time */}
      {chosen.length > 0 && (
        <View style={styles.block} {...tour.place('events')}>
          <View style={styles.heading}>
            <View style={styles.titleRow}>
              <SectionTitle>{t('planner.eventsTitle')}</SectionTitle>
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
            {active.length > 0 && (
              <AppText variant="label" weight={400} color="text2" style={styles.pad}>
                {active.map((tradition) => localized(tradition.name)).join(' · ')}
              </AppText>
            )}
          </View>
          {tickets.map((ticket, index) => (
            <View key={ticket.slugs[0]} {...(index === 0 ? tour.spot('events') : {})}>
              <DayTicket date={ticket.date} entries={ticket.slugs.map(entry)} />
            </View>
          ))}
          {/* The picker offers the family's traditions' events, from the database */}
          {canEdit && (
            <PressableScale
              accessibilityRole="button"
              pressedScale={0.98}
              onPress={() => {
                selectionHaptic();
                openPicker();
              }}
              style={styles.addEvent}
            >
              <Icon name="add" size={20} color={Colors.text} weight="semibold" />
              <AppText weight={600}>{t('planner.addEvent')}</AppText>
            </PressableScale>
          )}
        </View>
      )}

      {/* 3. For your guests */}
      {!view.loading && (
        <View style={styles.block} {...tour.target('guests')}>
          <SectionTitle>{t('planner.forGuests')}</SectionTitle>
          <GuestTiles weddingId={wedding?.id ?? null} canEdit={canEdit} />
        </View>
      )}

      {/* 4. Planning together: Family (the faces at the top scroll here) */}
      {wedding && (
        <View
          style={styles.together}
          onLayout={(e) => {
            familyY.current = e.nativeEvent.layout.y;
          }}
        >
          <SectionTitle>{t('planTogether.sharedTitle')}</SectionTitle>
          <PlanTogether wedding={wedding} />
          <Suggestions wedding={wedding} events={chosen} />
          <FamilyShortlist weddingId={wedding.id} />
          <FamilyChats wedding={wedding} />
        </View>
      )}
      {touring && (
        <WeddingTour
          targets={tour}
          steps={['top', 'events', 'guests', 'wed']}
          scrollTo={scrollTo}
          onDone={endTour}
        />
      )}
    </NavScreen>
  );
}

const useStyles = makeStyles((Colors) => ({
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
  together: {
    gap: Spacing.lg,
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
  addEvent: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.borderInput,
  },
}));
