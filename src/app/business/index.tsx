import { router } from 'expo-router';

import { ListRow, ListSection } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { useVendorMenus } from '@/data/vendor-menus';
import { useCurrentBusiness } from '@/features/business/use-current-business';
import { useLocale } from '@/i18n/locale-context';

/**
 * My business (C6): where a vendor account looks after its listing. For now
 * its menus and its calendar; how the page is doing and the families who
 * asked come next. Opened from Profile, only for vendor accounts.
 */
export default function BusinessScreen() {
  const { t } = useLocale();
  const business = useCurrentBusiness();
  const menus = useVendorMenus(business.vendorId);

  let content;
  if (business.isPending) {
    content = <StateView state="loading" />;
  } else if (!business.isVendor) {
    content = (
      <StateView state="empty" icon="storefront-outline" message={t('business.notVendor')} />
    );
  } else {
    const menuCount = menus.data?.length;
    content = (
      <ListSection header={t('business.yourListing')} footer={t('business.listingHint')}>
        <ListRow
          icon="restaurant-outline"
          title={t('business.menus.title')}
          subtitle={t('business.menus.rowHint')}
          value={menuCount === undefined ? undefined : String(menuCount)}
          onPress={() => router.push('/business/menus')}
        />
        <ListRow
          icon="calendar-outline"
          title={t('business.calendar.title')}
          subtitle={t('business.calendar.rowHint')}
          onPress={() => router.push('/business/calendar')}
        />
      </ListSection>
    );
  }

  return <NavScreen title={t('business.title')}>{content}</NavScreen>;
}
