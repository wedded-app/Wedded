import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { ListRow, ListSection } from '@/components/list';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { StateView } from '@/components/state-view';
import { Sizes, Spacing, useColors } from '@/constants/theme';
import { useHomeEvents } from '@/data/reference';
import { useSavedEventsFor, useSaveVendor } from '@/data/saved';
import { type LocalizedText, localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { saveHaptic } from '@/lib/haptics';

/**
 * "Save to which event?" (vision §6: Save, then "Save to which event?").
 * Opened as a modal by useSaveVendor().toggleSave when there's no event
 * context, e.g. from Search or a vendor profile. `?vendorId=` is required.
 */
export default function SaveVendorScreen() {
  const Colors = useColors();
  const { t } = useLocale();
  const { vendorId = '' } = useLocalSearchParams<{ vendorId?: string }>();
  const events = useHomeEvents();
  const savedFor = useSavedEventsFor(vendorId);
  const { saveFor, saving } = useSaveVendor();
  const [error, setError] = useState<string>();

  async function choose(eventSlug: string | null) {
    setError(undefined);
    try {
      await saveFor({ vendorId, eventSlug });
      saveHaptic();
      if (router.canGoBack()) router.back();
    } catch {
      setError(t('saved.saveFailed'));
    }
  }

  let content;
  if (!vendorId || events.isError) {
    content = <StateView state="error" onRetry={vendorId ? () => events.refetch() : undefined} />;
  } else if (events.isPending) {
    content = <StateView state="loading" />;
  } else {
    const options: { slug: string | null; name: LocalizedText }[] = [
      ...events.data.flatMap((section) => section.events),
      { slug: null, name: { en: t('saved.notSure') } },
    ];
    content = (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <AppText variant="title" accessibilityRole="header">
            {t('saveVendor.title')}
          </AppText>
          <AppText color="text2">{t('saveVendor.subtitle')}</AppText>
        </View>
        {error && <FieldError message={error} />}
        <ListSection>
          {options.map((option) => {
            const alreadySaved = savedFor.includes(option.slug);
            const name = localized(option.name);
            return (
              <ListRow
                key={option.slug ?? 'not-sure'}
                title={name}
                titleVariant="bodyLg"
                subtitle={alreadySaved ? t('saveVendor.alreadySaved') : undefined}
                chevron={false}
                onPress={alreadySaved || saving ? undefined : () => choose(option.slug)}
                accessibilityLabel={
                  alreadySaved ? `${name}, ${t('saveVendor.alreadySaved')}` : name
                }
                trailing={
                  <Icon
                    name={alreadySaved ? 'heart' : 'heart-outline'}
                    size={Sizes.icon}
                    color={Colors.primary}
                  />
                }
              />
            );
          })}
        </ListSection>
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
