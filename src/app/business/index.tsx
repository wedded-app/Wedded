import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText, useFontScale } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { ListRow, ListSection, SectionTitle } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { Segmented } from '@/components/segmented';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import {
  type BusinessStats,
  EMPTY_STATS,
  type StatsPeriod,
  useBusinessLeads,
  useBusinessStats,
  waitingCount,
} from '@/data/business';
import { useExportBusiness } from '@/data/business-export';
import {
  useBusinessChecklist,
  useBusinessInsights,
  useBusinessReels,
} from '@/data/business-insights';
import { useVendorMenus } from '@/data/vendor-menus';
import { changeFrom } from '@/features/business/business-format';
import { LeadRow, StatCard } from '@/features/business/business-parts';
import {
  FunnelSteps,
  HowYouCompare,
  PageChecklist,
  ReplySpeed,
  ViewsChart,
  WhatFamiliesWant,
  YourReels,
} from '@/features/business/insights';
import { headline } from '@/features/business/insights-format';
import { chooseBusiness, useCurrentBusiness } from '@/features/business/use-current-business';
import { useLocale } from '@/i18n/locale-context';

const PERIODS: StatsPeriod[] = [7, 30, 90];

/** The numbers on the home, biggest first, in plain words. */
const MAIN_STATS: (keyof BusinessStats)[] = [
  'views',
  'contacts',
  'inquiries',
  'saves',
  'reelViews',
];
/** How families reached out, one row each. */
const CONTACT_STATS: (keyof BusinessStats)[] = [
  'calls',
  'texts',
  'whatsapps',
  'directions',
  'instagram',
  'website',
  'shares',
];

/**
 * My business (C6): a vendor's own home. Which business (when they run
 * several), whether the page is live, how it did over 7, 30 or 90 days next
 * to the period before, the families who asked (waiting ones first), then
 * menus, calendar and the page itself, and "Export everything" as a
 * spreadsheet. C6b adds a headline, the views chart, seen to booked, reply
 * speed, what families want, how they compare, their reels and a checklist
 * for the page. Opened from Profile and Home.
 */
export default function BusinessScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const { t, locale } = useLocale();
  const current = useCurrentBusiness();
  const [days, setDays] = useState<StatsPeriod>(30);
  // At large text the number cards go one per row instead of two
  const largeText = useFontScale('display') >= 1.4;
  const stats = useBusinessStats(current.vendorId, days);
  const insights = useBusinessInsights(current.vendorId, days);
  const reels = useBusinessReels(current.vendorId);
  const checklist = useBusinessChecklist(current.vendorId);
  const leads = useBusinessLeads(current.vendorId);
  const menus = useVendorMenus(current.vendorId);
  const exporting = useExportBusiness(current.vendorId);
  const business = current.business;

  if (current.isPending) {
    return (
      <NavScreen title={t('business.title')}>
        <StateView state="loading" />
      </NavScreen>
    );
  }
  if (!business) {
    return (
      <NavScreen title={t('business.title')}>
        <StateView state="empty" icon="storefront-outline" message={t('business.notVendor')} />
      </NavScreen>
    );
  }

  const name = locale === 'pa' && business.namePa ? business.namePa : business.name;
  const now = stats.data?.current ?? EMPTY_STATS;
  const before = stats.data?.previous ?? EMPTY_STATS;
  const changeWords = (key: keyof BusinessStats) => {
    const change = changeFrom(now[key], before[key]);
    if (!change) return null;
    return t(`business.stats.change.${change.kind}`, { percent: change.percent, days });
  };
  const leadList = leads.data ?? [];
  const waiting = waitingCount(leadList);
  const contactRows = CONTACT_STATS.filter((key) => now[key] > 0);

  return (
    <NavScreen title={t('business.title')} subtitle={name}>
      {current.businesses.length > 1 && (
        <View style={styles.chips} accessibilityRole="radiogroup">
          {current.businesses.map((b) => (
            <Chip
              key={b.id}
              role="radio"
              label={locale === 'pa' && b.namePa ? b.namePa : b.name}
              selected={b.id === business.id}
              onPress={() => chooseBusiness(b.id)}
            />
          ))}
        </View>
      )}

      {business.status !== 'published' && (
        <View style={styles.notice}>
          <Icon name="eye-off-outline" size={22} color={Colors.kesari} />
          <AppText style={styles.grow}>{t('business.notLive')}</AppText>
        </View>
      )}

      {stats.data && (
        <AppText variant="title" accessibilityRole="header">
          {headline(days, now.views, now.inquiries, t)}
        </AppText>
      )}

      <View style={styles.block}>
        <SectionTitle>{t('business.stats.title')}</SectionTitle>
        <Segmented
          accessibilityLabel={t('business.stats.period')}
          value={String(days)}
          onChange={(value) => setDays(Number(value) as StatsPeriod)}
          options={PERIODS.map((d) => ({
            value: String(d),
            label: t('business.stats.days', { days: d }),
          }))}
        />
        {stats.isError ? (
          <StateView state="error" onRetry={() => void stats.refetch()} />
        ) : (
          <View style={[styles.grid, stats.isPending && styles.loading]}>
            {MAIN_STATS.map((key, index) => (
              <StatCard
                key={key}
                wide={index === 0 || largeText}
                value={now[key]}
                label={t(`business.stats.${key}`)}
                change={changeFrom(now[key], before[key])}
                changeWords={changeWords(key)}
              />
            ))}
          </View>
        )}
        {contactRows.length > 0 && (
          <ListSection header={t('business.stats.howTitle')}>
            {contactRows.map((key) => (
              <ListRow
                key={key}
                title={t(`business.stats.${key}`)}
                value={now[key].toLocaleString('en-US')}
              />
            ))}
          </ListSection>
        )}
      </View>

      {insights.isError && <StateView state="error" onRetry={() => void insights.refetch()} />}
      {insights.data && (
        <>
          <ViewsChart daily={insights.data.daily} />
          <FunnelSteps funnel={insights.data.funnel} />
          <ReplySpeed replies={insights.data.replies} />
        </>
      )}

      <View style={styles.block}>
        <SectionTitle>{t('business.leads.title')}</SectionTitle>
        {leads.isPending ? (
          <StateView state="loading" />
        ) : leads.isError ? (
          <StateView state="error" onRetry={() => void leads.refetch()} />
        ) : leadList.length === 0 ? (
          <AppText color="text2">{t('business.leads.empty')}</AppText>
        ) : (
          <>
            {waiting > 0 && (
              <AppText weight={600} color="primary">
                {t('business.leads.waitingCount', { count: waiting })}
              </AppText>
            )}
            {leadList.slice(0, 3).map((lead) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                onPress={() => router.push({ pathname: '/business/lead', params: { id: lead.id } })}
              />
            ))}
            <Button
              variant="secondary"
              label={t('business.leads.seeAll', { count: leadList.length })}
              onPress={() => router.push('/business/leads')}
            />
          </>
        )}
      </View>

      {insights.data && <WhatFamiliesWant asks={insights.data.asks} />}
      {insights.data?.compare && <HowYouCompare compare={insights.data.compare} />}
      {reels.data && <YourReels reels={reels.data} />}
      {checklist.data && checklist.data.total > 0 && (
        <PageChecklist
          items={checklist.data.items}
          doneCount={checklist.data.doneCount}
          total={checklist.data.total}
          businessName={business.name}
        />
      )}

      <ListSection header={t('business.yourListing')} footer={t('business.listingHint')}>
        <ListRow
          icon="create-outline"
          title={t('business.listing.title')}
          subtitle={t('business.listing.rowHint')}
          onPress={() => router.push('/business/listing')}
        />
        <ListRow
          icon="restaurant-outline"
          title={t('business.menus.title')}
          subtitle={t('business.menus.rowHint')}
          value={menus.data ? String(menus.data.length) : undefined}
          onPress={() => router.push('/business/menus')}
        />
        <ListRow
          icon="calendar-outline"
          title={t('business.calendar.title')}
          subtitle={t('business.calendar.rowHint')}
          onPress={() => router.push('/business/calendar')}
        />
        {business.status === 'published' && (
          <ListRow
            icon="storefront-outline"
            title={t('business.viewPage')}
            subtitle={t('business.viewPageHint')}
            onPress={() => router.push({ pathname: '/v/[slug]', params: { slug: business.slug } })}
          />
        )}
      </ListSection>

      <View style={styles.block}>
        <ListSection>
          <ListRow
            icon="share-outline"
            title={t('business.export.title')}
            subtitle={t('business.export.hint')}
            chevron={false}
            onPress={exporting.isPending ? undefined : () => exporting.mutate()}
            trailing={
              exporting.isPending ? <ActivityIndicator color={Colors.primary} /> : undefined
            }
            accessibilityLabel={
              exporting.isPending ? t('business.export.working') : t('business.export.title')
            }
          />
        </ListSection>
        {exporting.isError && (
          <FieldError
            message={
              exporting.error instanceof Error &&
              exporting.error.message.includes('sharing_unavailable')
                ? t('business.export.cantShare')
                : t('business.export.failed')
            }
          />
        )}
      </View>
    </NavScreen>
  );
}

const useStyles = makeStyles((Colors) => ({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    backgroundColor: Colors.kesariTint,
  },
  grow: {
    flex: 1,
  },
  block: {
    gap: Spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  loading: {
    opacity: 0.5,
  },
}));
