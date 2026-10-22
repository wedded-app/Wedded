import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useUpdateSite, type SitePage } from '@/data/website';
import { SITE_DESIGNS, siteDesign, sitePalette } from '@/features/website/designs';
import { paletteSwatches, SiteCover } from '@/features/website/site-cover';
import { closeWebsiteSheet, SheetForm, WebsiteSheet } from '@/features/website/website-sheet';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';

/** Pick the site's design and its colours, seeing the cover change as you go. */
export default function WebsiteDesignScreen() {
  const { t } = useLocale();
  return (
    <WebsiteSheet title={t('website.design.title')}>
      {(site, weddingId) => <DesignForm site={site} weddingId={weddingId} />}
    </WebsiteSheet>
  );
}

function DesignForm({ site, weddingId }: { site: SitePage; weddingId: string }) {
  const styles = useStyles();
  const Colors = useColors();
  const { t } = useLocale();
  const update = useUpdateSite(site.slug);
  const [designId, setDesignId] = useState(siteDesign(site.design).id);
  const [paletteId, setPaletteId] = useState(sitePalette(siteDesign(site.design), site.palette).id);
  const [width, setWidth] = useState(0);
  const design = siteDesign(designId);
  const column = (width - Spacing.md) / 2;

  const pickDesign = (id: string) => {
    selectionHaptic();
    setDesignId(id);
    setPaletteId(siteDesign(id).palettes[0].id);
  };
  const save = () =>
    update.mutate(
      { weddingId, changes: { design: designId, palette: paletteId } },
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
      <View onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}>
        {width > 0 && (
          <View style={[styles.preview, { pointerEvents: 'none' }]}>
            <SiteCover
              data={site}
              width={width}
              mini
              designId={designId}
              paletteId={paletteId}
              id="design-big"
              minHeight={380}
            />
          </View>
        )}
      </View>

      <View style={styles.block}>
        <AppText variant="heading">{t(design.nameKey)}</AppText>
        <AppText color="text2">{t(design.noteKey)}</AppText>
      </View>

      <View style={styles.block}>
        <AppText variant="label" weight={600} color="text2">
          {t('website.design.colours')}
        </AppText>
        <View style={styles.palettes} accessibilityRole="radiogroup">
          {design.palettes.map((p) => {
            const selected = p.id === paletteId;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t(p.nameKey)}
                onPress={() => {
                  selectionHaptic();
                  setPaletteId(p.id);
                }}
                style={[styles.palette, selected && styles.paletteOn]}
              >
                <View style={styles.dots}>
                  {paletteSwatches(design, p).map((c, i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: c }]} />
                  ))}
                </View>
                <AppText variant="label" weight={selected ? 700 : 500}>
                  {t(p.nameKey)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.block}>
        <AppText variant="label" weight={600} color="text2">
          {t('website.design.all')}
        </AppText>
        <View style={styles.grid} accessibilityRole="radiogroup">
          {SITE_DESIGNS.map((d) => {
            const selected = d.id === designId;
            return (
              <Pressable
                key={d.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${t(d.nameKey)}. ${t(d.noteKey)}`}
                onPress={() => pickDesign(d.id)}
                style={[styles.tile, { width: column }]}
              >
                <View
                  style={[
                    styles.thumb,
                    selected && { borderColor: Colors.text },
                    { pointerEvents: 'none' },
                  ]}
                >
                  {column > 0 && (
                    <SiteCover
                      data={site}
                      width={column - 4}
                      mini
                      designId={d.id}
                      paletteId={selected ? paletteId : undefined}
                      id={`design-${d.id}`}
                      minHeight={246}
                    />
                  )}
                  {selected && (
                    <View style={styles.check}>
                      <Icon name="checkmark" size={14} color={Colors.onPrimary} weight="bold" />
                    </View>
                  )}
                </View>
                <AppText weight={selected ? 700 : 600}>{t(d.nameKey)}</AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SheetForm>
  );
}

const useStyles = makeStyles((Colors) => ({
  preview: {
    height: 380,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  block: {
    gap: Spacing.sm,
  },
  palettes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  palette: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.button,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  paletteOn: {
    borderColor: Colors.text,
  },
  dots: {
    flexDirection: 'row',
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: -5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  tile: {
    gap: Spacing.xs,
  },
  thumb: {
    height: 250,
    borderRadius: 18,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  check: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryFill,
  },
}));
