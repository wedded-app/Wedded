import { router } from 'expo-router';
import { RefreshControl, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { StateView } from '@/components/state-view';
import { makeStyles, Spacing } from '@/constants/theme';
import { EMPTY_STATS, useBusinessLeads, useBusinessStats } from '@/data/business';
import { useBusinessChecklist } from '@/data/business-insights';
import { useVendorCalendar } from '@/data/vendor-self';
import { NotLiveNotice } from '@/features/business/business-parts';
import { BusinessTabScreen } from '@/features/business/business-tab-screen';
import { PageChecklist } from '@/features/business/insights';
import {
  mergeMonths,
  nextBooking,
  nextMonth,
  oldestWaiting,
  weekDays,
} from '@/features/business/today';
import { MonthWords, WaitingCard, WaitingLead, WeekStrip } from '@/features/business/today-parts';
import { useCurrentBusiness } from '@/features/business/use-current-business';
import { SectionHeader } from '@/features/home/section-header';
import { formatDate, toDateString } from '@/features/inquiry/inquiry-helpers';
import { useLocale } from '@/i18n/locale-context';

/**
 * Today: business mode's home (the final look, 2026-10-23; canvas board
 * "4 · The vendor side"). What needs the vendor now, in a fixed order: the
 * moving saffron card with how many families wait and for how long, each
 * waiting family with whether they're free that day, the week as seven days
 * with the next booking, last month's numbers in words, and at most three
 * ways to make the page better. Pull to refresh.
 */
export default function TodayScreen() {
  const styles = useStyles();
  const { t } = useLocale();
  const current = useCurrentBusiness();
  const { vendorId, business } = current;
  const leads = useBusinessLeads(vendorId);
  const stats = useBusinessStats(vendorId, 30);
  const checklist = useBusinessChecklist(vendorId);
  const today = toDateString(new Date());
  const thisMonth = useVendorCalendar(vendorId, today.slice(0, 7));
  const laterMonth = useVendorCalendar(vendorId, nextMonth(today));

  if (!business) {
    return (
      <BusinessTabScreen title={t('businessMode.today.title')}>
        <StateView state="loading" />
      </BusinessTabScreen>
    );
  }

  const leadList = leads.data ?? [];
  const waiting = leadList.filter((lead) => !lead.replied);
  const months = [thisMonth.data, laterMonth.data];
  const booking = nextBooking(months, today);
  const refresh = () => {
    void leads.refetch();
    void stats.refetch();
    void thisMonth.refetch();
  };

  return (
    <BusinessTabScreen
      title={t('businessMode.today.title')}
      eyebrow={business.name}
      refreshControl={<RefreshControl refreshing={leads.isRefetching} onRefresh={refresh} />}
    >
      {business.status !== 'published' && <NotLiveNotice />}

      {leads.isError ? (
        <StateView state="error" onRetry={() => void leads.refetch()} />
      ) : (
        <WaitingCard count={waiting.length} oldest={oldestWaiting(leadList)} />
      )}

      {waiting.length > 0 && (
        <View style={styles.block}>
          <SectionHeader
            title={t('businessToday.waitingTitle')}
            link={waiting.length > 3 ? t('home.seeAll') : undefined}
            onLink={() => router.navigate('/leads')}
          />
          <View>
            {waiting.slice(0, 3).map((lead) => (
              <WaitingLead key={lead.id} lead={lead} vendorId={business.id} />
            ))}
          </View>
        </View>
      )}

      <View style={styles.block}>
        <SectionHeader
          title={t('businessToday.weekTitle')}
          link={t('businessMode.tabs.calendar')}
          onLink={() => router.navigate('/calendar')}
        />
        <WeekStrip days={weekDays(today)} marks={mergeMonths(months)} today={today} />
        <AppText color="text2">
          {booking
            ? t('businessToday.nextBooking', { date: formatDate(booking) })
            : t('businessToday.noBooking')}
        </AppText>
      </View>

      <View style={styles.block}>
        <SectionHeader
          title={t('businessToday.monthTitle')}
          link={t('home.seeAll')}
          onLink={() => router.push({ pathname: '/business/insights', params: { days: '30' } })}
        />
        {stats.isError ? (
          <StateView state="error" onRetry={() => void stats.refetch()} />
        ) : (
          <View style={stats.isPending && styles.loading}>
            <MonthWords stats={stats.data?.current ?? EMPTY_STATS} />
          </View>
        )}
      </View>

      {checklist.data && checklist.data.doneCount < checklist.data.total && (
        <PageChecklist
          items={checklist.data.items}
          doneCount={checklist.data.doneCount}
          total={checklist.data.total}
          businessName={business.name}
          limit={3}
        />
      )}
    </BusinessTabScreen>
  );
}

const useStyles = makeStyles(() => ({
  block: {
    gap: Spacing.md,
  },
  loading: {
    opacity: 0.5,
  },
}));
