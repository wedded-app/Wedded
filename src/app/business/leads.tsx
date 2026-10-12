import { router } from 'expo-router';
import { RefreshControl } from 'react-native';

import { AppText } from '@/components/app-text';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { useBusinessLeads, waitingCount } from '@/data/business';
import { LeadRow } from '@/features/business/business-parts';
import { useCurrentBusiness } from '@/features/business/use-current-business';
import { useLocale } from '@/i18n/locale-context';

/**
 * My business → the families who asked about price and date, or to tour:
 * the ones still waiting for a reply first, newest first. Each opens the
 * request with its answers and the ways to reply. Pull to refresh; it also
 * refreshes on its own every minute.
 */
export default function BusinessLeadsScreen() {
  const { t } = useLocale();
  const current = useCurrentBusiness();
  const leads = useBusinessLeads(current.vendorId);

  let content;
  if (current.isPending) {
    content = <StateView state="loading" />;
  } else if (!current.business) {
    content = (
      <StateView state="empty" icon="storefront-outline" message={t('business.notVendor')} />
    );
  } else if (leads.isPending) {
    content = <StateView state="loading" />;
  } else if (leads.isError) {
    content = <StateView state="error" onRetry={() => void leads.refetch()} />;
  } else if (leads.data.length === 0) {
    content = <StateView state="empty" icon="people-outline" message={t('business.leads.empty')} />;
  } else {
    const waiting = waitingCount(leads.data);
    content = (
      <>
        <AppText color={waiting > 0 ? 'primary' : 'text2'} weight={waiting > 0 ? 600 : 400}>
          {waiting > 0
            ? t('business.leads.waitingCount', { count: waiting })
            : t('business.leads.allReplied')}
        </AppText>
        {leads.data.map((lead) => (
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
    <NavScreen
      title={t('business.leads.title')}
      refreshControl={
        <RefreshControl refreshing={leads.isRefetching} onRefresh={() => void leads.refetch()} />
      }
    >
      {content}
    </NavScreen>
  );
}
