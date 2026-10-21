import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Chip } from '@/components/chip';
import { Icon, type IconName } from '@/components/icon';
import { NavScreen } from '@/components/nav';
import { SearchButton } from '@/components/search-button';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import type { EventNeed } from '@/data/reference';
import { useAllEventNeeds, useCategoryGroups, useHomeEvents } from '@/data/reference';
import { useMyRequests } from '@/data/requests';
import { useSavedVendors } from '@/data/saved';
import { useSession } from '@/features/auth/session';
import { ChatButton } from '@/features/chat/chat-button';
import { bookFirstNeeds } from '@/features/home/book-first';
import { SectionHeader } from '@/features/home/section-header';
import { VendorPhotoCards } from '@/features/home/vendor-photo-cards';
import { VendorTypeRow } from '@/features/home/vendor-type-row';
import { useWeddingDraft } from '@/features/home/wedding-draft';
import { LocationChip } from '@/features/location/location-chip';
import { filtersForGuests } from '@/features/planner/find-for-plan';
import { essentialNeeds } from '@/features/planner/plan-helpers';
import { usePlanView } from '@/features/planner/use-plan-view';
import { clearSearchFilters, setSearchFilters } from '@/features/search/search-filters';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

// One shelf per kind of vendor; past this, "All types" and search find the rest
const SHELVES = 6;
const VENUE_GROUP = 'venues';

/**
 * The Vendors tab (2026-10-21, after The Knot's): where they are and a search
 * box, then Saved and Your requests, the kinds of vendor, the family's main
 * events as chips, and a shelf of photo cards for each kind to book, the hall
 * first. Picking an event (Mehndi, Sangeet, Anand Karaj…) swaps the shelves
 * for what that event needs, on its own day, and hearts save for it. Search,
 * a kind's results and Requests open on this tab's stack. /vendors
 */
export default function VendorsScreen() {
  const styles = useStyles();
  const { t } = useLocale();
  const sections = useHomeEvents();
  const needs = useAllEventNeeds();
  const groups = useCategoryGroups();
  const view = usePlanView();
  const draft = useWeddingDraft();
  const [event, setEvent] = useState<string | null>(null);

  const coreEvents = (sections.data ?? [])
    .flatMap((section) => section.events)
    .filter((e) => e.isCore);
  const shelves: EventNeed[] =
    sections.data && needs.data
      ? event
        ? essentialNeeds(needs.data[event]).slice(0, SHELVES)
        : bookFirstNeeds(sections.data, needs.data, SHELVES)
      : [];
  const { plan } = view;
  const date = (event && plan.eventDates?.[event]) || plan.weddingDate || draft.date || null;
  const guestBand = (event && plan.guests?.[event]) || draft.guestBand || null;

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
        <LocationChip />
        <SearchButton
          onPress={() => router.navigate({ pathname: '/search', params: { focus: '1' } })}
        />
      </View>

      <YourVendors weddingId={view.wedding?.id ?? ''} />

      <View style={styles.block}>
        <SectionHeader
          title={t('vendorsTab.types')}
          link={t('home.seeAllTypes')}
          onLink={() => router.navigate('/search')}
        />
        {groups.isPending && <StateView state="loading" />}
        {groups.isError && <StateView state="error" onRetry={() => void groups.refetch()} />}
        {groups.data && <VendorTypeRow groups={groups.data} />}
      </View>

      {coreEvents.length > 0 && (
        <View style={styles.block}>
          <SectionHeader title={t('vendorsTab.forEvent')} />
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
              onPress={() => setEvent(null)}
            />
            {coreEvents.map((e) => (
              <Chip
                key={e.slug}
                label={localized(e.name)}
                role="radio"
                tone="ink"
                selected={event === e.slug}
                onPress={() => setEvent(e.slug)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {(sections.isPending || needs.isPending) && <StateView state="loading" />}
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
    </NavScreen>
  );
}

/**
 * Two cards side by side, like The Knot's "Your vendors" and "Booked": the
 * vendors they've saved (opens Saved) and what they've asked vendors for
 * (opens Requests). Signed out each says what it's for.
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
      <SummaryCard
        icon="heart"
        title={t('vendorsTab.saved')}
        line={
          signedIn && savedCount > 0
            ? t('vendorsTab.savedCount', { count: savedCount })
            : t('vendorsTab.savedNone')
        }
        onPress={() => router.push('/saved')}
      />
      <SummaryCard
        icon="megaphone-outline"
        title={t('vendorsTab.requests')}
        line={
          signedIn && openCount > 0
            ? t('vendorsTab.requestsCount', { count: openCount })
            : t('vendorsTab.requestsNone')
        }
        onPress={() => router.push('/requests')}
      />
    </View>
  );
}

function SummaryCard({
  icon,
  title,
  line,
  onPress,
}: {
  icon: IconName;
  title: string;
  line: string;
  onPress: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${line}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardWords}>
        <AppText variant="heading" weight={700} numberOfLines={1}>
          {title}
        </AppText>
        <View style={styles.cardLine}>
          <Icon name={icon} size={Sizes.iconSmall} color={Colors.primary} />
          <AppText variant="label" color="text2" style={styles.grow}>
            {line}
          </AppText>
        </View>
      </View>
      <Icon name="chevron-forward" size={18} color={Colors.chevron} weight="semibold" />
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
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  card: {
    flexGrow: 1,
    flexBasis: 150,
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.photo,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    boxShadow: `inset 0 0 0 1px ${Colors.border}`,
  },
  pressed: {
    backgroundColor: Colors.rowPressed,
  },
  cardWords: {
    flex: 1,
    gap: Spacing.xs,
  },
  cardLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  grow: {
    flex: 1,
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
