import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { LanguageToggle } from '@/components/language-toggle';
import { SectionTitle } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { SearchButton } from '@/components/search-button';
import { StateView } from '@/components/state-view';
import { Sizes, Spacing, useColors } from '@/constants/theme';
import { useFeed } from '@/data/feed';
import { useCategoryGroups, useHomeEvents } from '@/data/reference';
import { useCategoryVendorCounts } from '@/data/vendors';
import { EventCarousel } from '@/features/home/event-carousel';
import { HomeHero } from '@/features/home/home-hero';
import { BENTO_TILES, VendorTypeBento } from '@/features/home/vendor-type-bento';
import { LocationChip } from '@/features/location/location-chip';
import { useLocale } from '@/i18n/locale-context';

/**
 * S4 Home, kept to four things so it never overwhelms: the family's wedding
 * (the countdown and the one thing to book next, on maroon silk), search,
 * "What do you need?" as a bento grid of the main kinds of vendor, and the
 * family's events as swipeable cards with their names in Gurmukhi. Real
 * weddings live in Reels and founding vendors behind a link at the bottom.
 */
export default function HomeScreen() {
  const Colors = useColors();
  const { t } = useLocale();
  const router = useRouter();
  const groups = useCategoryGroups();
  const counts = useCategoryVendorCounts();
  const { data: sections, status, refetch } = useHomeEvents();
  const feed = useFeed();
  const [refreshing, setRefreshing] = useState(false);
  const posts = feed.data ?? [];

  // Pull to refresh fetches again even though events are cached for a day.
  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([groups.refetch(), counts.refetch(), refetch(), feed.refetch()]);
    setRefreshing(false);
  }

  const startTyping = () => router.navigate({ pathname: '/search', params: { focus: '1' } });

  return (
    <NavScreen
      title={t('app.name')}
      back={false}
      trailing={<LanguageToggle />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.chevron}
          colors={[Colors.primary]}
        />
      }
    >
      <HomeHero />

      <View style={styles.find}>
        <SearchButton onPress={startTyping} />
        <LocationChip />
      </View>

      <View style={styles.block}>
        <SectionHeader
          title={t('home.whatDoYouNeed')}
          link={(groups.data?.length ?? 0) > BENTO_TILES ? t('home.seeAllTypes') : t('home.seeAll')}
          onLink={() => router.navigate('/search')}
        />
        {groups.isPending && <StateView state="loading" />}
        {groups.isError && <StateView state="error" onRetry={() => void groups.refetch()} />}
        {groups.data && (
          <VendorTypeBento groups={groups.data} counts={counts.data ?? {}} posts={posts} />
        )}
      </View>

      <View style={styles.block}>
        <SectionHeader
          title={t('home.planByEvent')}
          link={t('home.myEvents')}
          onLink={() => router.push('/plan')}
        />
        {status === 'pending' && <StateView state="loading" />}
        {status === 'error' && <StateView state="error" onRetry={() => void refetch()} />}
        {status === 'success' && sections.length === 0 && (
          <StateView state="empty" icon="calendar-outline" message={t('home.empty')} />
        )}
        {sections && sections.length > 0 && <EventCarousel sections={sections} posts={posts} />}
      </View>

      <View style={styles.footer}>
        <FooterLink
          label={t('home.foundingWall')}
          onPress={() => router.push('/founding')}
          strong
        />
        <FooterLink label={t('home.forVendors')} onPress={() => router.push('/for-vendors')} />
      </View>
    </NavScreen>
  );
}

function SectionHeader({
  title,
  link,
  onLink,
}: {
  title: string;
  link: string;
  onLink: () => void;
}) {
  return (
    <View style={styles.titleRow}>
      <SectionTitle>{title}</SectionTitle>
      <Pressable
        accessibilityRole="link"
        onPress={onLink}
        hitSlop={12}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <AppText weight={600} color="primary">
          {link}
        </AppText>
      </Pressable>
    </View>
  );
}

function FooterLink({
  label,
  onPress,
  strong = false,
}: {
  label: string;
  onPress: () => void;
  strong?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
    >
      <AppText weight={strong ? 600 : 400} color={strong ? 'primary' : 'text2'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  find: {
    gap: Spacing.md,
  },
  block: {
    gap: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingRight: Spacing.xs,
  },
  footer: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  footerLink: {
    minHeight: Sizes.tapTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  pressed: {
    opacity: 0.5,
  },
});
