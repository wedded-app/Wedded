import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { ListRow, ListSection } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { Segmented } from '@/components/segmented';
import { StateView } from '@/components/state-view';
import {
  type BusinessStats,
  EMPTY_STATS,
  type StatsPeriod,
  useBusinessStats,
} from '@/data/business';
import { useBusinessInsights, useBusinessReels } from '@/data/business-insights';
import {
  FunnelSteps,
  HowYouCompare,
  ReplySpeed,
  ViewsChart,
  WhatFamiliesWant,
  YourReels,
} from '@/features/business/insights';
import { useCurrentBusiness } from '@/features/business/use-current-business';
import { useLocale } from '@/i18n/locale-context';

const PERIODS: StatsPeriod[] = [7, 30, 90];

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
 * Business → More about your page: the deeper numbers, kept off the Business
 * tab so it stays short. How families reached out, the views chart, seen to
 * booked, reply speed, what families want, how they compare and their reels,
 * over 7, 30 or 90 days (opening on the period the Business tab showed).
 */
export default function BusinessInsightsScreen() {
  const { t } = useLocale();
  const params = useLocalSearchParams<{ days?: string }>();
  const opened = Number(params.days) as StatsPeriod;
  const [days, setDays] = useState<StatsPeriod>(PERIODS.includes(opened) ? opened : 30);
  const current = useCurrentBusiness();
  const stats = useBusinessStats(current.vendorId, days);
  const insights = useBusinessInsights(current.vendorId, days);
  const reels = useBusinessReels(current.vendorId);
  const now = stats.data?.current ?? EMPTY_STATS;
  const contactRows = CONTACT_STATS.filter((key) => now[key] > 0);

  return (
    <NavScreen title={t('business.more.title')}>
      <Segmented
        accessibilityLabel={t('business.stats.period')}
        value={String(days)}
        onChange={(value) => setDays(Number(value) as StatsPeriod)}
        options={PERIODS.map((d) => ({
          value: String(d),
          label: t('business.stats.days', { days: d }),
        }))}
      />
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
      {insights.isPending && <StateView state="loading" />}
      {insights.isError && <StateView state="error" onRetry={() => void insights.refetch()} />}
      {insights.data && (
        <>
          <ViewsChart daily={insights.data.daily} />
          <FunnelSteps funnel={insights.data.funnel} />
          <ReplySpeed replies={insights.data.replies} />
          <WhatFamiliesWant asks={insights.data.asks} />
          {insights.data.compare && <HowYouCompare compare={insights.data.compare} />}
        </>
      )}
      {reels.data && <YourReels reels={reels.data} />}
    </NavScreen>
  );
}
