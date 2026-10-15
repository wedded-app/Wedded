import { useQueries } from '@tanstack/react-query';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, useFontScale } from '@/components/app-text';
import { Chip } from '@/components/chip';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Spacing } from '@/constants/theme';
import { fetchVendorPublicStats } from '@/data/vendor-stats';
import { fetchVendorMenus } from '@/data/vendor-menus';
import { useVendors, type VendorProfile } from '@/data/vendors';
import { compareRows, MAX_COMPARE } from '@/features/vendors/compare';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

/**
 * Compare (vision idea 12): up to three saved vendors side by side, so a
 * family deciding between halls sees price, seats, catering, alcohol, curfew
 * and parking in one place. `?vendors=slug,slug,...` (from Saved or the family
 * shortlist); chips at the top choose which three to show.
 */
export default function CompareScreen() {
  const styles = useStyles();
  const { t } = useLocale();
  const { vendors: param = '' } = useLocalSearchParams<{ vendors?: string }>();
  const slugs = param.split(',').filter(Boolean).slice(0, 10);
  const [picked, setPicked] = useState<string[]>(slugs.slice(0, MAX_COMPARE));
  const results = useVendors(slugs);
  const profiles = results.map((r) => r.data).filter((p): p is VendorProfile => !!p);
  const shown = picked
    .map((slug) => profiles.find((p) => p.slug === slug))
    .filter((p): p is VendorProfile => !!p);
  const stats = useQueries({
    queries: shown.map((vendor) => ({
      queryKey: ['vendor-public-stats', vendor.id],
      queryFn: () => fetchVendorPublicStats(vendor.id),
      staleTime: 60 * 60 * 1000,
    })),
  });
  const menus = useQueries({
    queries: shown.map((vendor) => ({
      queryKey: ['vendor-menus', vendor.id],
      queryFn: () => fetchVendorMenus(vendor.id),
    })),
  });
  // Very large text: one vendor per line reads better than squeezed columns
  const stacked = useFontScale() > 1.3;

  const toggle = (slug: string) => {
    selectionHaptic();
    setPicked((current) =>
      current.includes(slug)
        ? current.filter((s) => s !== slug)
        : current.length >= MAX_COMPARE
          ? [...current.slice(1), slug]
          : [...current, slug],
    );
  };

  let body;
  if (results.some((r) => r.isPending)) {
    body = <StateView state="loading" />;
  } else if (results.some((r) => r.isError)) {
    body = <StateView state="error" onRetry={() => results.forEach((r) => void r.refetch())} />;
  } else if (shown.length < 2) {
    body = <AppText color="text2">{t('compare.pickTwo')}</AppText>;
  } else {
    const rows = compareRows(
      shown,
      t,
      stats.map((s) => s.data),
      menus.map((m) => m.data),
    );
    body = (
      <View style={styles.table}>
        <View style={styles.row}>
          {shown.map((vendor) => (
            <Pressable
              key={vendor.id}
              accessibilityRole="link"
              onPress={() => router.push(`/v/${vendor.slug}` as Href)}
              style={({ pressed }) => [styles.cell, styles.head, pressed && styles.pressed]}
            >
              <AppText weight={700} color="primary">
                {localized(vendor.name)}
              </AppText>
            </Pressable>
          ))}
        </View>
        {rows.map((row) => (
          <View key={row.key} style={styles.group}>
            <AppText variant="label" weight={600} color="text2">
              {row.label}
            </AppText>
            <View style={stacked ? styles.stack : styles.row}>
              {row.values.map((value, i) => (
                <View key={shown[i].id} style={styles.cell}>
                  {stacked && (
                    <AppText variant="label" weight={600}>
                      {localized(shown[i].name)}
                    </AppText>
                  )}
                  <AppText color={value ? 'text' : 'text2'}>
                    {value ?? t('compare.notSaid')}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <NavScreen title={t('compare.title')}>
      {slugs.length > MAX_COMPARE && (
        <View style={styles.pickers}>
          <AppText color="text2">{t('compare.pickHint', { count: MAX_COMPARE })}</AppText>
          <View style={styles.chips}>
            {profiles.map((vendor) => (
              <Chip
                key={vendor.slug}
                label={localized(vendor.name)}
                selected={picked.includes(vendor.slug)}
                onPress={() => toggle(vendor.slug)}
              />
            ))}
          </View>
        </View>
      )}
      {body}
    </NavScreen>
  );
}

const useStyles = makeStyles((Colors) => ({
  pickers: {
    gap: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  table: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  stack: {
    gap: Spacing.sm,
  },
  group: {
    gap: Spacing.xs,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  cell: {
    // minWidth 0 lets the columns share the width instead of long names pushing them off screen
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    gap: 2,
  },
  head: {
    minHeight: 44,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
}));
