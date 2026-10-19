import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { VaultIcon } from '@/components/vault-icon';
import { appLink } from '@/constants/links';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useAcceptVaultInvite, useVaultInvitePreview } from '@/data/memory-vault';
import { joinErrorKind } from '@/data/wedding';
import { useSession } from '@/features/auth/session';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

/**
 * A guest joining the couple's Memory Vault from the link or the QR card on
 * the tables. Works signed out: it shows whose wedding it is, then Join
 * (signing in first) goes straight to adding photos, on today's event if
 * there's one today. On the web it sends them to the app, since adding
 * photos needs it. Guests see only the vault, never the plan.
 */
export default function JoinVaultScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { token = '' } = useLocalSearchParams<{ token: string }>();
  const { requireSignIn } = useSession();
  const preview = useVaultInvitePreview(token);
  const accept = useAcceptVaultInvite();
  const [error, setError] = useState<string>();

  const join = () => {
    setError(undefined);
    accept.mutate(token, {
      onSuccess: (vaultId) => {
        successHaptic();
        // The vault opens on today's event by itself (the preview has no dates)
        router.replace({ pathname: '/vault/[id]', params: { id: vaultId, add: '1' } });
      },
      onError: (e) => setError(t(`join.errors.${joinErrorKind(e)}`)),
    });
  };

  let body;
  if (preview.isPending) {
    body = <StateView state="loading" />;
  } else if (preview.isError) {
    body = <StateView state="error" onRetry={() => void preview.refetch()} />;
  } else if (preview.data.status !== 'valid') {
    body = (
      <View style={styles.card}>
        <Icon name="link-outline" size={32} color={Colors.text2} />
        <AppText variant="heading" weight={700}>
          {t(`join.status.${preview.data.status}`)}
        </AppText>
        <AppText color="text2">{t('memoryVault.join.askForNewLink')}</AppText>
        <Button
          variant="secondary"
          label={t('common.goHome')}
          onPress={() => router.replace('/')}
        />
      </View>
    );
  } else {
    const { title, inviterName } = preview.data;
    body = (
      <View style={styles.card}>
        <VaultIcon size={40} color={Colors.primary} />
        <AppText variant="bodyLg" color="text2">
          {inviterName
            ? t('memoryVault.join.invitedBy', { name: inviterName })
            : t('memoryVault.join.invited')}
        </AppText>
        <AppText variant="title" weight={700}>
          {title ?? t('join.aWedding')}
        </AppText>
        <AppText color="text2">{t('memoryVault.join.explain')}</AppText>
        {Platform.OS === 'web' ? (
          <>
            <Button
              icon="phone-portrait-outline"
              label={t('memoryVault.join.openInApp')}
              onPress={() => void Linking.openURL(appLink(`/join-vault/${token}`))}
            />
            <AppText variant="label" weight={400} color="text2">
              {t('memoryVault.join.needsApp')}
            </AppText>
          </>
        ) : (
          <Button
            icon="images-outline"
            label={t('memoryVault.join.join')}
            loading={accept.isPending}
            onPress={() => requireSignIn(join)}
          />
        )}
        {error && <FieldError message={error} />}
      </View>
    );
  }

  return (
    <NavScreen title={t('memoryVault.title')}>
      <Head>
        <title>{t('memoryVault.join.pageTitle')}</title>
        <meta name="description" content={t('memoryVault.join.pageDescription')} />
      </Head>
      {body}
    </NavScreen>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    gap: Spacing.md,
    padding: Spacing.xl,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
}));
