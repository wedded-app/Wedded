import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, View, type ScrollViewInstance } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { ListRow, ListSection, SectionTitle } from '@/components/list';
import { NavScreen, useNavTop } from '@/components/nav';
import { PressableScale } from '@/components/pressable-scale';
import { StateView } from '@/components/state-view';
import { VaultIcon } from '@/components/vault-icon';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useGuests, useGuestSummary } from '@/data/guests';
import { useMemoryVault, useOpenMemoryVault } from '@/data/memory-vault';
import { FamilyChats } from '@/features/group-chat/family-chats';
import { totalsLine } from '@/features/guests/guest-helpers';
import { FamilyShortlist } from '@/features/planner/family-shortlist';
import { EventPlan } from '@/features/planner/event-plan';
import { PlanTogether } from '@/features/planner/plan-together';
import { Suggestions } from '@/features/planner/suggestions';
import { StartPlanCard } from '@/features/planner/start-plan-card';
import { usePlanDays } from '@/features/planner/use-plan-days';
import { usePlanView } from '@/features/planner/use-plan-view';
import { comingLine, whenLine } from '@/features/planner/wedding-tab';
import { WeddingTop } from '@/features/planner/wedding-top';
import { WebsiteRow } from '@/features/website/website-card';
import { AskWedButton } from '@/features/wed/ask-wed-button';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

/**
 * Wedding, the tab (the final look, 2026-10-23), in four parts:
 * 1. The two of you: the couple's names, the wedding's days and the days to
 *    go, and the faces of everyone planning, which open Family below.
 * 2. Your events as tickets, in ceremony order: the day, when and where,
 *    what each still needs in words, who's booked and how many are coming.
 *    A tap opens the event's own page (/plan-event/{slug}): its day, time
 *    and guests, and what to book as tiles. The events are picked in the
 *    "Your events" sheet (/plan-events).
 * 3. For your guests: Guests, the website, invitation cards, the Memory Vault.
 * 4. Planning together: Family and their roles, suggestions, the family
 *    shortlist to vote on, and the family chats.
 * Saved to the account and shared with family (Plan together,
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
  // Only the owner and editors see the guest list: it's other people's numbers
  const guests = useGuests(canEdit ? (wedding?.id ?? null) : null);
  const guestSummary = useGuestSummary(canEdit ? (wedding?.id ?? null) : null);
  const vault = useMemoryVault(wedding?.id ?? null);
  const openVault = useOpenMemoryVault();
  const openTheVault = () => {
    if (vault.data) return router.push({ pathname: '/vault/[id]', params: { id: vault.data.id } });
    if (!wedding || openVault.isPending) return;
    openVault.mutate(wedding.id, {
      onSuccess: (id) => {
        successHaptic();
        router.push({ pathname: '/vault/[id]', params: { id } });
      },
    });
  };

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
      // With a wedding, the couple's names are the page's title (WeddingTop)
      title={wedding ? null : t('planner.title')}
      subtitle={wedding ? null : t('planner.subtitle')}
      navTitle={wedding?.title?.trim() || t('planner.title')}
      back={false}
      trailing={
        // Wed (mockup): the plan's next step, asked in the chat. Never sends.
        <AskWedButton
          variant="round"
          a11y="Ask Wed"
          about={{ kind: 'plan', label: 'My Wedding' }}
          ask="What should we book next?"
        />
      }
    >
      {/* A plan belongs to an account: signed out, or not started yet, offer to start one. */}
      {!wedding && !view.loading && (
        <Animated.View entering={Motion.rise}>
          <StartPlanCard />
        </Animated.View>
      )}
      {!wedding && view.loading && <StateView state="loading" />}

      {/* 1. The two of you */}
      {wedding && <WeddingTop view={view} onFamily={openFamily} />}

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

      {/* 2. Your events, a ticket each */}
      {chosen.length > 0 && (
        <View style={styles.block}>
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
          {chosen.map((event) => (
            <EventPlan
              key={event.slug}
              event={event}
              sections={needsByEvent[event.slug] ?? []}
              booked={plan.booked[event.slug] ?? []}
              bookedVendors={wedding?.bookedVendors ?? {}}
              date={days.state.dates[event.slug] ?? null}
              when={whenLine(wedding?.eventTimes[event.slug], wedding?.eventPlaces[event.slug])}
              coming={comingLine(
                guestSummary.data?.find((s) => s.eventSlug === event.slug),
                t,
              )}
            />
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
        <View style={styles.block}>
          <SectionTitle>{t('planner.forGuests')}</SectionTitle>
          <ListSection>
            {canEdit && (
              <ListRow
                icon="people-outline"
                title={t('guests.title')}
                subtitle={totalsLine(guests.data ?? [], t) ?? t('guests.planEntryBody')}
                onPress={() => router.push('/guests')}
              />
            )}
            {wedding && <WebsiteRow weddingId={wedding.id} />}
            <ListRow
              icon="mail-outline"
              title={t('cards.planEntry')}
              subtitle={t('cards.planEntryBody')}
              onPress={() => router.push('/cards')}
            />
            {/* The Memory Vault: the couple opens it, then everyone in the wedding sees it */}
            {wedding && !vault.isPending && (vault.data || canEdit) && (
              <ListRow
                leading={
                  <View style={styles.rowIcon}>
                    <VaultIcon size={Sizes.icon} color={Colors.primary} />
                  </View>
                }
                title={vault.data ? t('memoryVault.title') : t('memoryVault.openTitle')}
                subtitle={
                  vault.data
                    ? t('memoryVault.count', { count: vault.data.itemCount })
                    : openVault.isPending
                      ? t('memoryVault.opening')
                      : t('memoryVault.openBody')
                }
                onPress={openTheVault}
              />
            )}
          </ListSection>
          {openVault.isError && <FieldError message={t('memoryVault.openFailed')} />}
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
  rowIcon: {
    width: Sizes.rowIcon,
    alignItems: 'center',
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
