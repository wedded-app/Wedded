import { BusinessTabScreen } from '@/features/business/business-tab-screen';
import { WantedFeed } from '@/features/requests/wanted-feed';
import { useLocale } from '@/i18n/locale-context';

/**
 * Wanted on its own (#221): the families looking, for links and the Pro row
 * on Today. Since 2026-10-23 it's off the tab bar, inside Leads.
 */
export default function FamiliesLookingScreen() {
  const { t } = useLocale();
  return (
    <BusinessTabScreen title={t('looking.title')} subtitle={t('looking.subtitle')}>
      <WantedFeed />
    </BusinessTabScreen>
  );
}
