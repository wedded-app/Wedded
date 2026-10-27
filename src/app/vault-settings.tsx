import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { ListRow, ListSection } from '@/components/list';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { StateView } from '@/components/state-view';
import { Switch } from '@/components/switch';
import { makeStyles, Spacing } from '@/constants/theme';
import {
  useRemoveVaultGuest,
  useVault,
  useVaultPeople,
  useVaultSettings,
  type MemoryVault,
} from '@/data/memory-vault';
import { shareInvite } from '@/data/wedding';
import { confirm } from '@/features/guests/pick-sheet';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { printHtml } from '@/features/tent/print-html';
import { tableTentHtml } from '@/features/tent/table-tent';
import { useVaultLink } from '@/features/vault/use-vault-link';
import { useLocale } from '@/i18n/locale-context';

type Setting = 'uploadsOpen' | 'guestsSeeAll' | 'showVendors';
const SETTINGS: Setting[] = ['uploadsOpen', 'guestsSeeAll', 'showVendors'];

/**
 * The couple's Memory Vault settings, as a sheet over the vault: invite
 * guests (the link through the share sheet, or a QR card printed for the
 * tables, folded like the vendors' table tent), who joined and removing
 * someone (#351), lock uploads after the wedding, who sees whose photos, and
 * showing their vendors to guests.
 * /vault-settings?id={vault}
 */
export default function VaultSettingsScreen() {
  const { t } = useLocale();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const vault = useVault(id);
  const close = () => (router.canGoBack() ? router.back() : router.replace(`/vault/${id}`));

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader onClose={close} title={t('memoryVault.title')} />
      {vault.isPending ? (
        <StateView state="loading" />
      ) : vault.data?.role !== 'couple' ? (
        <StateView state="empty" icon="lock-closed-outline" message={t('memoryVault.notFound')} />
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

      <People vaultId={vault.id} />

      <ListSection header={t('memoryVault.settings.section')}>
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

/** Everyone who joined by the link, with Remove; what they added stays. */
function People({ vaultId }: { vaultId: string }) {
  const { t } = useLocale();
  const people = useVaultPeople(vaultId);
  const remove = useRemoveVaultGuest();
  const list = people.data ?? [];

  const removeSomeone = (userId: string, name: string) =>
    confirm(
      t('memoryVault.people.removeTitle', { name }),
      t('memoryVault.people.removeBody'),
      t('memoryVault.people.remove'),
      t('memoryVault.people.keep'),
      () => remove.mutate({ vaultId, userId }),
    );

  if (people.isPending) return null;
  return (
    <>
      <ListSection
        header={t('memoryVault.people.title')}
        footer={list.length === 0 ? t('memoryVault.people.empty') : t('memoryVault.people.footer')}
      >
        {list.map((person) => {
          const name = person.firstName ?? t('memoryVault.people.noName');
          return (
            <ListRow
              key={person.userId}
              icon="person-outline"
              title={name}
              subtitle={[
                t('memoryVault.people.joined', { date: formatDate(person.joinedAt.slice(0, 10)) }),
                person.itemCount > 0
                  ? t('memoryVault.people.added', { count: person.itemCount })
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              trailing={
                <Button
                  variant="text"
                  label={t('memoryVault.people.remove')}
                  onPress={() => removeSomeone(person.userId, name)}
                />
              }
            />
          );
        })}
      </ListSection>
      {(people.isError || remove.isError) && (
        <FieldError message={t('memoryVault.settings.failed')} />
      )}
    </>
  );
}

const useStyles = makeStyles(() => ({
  content: {
    gap: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
}));
