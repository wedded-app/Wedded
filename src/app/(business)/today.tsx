import { router } from 'expo-router';
import { RefreshControl, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { ListRow, ListSection } from '@/components/list';
import { StateView } from '@/components/state-view';
import { makeStyles, Spacing } from '@/constants/theme';
import {
  type BusinessStats,
  EMPTY_STATS,
  useBusinessLeads,
  useBusinessStats,
} from '@/data/business';
import { useBusinessChecklist } from '@/data/business-insights';
import { type DayMark, useVendorCalendar } from '@/data/vendor-self';
import { changeFrom } from '@/features/business/business-format';
import { LeadRow, NotLiveNotice, StatRows } from '@/features/business/business-parts';
import { SectionHeader } from '@/features/home/section-header';
import { BusinessTabScreen } from '@/features/business/business-tab-screen';
import { PageChecklist } from '@/features/business/insights';
import { nextMonth, upcomingDays } from '@/features/business/today';
import { useCurrentBusiness } from '@/features/business/use-current-business';
import { formatDate, toDateString } from '@/features/inquiry/inquiry-helpers';
import { FamiliesLookingEntry } from '@/features/requests/families-looking-entry';
import { useLocale } from '@/i18n/locale-context';

/** This week's numbers on Today; the rest are on the Business tab. */
const WEEK_STATS: (keyof BusinessStats)[] = ['views', 'inquiries', 'contacts'];

/**
 * Today: business mode's home (#252). The families waiting for a reply, how
 * many families are looking for what they do (Wanted, or the Pro teaser),
 * this week next to the week before, the next booked or held days, and what's
 * left to finish on their page. Pull to refresh.
 */
export default function TodayScreen() {
  const styles = useStyles();
  const { t } = useLocale();
  const current = useCurrentBusiness();
  const { vendorId, business } = current;
  const leads = useBusinessLeads(vendorId);
  const stats = useBusinessStats(vendorId, 7);
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
  const now = stats.data?.current ?? EMPTY_STATS;
  const before = stats.data?.previous ?? EMPTY_STATS;
  const coming = upcomingDays([thisMonth.data, laterMonth.data], today);
  const markWords = (marks: DayMark[]) =>
    marks
      .map((mark) =>
        mark.part === 'all_day'
          ? t(`business.calendar.legend.${mark.status}`)
          : `${t(`business.calendar.legend.${mark.status}`)} · ${t(`business.calendar.parts.${mark.part}`)}`,
      )
      .join(', ');
  const refresh = () => {
    void leads.refetch();
    void stats.refetch();
  };

  let replies;
  if (leads.isPending) {
    replies = <StateView state="loading" />;
  } else if (leads.isError) {
    replies = <StateView state="error" onRetry={() => void leads.refetch()} />;
  } else if (leadList.length === 0) {
    replies = <AppText color="text2">{t('business.leads.empty')}</AppText>;
  } else if (waiting.length === 0) {
    replies = <AppText color="text2">{t('business.leads.allReplied')}</AppText>;
  } else {
    replies = (
      <>
        <AppText weight={600} color="primary">
          {t('business.leads.waitingCount', { count: waiting.length })}
        </AppText>
        {waiting.slice(0, 3).map((lead) => (
          <LeadRow
            key={lead.id}
            lead={lead}
            onPress={() => router.push({ pathname: '/business/lead', params: { id: lead.id } })}
          />
        ))}
      </>
    );
  }

  return (
    <BusinessTabScreen
      title={t('businessMode.today.title')}
      eyebrow={business.name}
      refreshControl={<RefreshControl refreshing={leads.isRefetching} onRefresh={refresh} />}
    >
      {business.status !== 'published' && <NotLiveNotice />}

      <View style={styles.block}>
        <SectionHeader
          title={t('businessMode.today.waitingTitle')}
          link={leadList.length > 0 ? t('home.seeAll') : undefined}
          onLink={() => router.navigate('/leads')}
        />
        {replies}
      </View>

      <FamiliesLookingEntry vendorId={business.id} />

      <View style={styles.block}>
        <SectionHeader
          title={t('businessMode.today.weekTitle')}
          link={t('home.seeAll')}
          onLink={() => router.navigate('/business')}
        />
        {stats.isError ? (
          <StateView state="error" onRetry={() => void stats.refetch()} />
        ) : (
          <View style={stats.isPending && styles.loading}>
            <StatRows
              rows={WEEK_STATS.map((key) => {
                const change = changeFrom(now[key], before[key]);
                return {
                  key,
                  label: t(`business.stats.${key}`),
                  value: now[key],
                  changeWords: change
                    ? t(`business.stats.change.${change.kind}`, {
                        percent: change.percent,
                        days: 7,
                      })
                    : null,
                };
              })}
            />
          </View>
        )}
      </View>

      <View style={styles.block}>
        <SectionHeader
          title={t('businessMode.today.comingUp')}
          link={t('business.calendar.title')}
          onLink={() => router.push('/business/calendar')}
        />
        {coming.length === 0 ? (
          <AppText color="text2">{t('businessMode.today.noDates')}</AppText>
        ) : (
          <ListSection>
            {coming.map(({ day, marks }) => (
              <ListRow
                key={day}
                icon="calendar-outline"
                title={formatDate(day)}
                subtitle={markWords(marks)}
                onPress={() => router.push('/business/calendar')}
              />
            ))}
          </ListSection>
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
