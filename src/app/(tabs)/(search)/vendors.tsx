import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Chip } from '@/components/chip';
import { NavScreen } from '@/components/nav';
import { SearchButton } from '@/components/search-button';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Sizes, Spacing } from '@/constants/theme';
import type { EventNeed } from '@/data/reference';
import { useAllEventNeeds, useCategoryGroups, useHomeEvents } from '@/data/reference';
import { useMyRequests } from '@/data/requests';
import { useSavedVendors } from '@/data/saved';
import { useSession } from '@/features/auth/session';
import { ChatButton } from '@/features/chat/chat-button';
import { bookFirstNeeds } from '@/features/home/book-first';
import { stubParts } from '@/features/home/greeting';
import { SectionHeader } from '@/features/home/section-header';
import { VendorPhotoCards } from '@/features/home/vendor-photo-cards';
import { useWeddingDraft } from '@/features/home/wedding-draft';
import { LocationChip } from '@/features/location/location-chip';
import { filtersForGuests } from '@/features/planner/find-for-plan';
import { essentialNeeds } from '@/features/planner/plan-helpers';
import { usePlanView } from '@/features/planner/use-plan-view';
import { clearSearchFilters, setSearchFilters } from '@/features/search/search-filters';
import {
  BookedRows,
  KindsAccordion,
  NeedTiles,
  RequestsCard,
} from '@/features/search/vendors-tab-parts';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

// One shelf per kind of vendor; past this, Every kind of vendor and search find the rest
const SHELVES = 6;
const VENUE_GROUP = 'venues';

/**
 * The Vendors tab, where families find and book (the final look, 2026-10-23;
 * canvas board "3 · Vendors"). Search and where you are, then what you saved
 * and the offers waiting, then the family's events as chips: picking one
 * restacks the tab for that day. With a plan it starts on the first event and
 * shows what that event still needs as photo tiles (how many are free that
 * day), who's already booked, and a shelf of vendors for each kind still to
 * book. Then every kind of vendor, group by group, and Requests. Search, a
 * kind's results and Requests open on this tab's stack. /vendors
 */
export default function VendorsScreen() {
  const styles = useStyles();
  const { t } = useLocale();
  const sections = useHomeEvents();
  const needs = useAllEventNeeds();
  const groups = useCategoryGroups();
  const view = usePlanView();
  const draft = useWeddingDraft();
  const { plan, chosen, wedding } = view;
  // With a plan it opens on the first of the family's events; a chip changes it
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const event = picked === undefined ? (chosen[0]?.slug ?? null) : picked;

  const coreEvents = (sections.data ?? [])
    .flatMap((section) => section.events)
    .filter((e) => e.isCore);
  const chipEvents: { slug: string; name: string }[] = (
    chosen.length > 0 ? chosen : coreEvents
  ).map((e) => ({ slug: e.slug, name: localized(e.name) }));
  const date = (event && plan.eventDates?.[event]) || plan.weddingDate || draft.date || null;
  const guestBand = (event && plan.guests?.[event]) || draft.guestBand || null;
  const stub = stubParts(date);
  const dayLabel = stub
    ? `${stub.month.charAt(0)}${stub.month.slice(1).toLowerCase()} ${stub.day}`
    : null;
  const eventName = chipEvents.find((e) => e.slug === event)?.name ?? '';

  const planned = !!event && chosen.some((e) => e.slug === event);
  const essentials = event && needs.data ? essentialNeeds(needs.data[event]) : [];
  const booked = event ? (plan.booked[event] ?? []) : [];
  const stillNeeds = essentials.filter((need) => !booked.includes(need.categorySlug));
  const bookedRows = essentials
    .filter((need) => booked.includes(need.categorySlug))
    .map((need) => ({
      key: need.categorySlug,
      kind: localized(need.name),
      vendor: wedding?.bookedVendors?.[`${event}/${need.categorySlug}`] ?? null,
    }));

  const shelves: EventNeed[] =
    sections.data && needs.data
      ? event
        ? (planned ? stillNeeds : essentials).slice(0, SHELVES)
        : bookFirstNeeds(sections.data, needs.data, SHELVES)
      : [];

  const seeAll = (need: EventNeed) => {
    clearSearchFilters();
    setSearchFilters({ ...filtersForGuests(need.groupSlug, guestBand), availableOn: date });
    router.push({ pathname: '/c/[category]', params: { category: need.categorySlug } });
  };

  const shelf = (need: EventNeed) => (
    <VendorPhotoCards
      key={`${event ?? 'all'}-${need.categorySlug}`}
      title={localized(need.name)}
      link={t('home.seeAll')}
      onLink={() => seeAll(need)}
      categorySlug={need.categorySlug}
      groupSlug={need.groupSlug}
      eventSlug={event ?? undefined}
      date={date}
      guestBand={guestBand}
    />
  );
  // Before an event is picked the hall comes first, set apart, since it sets the date
  const [first, ...rest] = shelves;
  const hallFirst = !event && first?.groupSlug === VENUE_GROUP;

  return (
    <NavScreen title={t('tabs.vendors')} back={false} trailing={<ChatButton />}>
      <View style={styles.find}>
        <SearchButton
          onPress={() => router.navigate({ pathname: '/search', params: { focus: '1' } })}
        />
        <LocationChip />
      </View>

      <YourVendors weddingId={wedding?.id ?? ''} />

      {chipEvents.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.bleed}
          contentContainerStyle={styles.track}
        >
          <Chip
            label={t('vendorsTab.allEvents')}
            role="radio"
            tone="ink"
            selected={event === null}
            onPress={() => setPicked(null)}
          />
          {chipEvents.map((e) => {
            const day = stubParts(plan.eventDates?.[e.slug] ?? null);
            return (
              <Chip
                key={e.slug}
                label={
                  day
                    ? `${e.name} · ${day.month.charAt(0)}${day.month.slice(1).toLowerCase()} ${day.day}`
                    : e.name
                }
                role="radio"
                tone="ink"
                selected={event === e.slug}
                onPress={() => setPicked(e.slug)}
              />
            );
          })}
        </ScrollView>
      )}

      {(sections.isPending || needs.isPending) && <StateView state="loading" />}

      {planned && (
        <View style={styles.block}>
          <SectionHeader
            title={
              stillNeeds.length > 0
                ? t('vendorsTab.stillNeeds', { event: eventName })
                : t('vendorsTab.allSetTitle', { event: eventName })
            }
          />
          {stillNeeds.length > 0 ? (
            <NeedTiles
              needs={stillNeeds.slice(0, 4)}
              date={date}
              dayLabel={dayLabel}
              guestBand={guestBand}
              onOpen={seeAll}
            />
          ) : (
            <View style={styles.allSet}>
              <AppText>{t('vendorsTab.allSetBody', { event: eventName })}</AppText>
            </View>
          )}
        </View>
      )}

      {planned && bookedRows.length > 0 && (
        <View style={styles.block}>
          <AppText variant="caption" weight={600} color="text2" style={styles.caps}>
            {t('vendorsTab.bookedFor', { event: eventName }).toUpperCase()}
          </AppText>
          <BookedRows rows={bookedRows} />
        </View>
      )}

      {hallFirst ? (
        <View style={styles.panel}>
          <View style={styles.panelWords}>
            <AppText variant="section" accessibilityRole="header">
              {t('vendorsTab.hallFirst')}
            </AppText>
            <AppText color="text2">{t('vendorsTab.hallFirstBody')}</AppText>
          </View>
          {shelf(first)}
        </View>
      ) : (
        first && shelf(first)
      )}
      {rest.map(shelf)}

      <View style={styles.block}>
        <SectionHeader title={t('vendorsTab.everyKind')} />
        {groups.isPending && <StateView state="loading" />}
        {groups.isError && <StateView state="error" onRetry={() => void groups.refetch()} />}
        {groups.data && <KindsAccordion groups={groups.data} />}
      </View>

      <RequestsCard />
    </NavScreen>
  );
}

/**
 * Two numbers side by side: the vendors saved (opens Saved) and the offers
 * and requests waiting (opens Requests). Signed out each says what it's for.
 */
function YourVendors({ weddingId }: { weddingId: string }) {
  const styles = useStyles();
  const { t } = useLocale();
  const { status } = useSession();
  const signedIn = status === 'signedIn';
  const saves = useSavedVendors();
  const requests = useMyRequests(weddingId);
  const savedCount = new Set((saves.data ?? []).map((save) => save.vendorId)).size;
  const openCount = (requests.data ?? []).filter((r) => r.status === 'open' && !r.expired).length;

  return (
    <View style={styles.cards}>
      <CountCard
        number={signedIn ? String(savedCount) : '0'}
        label={t('vendorsTab.saved')}
        spoken={
          signedIn && savedCount > 0
            ? t('vendorsTab.savedCount', { count: savedCount })
            : t('vendorsTab.savedNone')
        }
        onPress={() => router.push('/saved')}
      />
      <CountCard
        number={signedIn ? String(openCount) : '0'}
        label={t('vendorsTab.requests')}
        spoken={
          signedIn && openCount > 0
            ? t('vendorsTab.requestsCount', { count: openCount })
            : t('vendorsTab.requestsNone')
        }
        onPress={() => router.push('/requests')}
      />
    </View>
  );
}

function CountCard({
  number,
  label,
  spoken,
  onPress,
}: {
  number: string;
  label: string;
  spoken: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${spoken}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <AppText weight={700} style={styles.number} maxFontSizeMultiplier={1.3}>
        {number}
      </AppText>
      <AppText variant="caption" weight={600} color="text2" style={styles.caps}>
        {label.toUpperCase()}
      </AppText>
    </Pressable>
  );
}

const useStyles = makeStyles((Colors) => ({
  find: {
    gap: Spacing.xs,
  },
  block: {
    gap: Spacing.md,
  },
  // Chips run to the screen edges while the first one lines up with the page
  bleed: {
    marginHorizontal: -Sizes.pageGutter,
  },
  track: {
    gap: Spacing.sm,
    paddingHorizontal: Sizes.pageGutter,
  },
  cards: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  card: {
    flex: 1,
    gap: 2,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.photo,
    borderCurve: 'continuous',
    boxShadow: `inset 0 0 0 1px ${Colors.border}`,
  },
  pressed: {
    backgroundColor: Colors.rowPressed,
  },
  number: {
    fontSize: 30,
    lineHeight: 34,
  },
  caps: {
    letterSpacing: 0.6,
  },
  allSet: {
    padding: Spacing.lg,
    borderRadius: Radius.photo,
    borderCurve: 'continuous',
    backgroundColor: Colors.successTint,
  },
  // The warm panel around the hall shelf; its cards stop at the panel's edges
  panel: {
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Sizes.pageGutter,
    marginHorizontal: -Spacing.xs,
    overflow: 'hidden',
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.sand,
  },
  panelWords: {
    gap: Spacing.xs,
  },
}));
