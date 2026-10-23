import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Segmented } from '@/components/segmented';
import { StateView } from '@/components/state-view';
import { makeStyles, Spacing } from '@/constants/theme';
import { useBusinessLeads, waitingCount } from '@/data/business';
import { LeadRow } from '@/features/business/business-parts';
import { BusinessTabScreen } from '@/features/business/business-tab-screen';
import { useCurrentBusiness } from '@/features/business/use-current-business';
import { WantedFeed } from '@/features/requests/wanted-feed';
import { useLocale } from '@/i18n/locale-context';
import { Motion } from '@/lib/motion';

type Half = 'asked' | 'wanted';

/**
 * Business mode's Leads tab, in two halves (the final look, 2026-10-23):
 * Asked you, the families who asked about price and date or to tour, the
 * ones still waiting for a reply first, each opening the request with its
 * answers and the ways to reply; and Wanted · Pro, the families near them
 * who posted what they need (it was its own tab). `?half=wanted` opens the
 * second. Pull to refresh; leads also refresh on their own every minute.
 */
export default function BusinessLeadsScreen() {
  const styles = useStyles();
  const { t } = useLocale();
  const params = useLocalSearchParams<{ half?: string }>();
  const [half, setHalf] = useState<Half>(params.half === 'wanted' ? 'wanted' : 'asked');
  const current = useCurrentBusiness();
  const leads = useBusinessLeads(current.vendorId);

  let asked;
  if (current.isPending) {
    asked = <StateView state="loading" />;
  } else if (!current.business) {
    asked = <StateView state="empty" icon="storefront-outline" message={t('business.notVendor')} />;
  } else if (leads.isPending) {
    asked = <StateView state="loading" />;
  } else if (leads.isError) {
    asked = <StateView state="error" onRetry={() => void leads.refetch()} />;
  } else if (leads.data.length === 0) {
    asked = <StateView state="empty" icon="people-outline" message={t('business.leads.empty')} />;
  } else {
    const waiting = waitingCount(leads.data);
    asked = (
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
    <BusinessTabScreen
      title={t('business.leads.tabTitle')}
      refreshControl={
        half === 'asked' ? (
          <RefreshControl refreshing={leads.isRefetching} onRefresh={() => void leads.refetch()} />
        ) : undefined
      }
    >
      <Segmented<Half>
        accessibilityLabel={t('business.leads.halves')}
        value={half}
        onChange={setHalf}
        options={[
          { value: 'asked', label: t('business.leads.askedYou') },
          { value: 'wanted', label: t('business.leads.wantedPro') },
        ]}
      />
      <Animated.View key={half} entering={Motion.enter} style={styles.half}>
        {half === 'asked' ? asked : <WantedFeed />}
      </Animated.View>
    </BusinessTabScreen>
  );
}

const useStyles = makeStyles(() => ({
  half: {
    gap: Spacing.lg,
  },
}));
