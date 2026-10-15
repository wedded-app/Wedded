import { router } from 'expo-router';
import { RefreshControl, View } from 'react-native';

import { AppText, useFontScale } from '@/components/app-text';
import { Button } from '@/components/button';
import { ListRow, ListSection, SectionTitle } from '@/components/list';
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
import { LeadRow, NotLiveNotice, StatCard } from '@/features/business/business-parts';
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
  const largeText = useFontScale('display') >= 1.4;
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
        <SectionTitle>{t('businessMode.today.waitingTitle')}</SectionTitle>
        {replies}
        {leadList.length > 0 && (
          <Button
            variant="secondary"
            label={t('businessMode.today.seeLeads')}
            onPress={() => router.navigate('/leads')}
          />
        )}
      </View>

      <FamiliesLookingEntry vendorId={business.id} />

      <View style={styles.block}>
        <SectionTitle>{t('businessMode.today.weekTitle')}</SectionTitle>
        {stats.isError ? (
          <StateView state="error" onRetry={() => void stats.refetch()} />
        ) : (
          <View style={[styles.grid, stats.isPending && styles.loading]}>
            {WEEK_STATS.map((key, index) => {
              const change = changeFrom(now[key], before[key]);
              return (
                <StatCard
                  key={key}
                  wide={index === 0 || largeText}
                  value={now[key]}
                  label={t(`business.stats.${key}`)}
                  change={change}
                  changeWords={
                    change
                      ? t(`business.stats.change.${change.kind}`, {
                          percent: change.percent,
                          days: 7,
                        })
                      : null
                  }
                />
              );
            })}
          </View>
        )}
        <Button
          variant="secondary"
          label={t('businessMode.today.allNumbers')}
          onPress={() => router.navigate('/business')}
        />
      </View>

      <View style={styles.block}>
        <SectionTitle>{t('businessMode.today.comingUp')}</SectionTitle>
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
        <Button
          variant="secondary"
          label={t('businessMode.today.openCalendar')}
          onPress={() => router.push('/business/calendar')}
        />
      </View>

      {checklist.data && checklist.data.doneCount < checklist.data.total && (
        <PageChecklist
          items={checklist.data.items}
          doneCount={checklist.data.doneCount}
          total={checklist.data.total}
          businessName={business.name}
        />
      )}
    </BusinessTabScreen>
  );
}

const useStyles = makeStyles(() => ({
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
