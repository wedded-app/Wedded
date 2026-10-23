import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View, type ScrollView } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { CheckCircle } from '@/components/check-circle';
import { Chip } from '@/components/chip';
import { DateField } from '@/components/date-field';
import { FieldError } from '@/components/field-error';
import { groupIcon } from '@/components/group-icon';
import { Icon } from '@/components/icon';
import { ListRow, ListSection, SectionTitle } from '@/components/list';
import { NavScreen, useNavTop } from '@/components/nav';
import { PressableScale } from '@/components/pressable-scale';
import { StateView } from '@/components/state-view';
import { VaultIcon } from '@/components/vault-icon';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useGuests, useGuestSummary } from '@/data/guests';
import { useMemoryVault, useOpenMemoryVault } from '@/data/memory-vault';
import type { EventNeed, EventNeedsSection, TraditionEvent } from '@/data/reference';
import { formatDate, GUEST_BANDS } from '@/features/inquiry/inquiry-helpers';
import { openCounts, useWeddingSuggestions } from '@/data/wedding-suggestions';
import { FamilyChats } from '@/features/group-chat/family-chats';
import { totalsLine } from '@/features/guests/guest-helpers';
import { EventTicket } from '@/features/planner/event-ticket';
import { FamilyShortlist } from '@/features/planner/family-shortlist';
import { findForPlan } from '@/features/planner/find-for-plan';
import { essentialNeeds } from '@/features/planner/plan';
import { PlanTogether } from '@/features/planner/plan-together';
import {
  bookedNames,
  bookedText,
  stillNeedsText,
  unbookedNames,
} from '@/features/planner/still-needs';
import { Suggestions } from '@/features/planner/suggestions';
import { StartPlanCard } from '@/features/planner/start-plan-card';
import { usePlanView } from '@/features/planner/use-plan-view';
import { comingLine, whenLine } from '@/features/planner/wedding-tab';
import { WeddingTop } from '@/features/planner/wedding-top';
import { WebsiteRow } from '@/features/website/website-card';
import { AskWedButton } from '@/features/wed/ask-wed-button';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

type BookedVendors = Record<string, { slug: string; name: string }>;

/**
 * Wedding, the tab (the final look, 2026-10-23), in four parts:
 * 1. The two of you: the couple's names, the wedding's days and the days to
 *    go, and the faces of everyone planning, which open Family below.
 * 2. Your events as tickets, in ceremony order: the day, when and where,
 *    what each still needs in words, who's booked and how many are coming.
 *    A tap opens one to its date, guests and what to book (essential first,
 *    ticked off as they book, with a shortcut to find each). The events are
 *    picked in the "Your events" sheet (/plan-events).
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
  const suggestions = useWeddingSuggestions(wedding?.id ?? null);
  const suggested = openCounts(suggestions.data ?? []);
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
  const scroll = useRef<ScrollView>(null);
  const familyY = useRef<number | null>(null);
  const navTop = useNavTop();
  const openFamily = () => {
    if (familyY.current === null) return;
    scroll.current?.scrollTo({
      y: Math.max(0, familyY.current - navTop - Spacing.sm),
      animated: !reduceMotion,
    });
  };

  // Every event starts folded, so the page reads as one list; a tap opens one
  const [openSlugs, setOpen] = useState<string[]>([]);
  // Tapping an event on Home opens it here (?event=mehndi)
  const { event: openEvent } = useLocalSearchParams<{ event?: string }>();
  const [seenEvent, setSeenEvent] = useState<string | undefined>(undefined);
  if (openEvent !== seenEvent) {
    setSeenEvent(openEvent);
    if (openEvent && !openSlugs.includes(openEvent)) setOpen([...openSlugs, openEvent]);
  }
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
      done: done ? localized(done.name) : '',
      next: next ? localized(next.name) : null,
    });
    setTimeout(() => setOpen(next ? [next.slug] : []), 700);
  }

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
              suggested={suggested}
              guests={plan.guests?.[event.slug] ?? null}
              date={plan.eventDates?.[event.slug] ?? null}
              weddingDate={plan.weddingDate}
              when={whenLine(wedding?.eventTimes[event.slug], wedding?.eventPlaces[event.slug])}
              coming={comingLine(
                guestSummary.data?.find((s) => s.eventSlug === event.slug),
                t,
              )}
              canEdit={canEdit}
              open={openSlugs.includes(event.slug)}
              onToggle={() => toggleOpen(event.slug)}
              onComplete={() => eventCompleted(event.slug)}
              onToggleBooked={(category) => view.toggleBooked(event.slug, category)}
              onGuests={(band) => view.setEventGuests(event.slug, band)}
              onDate={(date) => view.setEventDate(event.slug, date)}
              vault={
                vault.data
                  ? {
                      id: vault.data.id,
                      count: vault.data.events.find((e) => e.slug === event.slug)?.count ?? 0,
                    }
                  : null
              }
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

/** One event: its ticket, and below it, once opened, its date, guests and what to book. */
function EventPlan({
  event,
  sections,
  booked,
  bookedVendors,
  suggested,
  guests,
  date,
  weddingDate,
  when,
  coming,
  canEdit,
  open,
  onToggle,
  onComplete,
  onToggleBooked,
  onGuests,
  onDate,
  vault,
}: {
  event: TraditionEvent;
  sections: EventNeedsSection[];
  booked: string[];
  bookedVendors: BookedVendors;
  /** Open suggestions per "event/category". */
  suggested: Record<string, number>;
  guests: string | null;
  /** This event's own day, yyyy-mm-dd; it goes into requests to vendors. */
  date: string | null;
  /** The wedding's date, on the ticket's stub until the event has its own. */
  weddingDate: string | null;
  /** When it starts and where, as the family typed it for guests. */
  when: string | null;
  /** How many are coming, from the RSVPs. */
  coming: string | null;
  canEdit: boolean;
  open: boolean;
  onToggle: () => void;
  /** Its last essential was just booked. */
  onComplete: () => void;
  onToggleBooked: (categorySlug: string) => void;
  onGuests: (band: string | null) => void;
  onDate: (date: string | null) => void;
  /** The wedding's Memory Vault once it's open, and how many photos and videos are from this event. */
  vault: { id: string; count: number } | null;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const [showNice, setShowNice] = useState(false);
  const essential = essentialNeeds(sections);
  const extras = sections.filter((s) => s.importance !== 'essential').flatMap((s) => s.needs);
  const done = essential.filter((need) => booked.includes(need.categorySlug)).length;
  const complete = essential.length > 0 && done === essential.length;
  const name = localized(event.name);
  // In words, not "0/6" (the final look, 2026-10-23)
  const stillNeeds = stillNeedsText(unbookedNames(essential, booked), t);
  const bookedLine = bookedText(
    bookedNames(
      [...essential, ...extras],
      booked,
      (category) => bookedVendors[`${event.slug}/${category}`]?.name ?? null,
    ),
    t,
  );
  // Before it has its own day, when it usually happens ("The night before")
  const whenShown = when ?? (!date && event.timing ? localized(event.timing) : null);

  const wasComplete = useRef(complete);
  useEffect(() => {
    if (complete && !wasComplete.current) onComplete();
    wasComplete.current = complete;
  }, [complete, onComplete]);

  const row = (need: EventNeed, isEssential: boolean) => (
    <NeedRow
      key={need.categorySlug}
      need={need}
      eventSlug={event.slug}
      booked={booked.includes(need.categorySlug)}
      bookedWith={bookedVendors[`${event.slug}/${need.categorySlug}`]?.name ?? null}
      suggested={suggested[`${event.slug}/${need.categorySlug}`] ?? 0}
      guests={guests}
      essential={isEssential}
      canEdit={canEdit}
      onToggle={() => onToggleBooked(need.categorySlug)}
    />
  );

  return (
    // The tickets fade in together, 200 ms
    <Animated.View entering={Motion.enter} layout={Motion.layout} style={styles.event}>
      <EventTicket
        slug={event.slug}
        name={name}
        date={date ?? weddingDate}
        when={whenShown}
        stillNeeds={stillNeeds}
        complete={complete}
        booked={bookedLine}
        coming={coming}
        open={open}
        onPress={() => {
          selectionHaptic();
          onToggle();
        }}
        accessibilityLabel={[
          name,
          date ? formatDate(date) : null,
          whenShown,
          stillNeeds,
          bookedLine,
          coming,
        ]
          .filter(Boolean)
          .join(', ')}
      />

      {open && (
        <Animated.View entering={Motion.enter} exiting={Motion.exit} style={styles.panel}>
          <View style={[styles.guests, styles.firstSection]}>
            <AppText variant="label" weight={600} color="text2">
              {t('planner.eventDateTitle', { event: name })}
            </AppText>
            {canEdit ? (
              <>
                <DateField
                  value={date}
                  onChange={(picked) => {
                    selectionHaptic();
                    onDate(picked);
                  }}
                  placeholder={date ? formatDate(date) : t('planner.eventDatePick')}
                />
                {date && (
                  <Button
                    variant="text"
                    label={t('planner.eventDateClear')}
                    onPress={() => onDate(null)}
                  />
                )}
              </>
            ) : (
              <AppText weight={600}>{date ? formatDate(date) : t('planner.eventDateNone')}</AppText>
            )}
            <AppText variant="caption" color="text2">
              {t('planner.eventDateHint')}
            </AppText>
            {/* The start time and place live with what guests see (Invitation details) */}
            {canEdit && (
              <Button
                variant="text"
                icon="time-outline"
                label={t('planner.ticket.timePlace')}
                onPress={() => router.push('/guest-details')}
              />
            )}
          </View>
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
          {/* Wed (mockup): hand the rest of this event's essentials to Wed. */}
          {done < essential.length && (
            <View style={styles.wedRow}>
              <AskWedButton
                variant="row"
                label={`Let Wed find the rest for the ${event.name.en}`}
                about={{ kind: 'event', id: event.slug, label: event.name.en }}
                ask={`Find the vendors we still need for the ${event.name.en}`}
              />
            </View>
          )}
          {canEdit && (
            <Pressable
              accessibilityRole="button"
              accessibilityHint={t('requests.post.hint')}
              onPress={() =>
                router.push({ pathname: '/request-new', params: { event: event.slug } })
              }
              style={({ pressed }) => [styles.more, pressed && styles.headPressed]}
            >
              <Icon name="megaphone-outline" size={17} color={Colors.primary} />
              <AppText weight={600} color="primary">
                {t('requests.post.fromPlan')}
              </AppText>
            </Pressable>
          )}
          {vault && (
            <Pressable
              accessibilityRole="link"
              onPress={() =>
                router.push({
                  pathname: '/vault/[id]',
                  params: { id: vault.id, event: event.slug },
                })
              }
              style={({ pressed }) => [styles.more, pressed && styles.headPressed]}
            >
              <VaultIcon size={17} color={Colors.primary} />
              <AppText weight={600} color="primary">
                {t('memoryVault.eventRow', { count: vault.count })}
              </AppText>
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
  suggested,
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
  /** Open suggestions for it, waiting for the family to decide. */
  suggested: number;
  /** The event's guest band, which Find turns into filters. */
  guests: string | null;
  essential: boolean;
  canEdit: boolean;
  onToggle: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const name = localized(need.name);

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
        {suggested > 0 && (
          <AppText variant="caption" color="primary" weight={600}>
            {t('suggestions.openCount', { count: suggested })}
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
  // A ticket, and its opened details just under it
  event: {
    gap: Spacing.sm,
  },
  panel: {
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    overflow: 'hidden',
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
  headPressed: {
    backgroundColor: Colors.rowPressed,
  },
  grow: {
    flex: 1,
    gap: 2,
  },
  guests: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  firstSection: {
    borderTopWidth: 0,
    paddingTop: Spacing.lg,
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
  wedRow: {
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
}));
