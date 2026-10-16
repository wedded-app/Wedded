import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Chip } from '@/components/chip';
import { FieldError } from '@/components/field-error';
import { ListRow, ListSection, SectionTitle } from '@/components/list';
import { Segmented } from '@/components/segmented';
import { StateView } from '@/components/state-view';
import { makeStyles, Spacing, useColors } from '@/constants/theme';
import {
  type BusinessStats,
  EMPTY_STATS,
  type StatsPeriod,
  useBusinessStats,
} from '@/data/business';
import { useExportBusiness } from '@/data/business-export';
import { useVendorMenus } from '@/data/vendor-menus';
import { useMyVendorPhotos } from '@/data/vendor-photos-self';
import { changeFrom } from '@/features/business/business-format';
import { switchToPlanning } from '@/features/business/app-mode';
import { NotLiveNotice, StatRows } from '@/features/business/business-parts';
import { BusinessTabScreen } from '@/features/business/business-tab-screen';
import { GetPaid } from '@/features/business/get-paid';
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
/**
 * Business mode's Business tab (C6, #252): which business (when they run
 * several), whether the page is live, how it did over 7, 30 or 90 days next
 * to the period before, then menus, calendar and the page itself, getting
 * paid, and "Export everything" as a spreadsheet. C6b adds a headline, the
 * views chart, seen to booked, reply speed, what families want, how they
 * compare, their reels and a checklist for the page. Settings and "Switch to
 * planning" are at the bottom. The families who asked have their own tab.
 */
export default function BusinessScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const current = useCurrentBusiness();
  const [days, setDays] = useState<StatsPeriod>(30);
  const stats = useBusinessStats(current.vendorId, days);
  const menus = useVendorMenus(current.vendorId);
  const photos = useMyVendorPhotos(current.vendorId);
  const exporting = useExportBusiness(current.vendorId);
  const business = current.business;

  if (current.isPending) {
    return (
      <BusinessTabScreen title={t('business.title')}>
        <StateView state="loading" />
      </BusinessTabScreen>
    );
  }
  if (!business) {
    return (
      <BusinessTabScreen title={t('business.title')}>
        <StateView state="empty" icon="storefront-outline" message={t('business.notVendor')} />
      </BusinessTabScreen>
    );
  }

  const name = business.name;
  const now = stats.data?.current ?? EMPTY_STATS;
  const before = stats.data?.previous ?? EMPTY_STATS;
  const changeWords = (key: keyof BusinessStats) => {
    const change = changeFrom(now[key], before[key]);
    if (!change) return null;
    return t(`business.stats.change.${change.kind}`, { percent: change.percent, days });
  };

  return (
    <BusinessTabScreen title={t('business.title')} subtitle={name}>
      {current.businesses.length > 1 && (
        <View style={styles.chips} accessibilityRole="radiogroup">
          {current.businesses.map((b) => (
            <Chip
              key={b.id}
              role="radio"
              label={b.name}
              selected={b.id === business.id}
              onPress={() => chooseBusiness(b.id)}
            />
          ))}
        </View>
      )}

      {business.status !== 'published' && <NotLiveNotice />}

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
          <View style={stats.isPending && styles.loading}>
            <StatRows
              rows={MAIN_STATS.map((key) => ({
                key,
                label: t(`business.stats.${key}`),
                value: now[key],
                changeWords: changeWords(key),
              }))}
            />
          </View>
        )}
        {/* The charts and the rest live one tap away, so this tab stays short */}
        <ListSection>
          <ListRow
            icon="stats-chart-outline"
            title={t('business.more.title')}
            onPress={() =>
              router.push({ pathname: '/business/insights', params: { days: String(days) } })
            }
          />
        </ListSection>
      </View>

      <ListSection header={t('business.yourListing')} footer={t('business.listingHint')}>
        <ListRow
          icon="create-outline"
          title={t('business.listing.title')}
          onPress={() => router.push('/business/listing')}
        />
        <ListRow
          icon="images-outline"
          title={t('business.photos.title')}
          value={photos.data ? String(photos.data.length) : undefined}
          onPress={() => router.push('/business/photos')}
        />
        <ListRow
          icon="restaurant-outline"
          title={t('business.menus.title')}
          value={menus.data ? String(menus.data.length) : undefined}
          onPress={() => router.push('/business/menus')}
        />
        <ListRow
          icon="calendar-outline"
          title={t('business.calendar.title')}
          onPress={() => router.push('/business/calendar')}
        />
        {business.status === 'published' && (
          <ListRow
            icon="storefront-outline"
            title={t('business.viewPage')}
            onPress={() => router.push({ pathname: '/v/[slug]', params: { slug: business.slug } })}
          />
        )}
      </ListSection>

      <GetPaid vendorId={business.id} />

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

      <ListSection header={t('businessMode.account')}>
        <ListRow
          icon="settings-outline"
          title={t('settings.title')}
          onPress={() => router.push('/settings')}
        />
        <ListRow
          icon="heart-outline"
          title={t('businessMode.switchToPlanning')}
          subtitle={t('businessMode.switchToPlanningHint')}
          onPress={switchToPlanning}
        />
      </ListSection>
    </BusinessTabScreen>
  );
}

const useStyles = makeStyles(() => ({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
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
