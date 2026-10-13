import { router } from 'expo-router';

import { Button } from '@/components/button';
import { ListRow, ListSection } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { useVendorMenus } from '@/data/vendor-menus';
import { useCurrentBusiness } from '@/features/business/use-current-business';
import { menuMinimum, menuPrice } from '@/features/menus/menu-format';
import { bilingual } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/**
 * My business → Menus: the menus families see on the page, each opening the
 * editor, and "Add a menu".
 */
export default function BusinessMenusScreen() {
  const { t, locale } = useLocale();
  const business = useCurrentBusiness();
  const menus = useVendorMenus(business.vendorId);
  const addMenu = () => router.push('/business/menu');

  let content;
  if (business.isPending) {
    content = <StateView state="loading" />;
  } else if (!business.isVendor) {
    content = (
      <StateView state="empty" icon="storefront-outline" message={t('business.notVendor')} />
    );
  } else if (menus.isPending) {
    content = <StateView state="loading" />;
  } else if (menus.isError) {
    content = <StateView state="error" onRetry={() => void menus.refetch()} />;
  } else if (menus.data.length === 0) {
    content = (
      <StateView
        state="empty"
        icon="restaurant-outline"
        message={t('business.menus.empty')}
        action={{ label: t('business.menus.add'), onPress: addMenu }}
      />
    );
  } else {
    content = (
      <>
        <ListSection footer={t('business.menus.hint')}>
          {menus.data.map((menu) => {
            const { primary } = bilingual(menu.name, locale);
            const details = [menuPrice(menu, t), menuMinimum(menu, t)].filter(Boolean).join(' · ');
            return (
              <ListRow
                key={menu.id}
                title={primary.text}
                titleLang={primary.lang}
                titleVariant="bodyLg"
                subtitle={details || undefined}
                accessibilityLabel={t('business.menus.editLabel', { name: primary.text })}
                onPress={() =>
                  router.push({ pathname: '/business/menu', params: { menuId: menu.id } })
                }
              />
            );
          })}
        </ListSection>
        <Button icon="add" label={t('business.menus.add')} onPress={addMenu} />
      </>
    );
  }

  return <NavScreen title={t('business.menus.title')}>{content}</NavScreen>;
}
