import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { ListRow, ListSection } from '@/components/list';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { StateView } from '@/components/state-view';
import { Spacing } from '@/constants/theme';
import { useVendors } from '@/data/vendors';
import { bilingual, localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/**
 * "Book which vendor?": opened by Book this vendor on a reel that shows
 * more than one vendor (the one who posted it and the ones tagged). Picking
 * one opens the Ask screen in its place, with the reel's event, so a family
 * is two taps from asking. `?vendors=` is their slugs, poster first, and
 * `?event=` the reel's event.
 */
export default function ReelBookScreen() {
  const { t, locale } = useLocale();
  const { vendors = '', event } = useLocalSearchParams<{ vendors?: string; event?: string }>();
  const slugs = useMemo(() => vendors.split(',').filter(Boolean), [vendors]);
  const profiles = useVendors(slugs);

  const ask = (vendorId: string) =>
    router.replace({ pathname: '/ask', params: event ? { vendorId, event } : { vendorId } });

  let content;
  if (slugs.length === 0 || profiles.some((p) => p.isError)) {
    content = (
      <StateView
        state="error"
        onRetry={
          slugs.length > 0
            ? () => profiles.forEach((p) => p.isError && void p.refetch())
            : undefined
        }
      />
    );
  } else if (profiles.some((p) => p.isPending)) {
    content = <StateView state="loading" />;
  } else {
    // A vendor no longer listed comes back null: leave them out
    const found = profiles.flatMap((p) => (p.data ? [p.data] : []));
    content = (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <AppText variant="title" accessibilityRole="header">
            {t('reels.bookWhich')}
          </AppText>
          <AppText color="text2">{t('reels.bookWhichBody')}</AppText>
        </View>
        {found.length === 0 ? (
          <AppText color="text2">{t('reels.bookNone')}</AppText>
        ) : (
          <ListSection>
            {found.map((vendor) => {
              const { primary } = bilingual(vendor.name, locale);
              const category = vendor.categories[0];
              const about = [category && localized(category.name, locale), vendor.city]
                .filter(Boolean)
                .join(' · ');
              return (
                <ListRow
                  key={vendor.id}
                  icon="storefront-outline"
                  title={primary.text}
                  titleLang={primary.lang}
                  titleVariant="bodyLg"
                  subtitle={about}
                  onPress={() => ask(vendor.id)}
                  accessibilityLabel={t('reels.bookVendor', { name: primary.text })}
                />
              );
            })}
          </ListSection>
        )}
      </ScrollView>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader onClose={() => router.canGoBack() && router.back()} />
      {content}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  intro: {
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
});
