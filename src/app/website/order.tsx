import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { GlassButton } from '@/components/glass-button';
import { Icon } from '@/components/icon';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useUpdateSite, type SitePage, type SiteSection } from '@/data/website';
import { PART_INFO } from '@/features/website/parts';
import { closeWebsiteSheet, SheetForm, WebsiteSheet } from '@/features/website/website-sheet';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';

/** The order of the parts under the cover, with up and down buttons (easier than dragging for elders). */
export default function WebsiteOrderScreen() {
  const { t } = useLocale();
  return (
    <WebsiteSheet title={t('website.order.title')}>
      {(site, weddingId) => <OrderForm site={site} weddingId={weddingId} />}
    </WebsiteSheet>
  );
}

function OrderForm({ site, weddingId }: { site: SitePage; weddingId: string }) {
  const styles = useStyles();
  const Colors = useColors();
  const { t } = useLocale();
  const update = useUpdateSite(site.slug);
  const [order, setOrder] = useState<SiteSection[]>(site.sections);

  const move = (index: number, by: -1 | 1) => {
    selectionHaptic();
    setOrder((all) => {
      const next = [...all];
      const [part] = next.splice(index, 1);
      next.splice(index + by, 0, part);
      return next;
    });
  };
  const save = () =>
    update.mutate(
      { weddingId, changes: { sections: order } },
      {
        onSuccess: () => {
          successHaptic();
          closeWebsiteSheet();
        },
      },
    );

  return (
    <SheetForm
      onSave={save}
      saving={update.isPending}
      error={update.isError ? t('website.saveFailed') : null}
    >
      <AppText color="text2">{t('website.order.hint')}</AppText>
      <View style={styles.list}>
        <View style={styles.row}>
          <Icon name="image-outline" size={22} color={Colors.text2} />
          <AppText style={styles.grow} color="text2">
            {t('website.order.coverFirst')}
          </AppText>
        </View>
        {order.map((section, i) => (
          <View key={section} style={styles.row}>
            <Icon name={PART_INFO[section].icon} size={22} color={Colors.primary} />
            <AppText style={styles.grow}>
              {section === 'guide' && site.guideTitle
                ? site.guideTitle
                : t(PART_INFO[section].titleKey)}
            </AppText>
            <GlassButton
              icon="arrow-up"
              size={44}
              color={i === 0 ? Colors.textDisabled : Colors.text}
              accessibilityLabel={t('website.moveUp')}
              onPress={() => i > 0 && move(i, -1)}
            />
            <GlassButton
              icon="arrow-down"
              size={44}
              color={i === order.length - 1 ? Colors.textDisabled : Colors.text}
              accessibilityLabel={t('website.moveDown')}
              onPress={() => i < order.length - 1 && move(i, 1)}
            />
          </View>
        ))}
      </View>
    </SheetForm>
  );
}

const useStyles = makeStyles((Colors) => ({
  list: {
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 60,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  grow: {
    flex: 1,
  },
}));
