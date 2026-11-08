import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { SectionTitle } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { SearchField } from '@/components/search-field';
import { StateView } from '@/components/state-view';
import { makeStyles, Sizes, Spacing } from '@/constants/theme';
import { useCategories, useCategoryGroups } from '@/data/reference';
import { KindCircle } from '@/features/search/kind-circle';
import { clearSearchFilters } from '@/features/search/search-filters';
import { filterGroups } from '@/features/search/vendors-tab';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

const COLUMNS = 3;

/**
 * All categories (2026-11-08), from Browse categories' See all: every kind
 * of vendor from the database, group by group (Venues, Food, Music...), as
 * round photos three across, with a search that also knows other names for
 * them ("mua", "haar"). A kind opens its results. /categories
 */
export default function CategoriesScreen() {
  const styles = useStyles();
  const { t } = useLocale();
  const { width } = useWindowDimensions();
  const groups = useCategoryGroups();
  const categories = useCategories();
  const [text, setText] = useState('');

  const aliases = useMemo(
    () =>
      Object.fromEntries(
        (categories.data ?? []).map((category) => [category.slug, category.aliases]),
      ),
    [categories.data],
  );
  const shown = filterGroups(groups.data ?? [], aliases, text);
  const cell = Math.floor((width - 2 * Sizes.pageGutter - (COLUMNS - 1) * Spacing.md) / COLUMNS);
  const size = Math.min(88, cell - Spacing.sm);

  const open = (slug: string) => {
    clearSearchFilters();
    router.push({ pathname: '/c/[category]', params: { category: slug } });
  };

  return (
    <NavScreen title={t('categories.title')}>
      <SearchField value={text} onChangeText={setText} placeholder={t('categories.search')} />

      {groups.isPending && <StateView state="loading" />}
      {groups.isError && <StateView state="error" onRetry={() => void groups.refetch()} />}
      {groups.data && shown.length === 0 && (
        <StateView state="empty" message={t('categories.none', { text: text.trim() })} />
      )}

      {shown.map((group) => (
        <View key={group.slug} style={styles.group}>
          <SectionTitle>{localized(group.name)}</SectionTitle>
          <View style={styles.grid}>
            {group.categories.map((category) => (
              <KindCircle
                key={category.slug}
                kind={{
                  categorySlug: category.slug,
                  name: category.name,
                  groupSlug: category.groupSlug,
                }}
                size={size}
                width={cell}
                onPress={() => open(category.slug)}
              />
            ))}
          </View>
        </View>
      ))}
    </NavScreen>
  );
}

const useStyles = makeStyles(() => ({
  group: {
    gap: Spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.md,
    rowGap: Spacing.lg + 2,
  },
}));
