import type { ReactNode } from 'react';

import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { StateView } from '@/components/state-view';
import { useLocale } from '@/i18n/locale-context';

import type { useAsk } from './use-ask';

/**
 * The page around each step of Ask for a quote: plain white (black in dark
 * mode), safe from the notch and the home bar. Until the vendor has loaded
 * there's nothing to ask, but there's always a way out.
 */
export function AskScreen({
  ask,
  children,
}: {
  ask: ReturnType<typeof useAsk>;
  children: ReactNode;
}) {
  const { t } = useLocale();
  const { draft, vendor } = ask;
  let notReady: ReactNode = null;
  if (!draft.vendorId || vendor.isError) {
    notReady = <StateView state="error" onRetry={() => void vendor.refetch()} />;
  } else if (vendor.isPending) {
    notReady = <StateView state="loading" />;
  } else if (!vendor.data) {
    notReady = (
      <StateView state="empty" icon="storefront-outline" message={t('inquiry.errors.vendorGone')} />
    );
  }
  return (
    <Screen edges={['top', 'bottom']} plain>
      {notReady ? (
        <>
          <SheetHeader onClose={() => ask.leave()} />
          {notReady}
        </>
      ) : (
        children
      )}
    </Screen>
  );
}
