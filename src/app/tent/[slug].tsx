import * as Print from 'expo-print';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { QrCode } from '@/components/qr-code';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { SITE_URL_IS_PLACEHOLDER, siteLink } from '@/constants/links';
import { BorderWidth, Palettes, Radius, Spacing } from '@/constants/theme';
import { useVendor } from '@/data/vendors';
import { tableTentHtml, type TableTent } from '@/features/tent/table-tent';
import { useLocale } from '@/i18n/locale-context';

// The preview is the printed page: white paper whatever the phone's appearance.
const Colors = Palettes.light;

const QR_SIZE = 200;

/**
 * The printed QR table tent a founding vendor gets for their front desk
 * (vision §13 demo item 5, §9 "What the vendor gets"). For the founders, not
 * linked from the app: /tent/{slug}. The QR code opens the vendor's web page.
 */
export default function TableTentScreen() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const { t } = useLocale();
  const vendor = useVendor(slug);
  const [printFailed, setPrintFailed] = useState(false);

  if (vendor.isPending || vendor.isError || !vendor.data) {
    return (
      <Screen edges={['top', 'bottom']}>
        <BackButton />
        {vendor.isPending ? (
          <StateView state="loading" />
        ) : vendor.isError ? (
          <StateView state="error" onRetry={() => void vendor.refetch()} />
        ) : (
          <StateView state="empty" icon="storefront-outline" message={t('vendor.notFound')} />
        )}
      </Screen>
    );
  }

  const v = vendor.data;
  const url = siteLink(`/v/${v.slug}`);
  const tent: TableTent = {
    url,
    name: v.name.en,
    founding:
      v.foundingNumber != null ? t('vendor.foundingNumber', { number: v.foundingNumber }) : null,
    scan: t('tent.scan'),
    findUs: t('tent.findUs', { app: t('app.name') }),
  };

  async function print() {
    setPrintFailed(false);
    const html = tableTentHtml(tent);
    try {
      if (Platform.OS === 'web') {
        // expo-print on the web prints the current page, not this HTML.
        const page = globalThis.open('', '_blank');
        if (!page) throw new Error('Pop-up blocked');
        page.document.write(html);
        page.document.close();
        page.focus();
        page.print();
      } else {
        await Print.printAsync({ html });
      }
    } catch {
      setPrintFailed(true);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton />
        <View style={styles.intro}>
          <AppText variant="title" accessibilityRole="header">
            {t('tent.title')}
          </AppText>
          <AppText color="text2">{t('tent.intro', { name: v.name.en })}</AppText>
        </View>

        {SITE_URL_IS_PLACEHOLDER && <FieldError message={t('tent.placeholder')} />}

        {/* One side of the tent, as it prints. */}
        <View style={styles.preview}>
          <AppText color="text2" style={styles.center}>
            {tent.findUs}
          </AppText>
          {tent.founding && (
            <AppText weight={700} color="kesari" style={styles.center}>
              {tent.founding}
            </AppText>
          )}
          <AppText variant="title" color="primary" style={styles.center}>
            {tent.name}
          </AppText>
          <QrCode value={url} size={QR_SIZE} accessibilityLabel={t('tent.qrLabel', { url })} />
          <AppText weight={600} style={styles.center}>
            {tent.scan}
          </AppText>
          <AppText variant="label" color="text2" style={styles.center}>
            {url.replace(/^https?:\/\//, '')}
          </AppText>
        </View>

        {printFailed && <FieldError message={t('tent.printFailed')} />}
        <Button icon="print-outline" label={t('tent.print')} onPress={() => void print()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  intro: {
    gap: Spacing.sm,
  },
  preview: {
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    borderRadius: Radius.card,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  center: {
    textAlign: 'center',
  },
});
