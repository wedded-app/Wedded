import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { NavScreen } from '@/components/nav';
import { SearchButton } from '@/components/search-button';
import { StateView } from '@/components/state-view';
import { Spacing } from '@/constants/theme';
import type { EventNeed } from '@/data/reference';
import { useCategoryGroups } from '@/data/reference';
import { ChatButton } from '@/features/chat/chat-button';
import { SectionHeader } from '@/features/home/section-header';
import { useWeddingDraft } from '@/features/home/wedding-draft';
import { filtersForGuests } from '@/features/planner/find-for-plan';
import { usePlanView } from '@/features/planner/use-plan-view';
import { clearSearchFilters, setSearchFilters } from '@/features/search/search-filters';
import { VendorShelf } from '@/features/search/vendor-shelf';
import { browseKinds, isVenue, shelfKinds } from '@/features/search/vendors-tab';
import {
  KindsRow,
  NearPlace,
  RequestsCard,
  YourVendors,
} from '@/features/search/vendors-tab-parts';
import { BusinessButton, BusinessCard } from '@/features/vendor-join/business-entry';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

// Kinds in Browse categories, and shelves under the hall
const KINDS = 12;
const SHELVES = 3;

/**
 * The Vendors tab, where families find and book (browse first, 2026-11-08).
 * Under the title, "Browse vendors near Sacramento, CA" opens the location
 * sheet. Then search, Saved and Requests, Browse categories (round photos of
 * the kinds the family's events need most, with See all for every kind),
 * Start with the hall, a few small shelves of what's still to book, and the
 * Requests card. With a plan it follows the family's events and what they've
 * booked; without one, the main events of their tradition. Search, a kind's
 * results, All categories and Requests open on this tab's stack. Businesses
 * come in here too (2026-11-10): For business at the top left, where
 * business mode shows its label (one tap to the business side for someone
 * who runs one), and a card at the bottom.
 * /vendors
 */
export default function VendorsScreen() {
  const { t } = useLocale();
  const groups = useCategoryGroups();
  const view = usePlanView();
  const draft = useWeddingDraft();
  const { plan, chosen, events, needsByEvent, wedding } = view;

  const eventSlugs = (chosen.length > 0 ? chosen : events.filter((event) => event.isCore)).map(
    (event) => event.slug,
  );
  const date = plan.weddingDate || draft.date || null;
  const guestBand = draft.guestBand || null;
  const kinds = browseKinds(eventSlugs, needsByEvent, groups.data ?? [], KINDS);
  const shelves = shelfKinds(eventSlugs, needsByEvent, plan.booked, SHELVES + 1);
  const hall = shelves.find(isVenue) ?? null;
  const rest = shelves.filter((kind) => !isVenue(kind)).slice(0, SHELVES);

  // A kind's results, on the date and for the guests, as its shelf showed
  const seeAll = (kind: EventNeed) => {
    clearSearchFilters();
    setSearchFilters({ ...filtersForGuests(kind.groupSlug, guestBand), availableOn: date });
    router.push({ pathname: '/c/[category]', params: { category: kind.categorySlug } });
  };
  // A kind's photo: every vendor of that kind, no filters
  const browse = (kind: EventNeed) => {
    clearSearchFilters();
    router.push({ pathname: '/c/[category]', params: { category: kind.categorySlug } });
  };

  return (
    <NavScreen
      title={t('tabs.vendors')}
      subtitle={<NearPlace />}
      back={false}
      leading={<BusinessButton />}
      trailing={<ChatButton />}
    >
      <View style={styles.top}>
        <SearchButton
          onPress={() => router.navigate({ pathname: '/search', params: { focus: '1' } })}
        />
        <YourVendors weddingId={wedding?.id ?? ''} />
      </View>

      {view.isPending || groups.isPending ? (
        <StateView state="loading" />
      ) : view.isError && groups.isError ? (
        <StateView
          state="error"
          onRetry={() => void Promise.all([view.refetch(), groups.refetch()])}
        />
      ) : (
        <>
          {kinds.length > 0 && (
            <View style={styles.block}>
              <SectionHeader
                title={t('vendorsTab.browse')}
                link={t('home.seeAll')}
                onLink={() => router.push('/categories')}
              />
              <KindsRow kinds={kinds} onOpen={browse} />
            </View>
          )}

          {hall && (
            <VendorShelf
              kind={hall}
              title={t('vendorsTab.hallFirst')}
              subtitle={t('vendorsTab.hallFirstBody')}
              wide
              date={date}
              guestBand={guestBand}
              onSeeAll={() => seeAll(hall)}
            />
          )}
          {rest.map((kind) => (
            <VendorShelf
              key={kind.categorySlug}
              kind={kind}
              title={localized(kind.name)}
              date={date}
              guestBand={guestBand}
              onSeeAll={() => seeAll(kind)}
            />
          ))}
        </>
      )}

      <RequestsCard />
      <BusinessCard />
    </NavScreen>
  );
}

const styles = StyleSheet.create({
  top: {
    gap: Spacing.md,
  },
  block: {
    gap: Spacing.md,
  },
});
