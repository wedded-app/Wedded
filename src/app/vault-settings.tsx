import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { AppText } from '@/components/app-text';
import { FieldError } from '@/components/field-error';
import { ListRow, ListSection } from '@/components/list';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { StateView } from '@/components/state-view';
import { Switch } from '@/components/switch';
import { makeStyles, Spacing } from '@/constants/theme';
import { useVault, useVaultSettings, type MemoryVault } from '@/data/memory-vault';
import { shareInvite } from '@/data/wedding';
import { printHtml } from '@/features/tent/print-html';
import { tableTentHtml } from '@/features/tent/table-tent';
import { useVaultLink } from '@/features/vault/use-vault-link';
import { useLocale } from '@/i18n/locale-context';

type Setting = 'uploadsOpen' | 'guestsSeeAll' | 'showVendors';
const SETTINGS: Setting[] = ['uploadsOpen', 'guestsSeeAll', 'showVendors'];

/**
 * The couple's Memory Vault settings, as a sheet over the vault: invite
 * guests (the link through the share sheet, or a QR card printed for the
 * tables, folded like the vendors' table tent), lock uploads after the
 * wedding, who sees whose photos, and showing their vendors to guests.
 * /vault-settings?id={vault}
 */
export default function VaultSettingsScreen() {
  const { t } = useLocale();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const vault = useVault(id);
  const close = () => (router.canGoBack() ? router.back() : router.replace(`/vault/${id}`));

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader onClose={close} title={t('memoryVault.settings.title')} />
      {vault.isPending ? (
        <StateView state="loading" />
      ) : vault.data?.role !== 'couple' ? (
        <StateView state="empty" message={t('memoryVault.notFound')} />
      ) : (
        <Settings vault={vault.data} />
      )}
    </Screen>
  );
}

function Settings({ vault }: { vault: MemoryVault }) {
  const styles = useStyles();
  const { t } = useLocale();
  const update = useVaultSettings(vault.id);
  const getLink = useVaultLink(vault.id);
  const [problem, setProblem] = useState<'link' | 'print' | 'copied' | null>(null);
  // Switches move at once; the saved value comes back with the vault
  const [values, setValues] = useState(() => ({
    uploadsOpen: vault.uploadsOpen,
    guestsSeeAll: vault.guestsSeeAll,
    showVendors: vault.showVendors,
  }));

  const change = (setting: Setting, value: boolean) => {
    const before = values[setting];
    setValues((v) => ({ ...v, [setting]: value }));
    update.mutate(
      { [setting]: value },
      { onError: () => setValues((v) => ({ ...v, [setting]: before })) },
    );
  };

  const share = async () => {
    setProblem(null);
    const link = await getLink();
    if (!link) return setProblem('link');
    if ((await shareInvite(link, t, 'memoryVault.inviteMessage')) === 'copied') {
      setProblem('copied');
    }
  };

  const print = async () => {
    setProblem(null);
    const url = await getLink();
    if (!url) return setProblem('link');
    const html = tableTentHtml({
      url,
      name: vault.title ?? t('memoryVault.title'),
      founding: null,
      scan: t('memoryVault.card.scan'),
      findUs: t('memoryVault.card.top'),
    });
    if (!(await printHtml(html))) setProblem('print');
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <ListSection
        inset
        header={t('memoryVault.settings.invite')}
        footer={t('memoryVault.settings.inviteFooter')}
      >
        <ListRow
          icon="share-outline"
          title={t('memoryVault.settings.share')}
          onPress={() => void share()}
        />
        <ListRow
          icon="print-outline"
          title={t('memoryVault.settings.print')}
          subtitle={t('memoryVault.settings.printHint')}
          onPress={() => void print()}
        />
      </ListSection>
      {problem && (
        <AppText color={problem === 'copied' ? 'success' : 'error'} weight={600}>
          {problem === 'copied'
            ? t('memoryVault.link.copied')
            : problem === 'print'
              ? t('tent.printFailed')
              : t('memoryVault.link.failed')}
        </AppText>
      )}

      <ListSection header={t('memoryVault.settings.title')}>
        {SETTINGS.map((setting) => (
          <ListRow
            key={setting}
            title={t(`memoryVault.settings.${setting}`)}
            subtitle={t(`memoryVault.settings.${setting}Hint`)}
            trailing={
              <Switch
                value={values[setting]}
                onValueChange={(value) => change(setting, value)}
                accessibilityLabel={t(`memoryVault.settings.${setting}`)}
              />
            }
          />
        ))}
      </ListSection>
      {update.isError && <FieldError message={t('memoryVault.settings.failed')} />}
    </ScrollView>
  );
}

const useStyles = makeStyles(() => ({
  content: {
    gap: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
}));
