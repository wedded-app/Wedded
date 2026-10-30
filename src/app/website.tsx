import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Glass } from '@/components/glass';
import { Icon } from '@/components/icon';
import { ListRow, ListSection } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { Switch } from '@/components/switch';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { shareInvite } from '@/data/wedding';
import {
  SITE_SECTIONS,
  usePublishSite,
  useUpdateSite,
  websiteLink,
  type SitePage,
  type SiteSection,
} from '@/data/website';
import { siteDesign } from '@/features/website/designs';
import { useSiteFonts } from '@/features/website/fonts';
import { PART_INFO, partSummary } from '@/features/website/parts';
import { SiteCover } from '@/features/website/site-cover';
import { startSteps, withPart } from '@/features/website/site-helpers';
import { useWebsite } from '@/features/website/use-website';
import { WebsiteAsk } from '@/features/website/website-ask';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';
import { confirm } from '@/lib/confirm';

/**
 * Website (DECISIONS.md, 2026-10-22; after The Knot's Website tab): where a
 * family makes the page they share with guests. A live preview opens the
 * full page; Ask Wed changes anything; the first steps (design, cover photo,
 * what to wear, publish) tick off; every part of the site is a row to switch
 * on or off and open; then RSVPs and settings. Publish sits at the bottom
 * until the site is live, then Share does.
 */
export default function WebsiteScreen() {
  const { t } = useLocale();
  const website = useWebsite();
  const fontsReady = useSiteFonts();

  let content;
  if (website.status === 'loading' || (website.status === 'ready' && !fontsReady)) {
    content = <StateView state="loading" message={t('website.loading')} />;
  } else if (website.status === 'noWedding') {
    content = (
      <StateView
        state="empty"
        icon="globe-outline"
        message={t('website.noWedding')}
        action={{ label: t('website.startPlan'), onPress: () => router.push('/plan') }}
      />
    );
  } else if (website.status === 'cantMake') {
    content = <StateView state="empty" icon="globe-outline" message={t('website.cantMake')} />;
  } else if (website.status === 'error') {
    content = <StateView state="error" onRetry={website.retry} />;
  } else {
    return <Builder site={website.site} weddingId={website.weddingId} canEdit={website.canEdit} />;
  }
  return <NavScreen title={t('website.title')}>{content}</NavScreen>;
}

function Builder({
  site,
  weddingId,
  canEdit,
}: {
  site: SitePage;
  weddingId: string;
  canEdit: boolean;
}) {
  const styles = useStyles();
  const Colors = useColors();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const update = useUpdateSite(site.slug);
  const publish = usePublishSite(site.slug);
  const [previewWidth, setPreviewWidth] = useState(0);
  const steps = startSteps(site);
  const live = !!site.publishedAt;
  const link = websiteLink(site.slug);
  const design = siteDesign(site.design);

  // Parts that are on, in their order, then the ones switched off
  const parts: SiteSection[] = [
    ...site.sections,
    ...SITE_SECTIONS.filter((s) => !site.sections.includes(s)),
  ];
  const toggle = (section: SiteSection, on: boolean) => {
    selectionHaptic();
    const next = on
      ? withPart(site.sections, section, SITE_SECTIONS)
      : site.sections.filter((s) => s !== section);
    update.mutate({ weddingId, changes: { sections: next } });
  };

  const share = () =>
    void shareInvite(link, (key, o) => t(key, { ...o, names: site.title }), 'website.shareMessage');
  const doPublish = () =>
    publish.mutate(
      { weddingId, publish: true },
      {
        onSuccess: () => {
          successHaptic();
          confirm(
            t('website.published.title'),
            t('website.published.body'),
            t('website.share'),
            t('website.wed.notNow'),
            share,
          );
        },
      },
    );

  return (
    <View style={styles.screen}>
      <NavScreen
        title={t('website.title')}
        subtitle={live ? t('website.statusLive') : t('website.statusDraft')}
        contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
      >
        {/* The site itself, small: opens the full page */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('website.previewAndEdit')}
          onPress={() => router.push('/website/preview')}
          onLayout={(e: LayoutChangeEvent) =>
            setPreviewWidth(Math.round(e.nativeEvent.layout.width))
          }
          style={({ pressed }) => [styles.preview, pressed && styles.pressed]}
        >
          {previewWidth > 0 && (
            <View style={{ pointerEvents: 'none' }}>
              <SiteCover data={site} width={previewWidth} mini id="hub" minHeight={320} />
            </View>
          )}
          <Glass style={styles.previewPill}>
            <Icon name="eye-outline" size={18} color={Colors.text} />
            <AppText variant="label" weight={600}>
              {t('website.previewAndEdit')}
            </AppText>
          </Glass>
        </Pressable>

        {canEdit ? (
          <WebsiteAsk site={site} weddingId={weddingId} />
        ) : (
          <AppText color="text2">{t('website.cantMake')}</AppText>
        )}

        {canEdit && (
          <ListSection header={t('website.startHere')} inset>
            <ListRow
              leading={<Tick done={steps.design} />}
              title={t('website.steps.design')}
              subtitle={t(design.nameKey)}
              onPress={() => router.push('/website/design')}
            />
            <ListRow
              leading={<Tick done={steps.cover} />}
              title={t('website.steps.cover')}
              subtitle={steps.cover ? t('website.steps.coverDone') : t('website.steps.coverHint')}
              onPress={() => router.push('/website/cover')}
            />
            <ListRow
              leading={<Tick done={steps.dress} />}
              title={t('website.steps.dress')}
              subtitle={t('website.steps.dressHint')}
              onPress={() => router.push('/website/events')}
            />
            <ListRow
              leading={<Tick done={steps.published} />}
              title={t('website.steps.publish')}
              subtitle={live ? t('website.steps.publishDone') : t('website.steps.publishHint')}
              onPress={live ? share : doPublish}
            />
          </ListSection>
        )}

        <ListSection header={t('website.onYourSite')} footer={t('website.onYourSiteFooter')} inset>
          <ListRow
            icon="image-outline"
            title={t('website.parts.cover')}
            subtitle={site.welcome ?? t('website.summary.coverEmpty')}
            onPress={canEdit ? () => router.push('/website/welcome') : undefined}
          />
          {parts.map((section) => {
            const on = site.sections.includes(section);
            const info = PART_INFO[section];
            return (
              <ListRow
                key={section}
                icon={info.icon}
                iconColor={on ? 'primary' : 'chevron'}
                title={section === 'guide' && site.guideTitle ? site.guideTitle : t(info.titleKey)}
                subtitle={on ? partSummary(site, section, t) : t('website.hidden')}
                onPress={canEdit ? () => router.push(info.href) : undefined}
                trailing={
                  canEdit ? (
                    <Switch
                      value={on}
                      onValueChange={(v) => toggle(section, v)}
                      accessibilityLabel={t('website.showPart', { part: t(info.titleKey) })}
                    />
                  ) : undefined
                }
              />
            );
          })}
        </ListSection>
        {canEdit && (
          <Button
            variant="neutral"
            icon="swap-vertical-outline"
            label={t('website.changeOrder')}
            onPress={() => router.push('/website/order')}
          />
        )}

        {canEdit && (
          <ListSection header={t('website.settingsHeader')} inset>
            <ListRow
              icon="link-outline"
              title={t('website.settings.link')}
              subtitle={link}
              onPress={() => router.push('/website/settings')}
            />
            <ListRow
              icon="lock-closed-outline"
              title={t('website.settings.password')}
              value={site.editor?.hasPassword ? t('website.on') : t('website.off')}
              onPress={() => router.push('/website/settings')}
            />
            <ListRow
              icon="search-outline"
              title={t('website.settings.search')}
              subtitle={t('website.settings.searchHint')}
              trailing={
                <Switch
                  value={site.searchable}
                  onValueChange={(v) => update.mutate({ weddingId, changes: { searchable: v } })}
                  accessibilityLabel={t('website.settings.search')}
                />
              }
            />
          </ListSection>
        )}
      </NavScreen>

      {canEdit && (
        <Glass style={[styles.bar, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
          <View style={styles.barLine}>
            <Icon
              name={live ? 'globe-outline' : 'eye-off-outline'}
              size={18}
              color={live ? Colors.success : Colors.text2}
            />
            <AppText variant="label" color={live ? 'success' : 'text2'} style={styles.grow}>
              {live ? t('website.barLive') : t('website.barDraft')}
            </AppText>
          </View>
          {live ? (
            <Button icon="share-outline" label={t('website.share')} onPress={share} />
          ) : (
            <Button label={t('website.publish')} loading={publish.isPending} onPress={doPublish} />
          )}
        </Glass>
      )}
    </View>
  );
}

/** A done or to-do circle at the start of a first step. */
function Tick({ done }: { done: boolean }) {
  const styles = useStyles();
  const Colors = useColors();
  return (
    <View style={[styles.tick, done && styles.tickDone]}>
      {done && <Icon name="checkmark" size={16} color={Colors.onPrimary} weight="bold" />}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  preview: {
    height: 320,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  pressed: {
    opacity: 0.9,
  },
  previewPill: {
    position: 'absolute',
    left: Spacing.md,
    bottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    minHeight: 40,
    borderRadius: Radius.button,
  },
  tick: {
    width: Sizes.rowIcon,
    height: Sizes.rowIcon,
    borderRadius: Radius.circle,
    borderWidth: 1.5,
    borderColor: Colors.borderInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickDone: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    paddingHorizontal: Sizes.pageGutter,
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
  },
  barLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  grow: {
    flexShrink: 1,
  },
}));
