import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { GlassButton } from '@/components/glass-button';
import { TextField } from '@/components/text-field';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import {
  httpsLink,
  SITE_LIST_LIMITS,
  siteProblem,
  useGuestTipSuggestions,
  useSetSiteItems,
  useUpdateSite,
  type SiteItem,
  type SiteListKind,
  type SitePage,
} from '@/data/website';
import { closeWebsiteSheet, SheetForm, WebsiteSheet } from '@/features/website/website-sheet';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

const SECTION_OF = { tip: 'guide', hotel: 'travel', faq: 'faq' } as const;

/** The site's lists: the guide's tips, the hotels, or the questions. */
export default function WebsiteListScreen() {
  const { t } = useLocale();
  const { kind: raw } = useLocalSearchParams<{ kind?: string }>();
  const kind: SiteListKind = raw === 'hotel' || raw === 'faq' ? raw : 'tip';
  return (
    <WebsiteSheet title={t(`website.list.${kind}.title`)}>
      {(site, weddingId) => <ListForm kind={kind} site={site} weddingId={weddingId} />}
    </WebsiteSheet>
  );
}

const ITEMS = { tip: 'tips', hotel: 'hotels', faq: 'faq' } as const;

function ListForm({
  kind,
  site,
  weddingId,
}: {
  kind: SiteListKind;
  site: SitePage;
  weddingId: string;
}) {
  const styles = useStyles();
  const Colors = useColors();
  const { t } = useLocale();
  const setItems = useSetSiteItems(site.slug);
  const update = useUpdateSite(site.slug);
  const [items, setList] = useState<SiteItem[]>(() =>
    site[ITEMS[kind]].length > 0 ? site[ITEMS[kind]] : [{ title: '', body: null, link: null }],
  );
  const [guideTitle, setGuideTitle] = useState(site.guideTitle ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const suggestions = useGuestTipSuggestions(kind === 'tip' ? site.events.map((e) => e.slug) : []);
  const most = SITE_LIST_LIMITS[kind];
  const have = new Set(items.map((i) => i.title.trim()));
  const unused = (suggestions.data ?? []).filter((s) => !have.has(s.tip));

  const edit = (index: number, change: Partial<SiteItem>) =>
    setList((all) => all.map((item, i) => (i === index ? { ...item, ...change } : item)));
  const move = (index: number, by: -1 | 1) =>
    setList((all) => {
      const next = [...all];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item);
      return next;
    });
  const add = (title = '') =>
    setList((all) => {
      const kept = all.filter((i) => i.title.trim() || i.body?.trim());
      return kept.length < most ? [...kept, { title, body: null, link: null }] : kept;
    });

  const save = async () => {
    setProblem(null);
    const list = items.map((i) => ({ ...i, link: i.link ? httpsLink(i.link) : null }));
    try {
      await setItems.mutateAsync({ weddingId, kind, list });
      const section = SECTION_OF[kind];
      const sections = site.sections.includes(section)
        ? site.sections
        : [...site.sections, section];
      if (kind === 'tip' || sections !== site.sections) {
        await update.mutateAsync({
          weddingId,
          changes: kind === 'tip' ? { guide_title: guideTitle, sections } : { sections },
        });
      }
      successHaptic();
      closeWebsiteSheet();
    } catch (e) {
      const p = siteProblem(e);
      setProblem(p === 'invalid' ? t(`website.list.${kind}.invalid`) : t('website.saveFailed'));
    }
  };

  return (
    <SheetForm
      onSave={() => void save()}
      saving={setItems.isPending || update.isPending}
      error={problem}
    >
      <AppText color="text2">{t(`website.list.${kind}.hint`)}</AppText>
      {kind === 'tip' && (
        <TextField
          label={t('website.list.tip.heading')}
          hint={t('website.list.tip.headingHint')}
          value={guideTitle}
          onChangeText={setGuideTitle}
          placeholder={t('website.site.goodToKnow')}
          maxLength={60}
        />
      )}
      {kind === 'tip' && unused.length > 0 && (
        <View style={styles.block}>
          <AppText variant="label" weight={600} color="text2">
            {t('website.list.tip.suggested')}
          </AppText>
          <View style={styles.chips}>
            {unused.map((s) => (
              <Chip
                key={`${s.eventSlug}-${s.tip}`}
                role="button"
                label={`+ ${s.tip}`}
                onPress={() => add(s.tip)}
              />
            ))}
          </View>
        </View>
      )}
      {items.map((item, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.cardHead}>
            <AppText variant="label" weight={600} color="text2" style={styles.grow}>
              {t(`website.list.${kind}.item`, { number: i + 1 })}
            </AppText>
            {i > 0 && (
              <GlassButton
                icon="arrow-up"
                size={40}
                color={Colors.text}
                accessibilityLabel={t('website.moveUp')}
                onPress={() => move(i, -1)}
              />
            )}
            {i < items.length - 1 && (
              <GlassButton
                icon="arrow-down"
                size={40}
                color={Colors.text}
                accessibilityLabel={t('website.moveDown')}
                onPress={() => move(i, 1)}
              />
            )}
            <GlassButton
              icon="trash-outline"
              size={40}
              color={Colors.error}
              accessibilityLabel={t('website.remove')}
              onPress={() => setList((all) => all.filter((_, j) => j !== i))}
            />
          </View>
          <TextField
            label={t(`website.list.${kind}.titleLabel`)}
            value={item.title}
            onChangeText={(title) => edit(i, { title })}
            placeholder={t(`website.list.${kind}.titleSample`)}
            multiline={kind !== 'hotel'}
            maxLength={200}
          />
          {kind !== 'tip' && (
            <TextField
              label={t(`website.list.${kind}.bodyLabel`)}
              value={item.body ?? ''}
              onChangeText={(body) => edit(i, { body })}
              placeholder={t(`website.list.${kind}.bodySample`)}
              multiline
              maxLength={1000}
            />
          )}
          {kind === 'hotel' && (
            <TextField
              label={t('website.list.hotel.linkLabel')}
              value={item.link ?? ''}
              onChangeText={(link) => edit(i, { link })}
              placeholder={t('website.list.hotel.linkSample')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              maxLength={500}
            />
          )}
        </View>
      ))}
      {items.length < most && (
        <Button
          variant="neutral"
          icon="add-circle-outline"
          label={t(`website.list.${kind}.add`)}
          onPress={() => add()}
        />
      )}
    </SheetForm>
  );
}

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  card: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  grow: {
    flex: 1,
  },
}));
