import { router, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import type { Metadata } from 'expo-router/server';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { joinErrorKind, useAcceptInvite, useInvitePreview } from '@/data/wedding';
import { useSession } from '@/features/auth/session';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { i18n } from '@/i18n';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

/**
 * For link previews: since SDK 58 only this reaches the page's HTML, not
 * Head's tags. Noindex, because the link is someone's private invitation.
 */
export function generateMetadata(): Metadata {
  return {
    title: i18n.t('join.pageTitle'),
    description: i18n.t('join.pageDescription'),
    robots: 'noindex',
  };
}

/**
 * Joining a family's wedding plan from an invite link (Plan together). The
 * link is usually tapped in a WhatsApp group, often by someone without the
 * app, so this page works on the web too and says plainly who invited them.
 */
export default function JoinWeddingScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { token = '' } = useLocalSearchParams<{ token: string }>();
  const { requireSignIn } = useSession();
  const preview = useInvitePreview(token);
  const accept = useAcceptInvite();
  const [error, setError] = useState<string>();

  const join = () => {
    setError(undefined);
    accept.mutate(token, {
      onSuccess: () => {
        successHaptic();
        router.replace('/plan');
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
        <AppText color="text2">{t('join.askForNewLink')}</AppText>
        <Button
          variant="secondary"
          label={t('common.goHome')}
          onPress={() => router.replace('/')}
        />
      </View>
    );
  } else {
    const { title, weddingDate, inviterName, role } = preview.data;
    body = (
      <View style={styles.card}>
        <Icon name="people" size={36} color={Colors.primary} />
        <AppText variant="bodyLg" color="text2">
          {inviterName ? t('join.invitedBy', { name: inviterName }) : t('join.invited')}
        </AppText>
        <AppText variant="title" weight={700}>
          {title ?? t('join.aWedding')}
        </AppText>
        {weddingDate && <AppText variant="bodyLg">{formatDate(weddingDate)}</AppText>}
        <AppText color="text2">
          {role === 'suggester' ? t('join.suggesterExplain') : t('join.editorExplain')}
        </AppText>
        <Button
          icon="people-outline"
          label={t('join.join')}
          loading={accept.isPending}
          onPress={() => requireSignIn(join)}
        />
        {error && <FieldError message={error} />}
      </View>
    );
  }

  return (
    <NavScreen title={t('join.title')}>
      <Head>
        <title>{t('join.pageTitle')}</title>
        <meta name="description" content={t('join.pageDescription')} />
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
