import { router } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { Chip } from '@/components/chip';
import { FieldError } from '@/components/field-error';
import { ListRow, ListSection } from '@/components/list';
import { StateView } from '@/components/state-view';
import { makeStyles, Spacing, useColors } from '@/constants/theme';
import { useExportBusiness } from '@/data/business-export';
import { useMyListing } from '@/data/listing';
import { useVendorMenus } from '@/data/vendor-menus';
import { useMyVendorPhotos } from '@/data/vendor-photos-self';
import { switchToPlanning } from '@/features/business/app-mode';
import { NotLiveNotice } from '@/features/business/business-parts';
import { BusinessTabScreen } from '@/features/business/business-tab-screen';
import { GetPaid } from '@/features/business/get-paid';
import { PagePreview } from '@/features/business/page-preview';
import { chooseBusiness, useCurrentBusiness } from '@/features/business/use-current-business';
import { useLocale } from '@/i18n/locale-context';

/**
 * Business mode's My page tab (it was Business; the final look, 2026-10-23):
 * which business (when they run several), whether the page is live, then
 * the page exactly as families see it (a tap opens it), and everything that
 * makes it: photos, packages and menus, about and area, reels; then reaching
 * families: connecting their tools, Wedded Pro, their numbers; getting paid,
 * "Export everything" as a spreadsheet, Settings and "Switch to planning".
 * The families who asked are on Leads; the calendar has its own tab.
 */
export default function BusinessScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const current = useCurrentBusiness();
  const listing = useMyListing(current.vendorId);
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

  const photoList = photos.data ?? [];
  const cover = photoList.find((photo) => photo.isCover) ?? photoList[0] ?? null;

  return (
    <BusinessTabScreen title={t('business.myPage.title')}>
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

      <PagePreview
        name={business.name}
        line={listing.data?.tagline ?? listing.data?.city ?? null}
        coverUrl={cover?.url.medium ?? null}
        live={business.status === 'published'}
        onPress={() =>
          business.status === 'published'
            ? router.push({ pathname: '/v/[slug]', params: { slug: business.slug } })
            : router.push('/business/listing')
        }
      />

      <ListSection header={t('business.myPage.makeIt')}>
        <ListRow
          icon="images-outline"
          title={t('business.photos.title')}
          subtitle={t('business.myPage.photosHint')}
          value={photos.data ? String(photos.data.length) : undefined}
          onPress={() => router.push('/business/photos')}
        />
        <ListRow
          icon="restaurant-outline"
          title={t('business.myPage.packages')}
          subtitle={t('business.myPage.packagesHint')}
          value={menus.data ? String(menus.data.length) : undefined}
          onPress={() => router.push('/business/menus')}
        />
        <ListRow
          icon="create-outline"
          title={t('business.myPage.about')}
          subtitle={t('business.myPage.aboutHint')}
          onPress={() => router.push('/business/listing')}
        />
        <ListRow
          icon="play-circle-outline"
          title={t('business.myPage.reels')}
          subtitle={t('business.myPage.reelsHint')}
          onPress={() => router.navigate('/reels')}
        />
      </ListSection>

      <ListSection header={t('business.myPage.reach')}>
        <ListRow
          icon="link-outline"
          title={t('connect.title')}
          subtitle={t('business.myPage.connectHint')}
          onPress={() => router.push('/business/connect')}
        />
        <ListRow
          icon="megaphone-outline"
          title={t('business.myPage.pro')}
          subtitle={t('business.myPage.proHint')}
          onPress={() => router.push('/business/pro')}
        />
        <ListRow
          icon="stats-chart-outline"
          title={t('business.myPage.numbers')}
          subtitle={t('business.myPage.numbersHint')}
          onPress={() => router.push({ pathname: '/business/insights', params: { days: '30' } })}
        />
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
}));
