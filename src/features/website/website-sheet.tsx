import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { Glass } from '@/components/glass';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { StateView } from '@/components/state-view';
import { Sizes, Spacing } from '@/constants/theme';
import type { SitePage } from '@/data/website';
import { useLocale } from '@/i18n/locale-context';

import { useSiteFonts } from './fonts';
import { useWebsite } from './use-website';

/** Back to the builder, or to it when the sheet was opened from a link. */
export function closeWebsiteSheet() {
  if (router.canGoBack()) router.back();
  else router.replace('/website');
}

/**
 * One of the builder's sheets: a title, the family's site once it's loaded
 * (only owners and editors get the form), and the form.
 */
export function WebsiteSheet({
  title,
  children,
}: {
  title: string;
  children: (site: SitePage, weddingId: string) => ReactNode;
}) {
  const { t } = useLocale();
  const website = useWebsite();
  const fontsReady = useSiteFonts();

  let content;
  if (website.status === 'ready' && fontsReady && website.canEdit) {
    content = children(website.site, website.weddingId);
  } else if (website.status === 'error') {
    content = <StateView state="error" onRetry={website.retry} />;
  } else if (
    website.status === 'noWedding' ||
    website.status === 'cantMake' ||
    (website.status === 'ready' && !website.canEdit)
  ) {
    content = <StateView state="empty" icon="globe-outline" message={t('website.cantMake')} />;
  } else {
    content = <StateView state="loading" />;
  }
  return (
    <Screen edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <SheetHeader onClose={closeWebsiteSheet} title={title} />
      </View>
      {content}
    </Screen>
  );
}

/** The scrolling form and its Save bar, clear of the keyboard. */
export function SheetForm({
  children,
  saveLabel,
  onSave,
  saving,
  disabled,
  error,
}: {
  children: ReactNode;
  saveLabel?: string;
  onSave: () => void;
  saving?: boolean;
  disabled?: boolean;
  error?: string | null;
}) {
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      <Glass style={[styles.bar, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        {error ? <FieldError message={error} /> : null}
        <Button
          label={saveLabel ?? t('website.save')}
          onPress={onSave}
          loading={saving}
          disabled={disabled}
        />
      </Glass>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
  },
  header: {
    paddingHorizontal: Sizes.pageGutter,
  },
  fill: {
    flex: 1,
  },
  content: {
    gap: Spacing.xl,
    paddingHorizontal: Sizes.pageGutter,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl,
  },
  bar: {
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    paddingHorizontal: Sizes.pageGutter,
  },
});
