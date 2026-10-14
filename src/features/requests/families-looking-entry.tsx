import { router } from 'expo-router';

import { ListRow, ListSection } from '@/components/list';
import { useFamiliesLookingSummary, useProStatus } from '@/data/requests';
import { useLocale } from '@/i18n/locale-context';

import { ProTeaser } from './pro-teaser';

/**
 * On My business (#221): Pro vendors get a row into Families looking with
 * how many are looking; everyone else gets the teaser card with Go Pro.
 */
export function FamiliesLookingEntry({ vendorId }: { vendorId: string }) {
  const { t } = useLocale();
  const pro = useProStatus(vendorId);
  const summary = useFamiliesLookingSummary(vendorId);
  if (pro.isPending) return null;
  if (pro.data?.plan !== 'pro') return <ProTeaser vendorId={vendorId} />;
  return (
    <ListSection>
      <ListRow
        icon="megaphone-outline"
        title={t('looking.title')}
        subtitle={t('looking.rowHint')}
        value={summary.data ? String(summary.data.total) : undefined}
        onPress={() => router.push('/business/looking')}
      />
    </ListSection>
  );
}
