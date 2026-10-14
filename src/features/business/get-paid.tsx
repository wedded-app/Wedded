import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Icon } from '@/components/icon';
import { ListRow, ListSection } from '@/components/list';
import { useColors } from '@/constants/theme';
import { depositProblem, useConnectPayments, usePaymentAccount } from '@/data/deposits';
import { useLocale } from '@/i18n/locale-context';

/**
 * My business: "Get paid through Wedded" (#209). The vendor connects a free
 * Stripe account on Stripe's own page in the browser and comes back; then
 * families can pay deposits by card in chat. Not connected, finishing setup,
 * or ready. Until Stripe is set up for Wedded, it says it's coming soon.
 */
export function GetPaid({ vendorId }: { vendorId: string }) {
  const Colors = useColors();
  const { t } = useLocale();
  const account = usePaymentAccount(vendorId);
  const connect = useConnectPayments(vendorId);
  const [opening, setOpening] = useState(false);
  const [footer, setFooter] = useState<string | null>(null);
  const status = account.data ?? 'none';

  const open = async () => {
    setFooter(null);
    setOpening(true);
    try {
      const { url } = await connect.mutateAsync('link');
      if (url) {
        await WebBrowser.openBrowserAsync(url);
        // Back from Stripe: ask where the setup got to
        connect.mutate('refresh');
      }
    } catch (error) {
      setFooter(t(`business.getPaid.problems.${depositProblem(error)}`));
    } finally {
      setOpening(false);
    }
  };

  const ready = status === 'ready';
  return (
    <ListSection footer={footer ?? t('business.getPaid.footer')}>
      <ListRow
        icon="card-outline"
        title={t(`business.getPaid.${status}.title`)}
        subtitle={t(`business.getPaid.${status}.hint`)}
        chevron={!ready}
        onPress={ready || opening ? undefined : () => void open()}
        trailing={
          opening ? (
            <ActivityIndicator color={Colors.primary} />
          ) : ready ? (
            <Icon name="checkmark-circle" size={24} color={Colors.success} />
          ) : undefined
        }
      />
    </ListSection>
  );
}
