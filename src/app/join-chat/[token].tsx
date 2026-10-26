import { router, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { groupErrorKind, useAcceptGroupInvite, useGroupInvitePreview } from '@/data/group-chat';
import { useSession } from '@/features/auth/session';
import { i18n } from '@/i18n';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

/** For link previews: since SDK 58 only this reaches the page's HTML, not Head's tags. */
export function generateMetadata() {
  return {
    title: i18n.t('groupChat.join.pageTitle'),
    description: i18n.t('groupChat.join.pageDescription'),
  };
}

/**
 * Joining a family chat from a link (A2, #125). The link is usually tapped in
 * WhatsApp, often by a friend without the app, so this works on the web too
 * and says who sent it. Joining needs an account; the wedding plan stays
 * private. /join-chat/{token}
 */
export default function JoinChatScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { token = '' } = useLocalSearchParams<{ token: string }>();
  const { requireSignIn } = useSession();
  const preview = useGroupInvitePreview(token);
  const accept = useAcceptGroupInvite();

  const join = () =>
    accept.mutate(token, {
      onSuccess: (id) => {
        successHaptic();
        router.replace({ pathname: '/group/[id]', params: { id } });
      },
    });

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
          {t(`groupChat.join.status.${preview.data.status}`)}
        </AppText>
        <AppText color="text2">{t('groupChat.join.askForNewLink')}</AppText>
        <Button
          variant="secondary"
          label={t('common.goHome')}
          onPress={() => router.replace('/')}
        />
      </View>
    );
  } else {
    const { threadName, weddingTitle, inviterName, memberCount } = preview.data;
    body = (
      <View style={styles.card}>
        <Icon name="chatbubbles-outline" size={36} color={Colors.primary} />
        <AppText variant="bodyLg" color="text2">
          {inviterName
            ? t('groupChat.join.invitedBy', { name: inviterName })
            : t('groupChat.join.invited')}
        </AppText>
        <AppText variant="title" weight={700}>
          {threadName ?? t('groupChat.title')}
        </AppText>
        {weddingTitle && (
          <AppText variant="bodyLg">
            {t('groupChat.join.forWedding', { title: weddingTitle })}
          </AppText>
        )}
        <AppText color="text2">{t('groupChat.people', { count: memberCount })}</AppText>
        <AppText color="text2">{t('groupChat.join.explain')}</AppText>
        <Button
          icon="chatbubbles-outline"
          label={t('groupChat.join.join')}
          loading={accept.isPending}
          onPress={() => requireSignIn(join)}
        />
        {accept.isError && (
          <FieldError message={t(`groupChat.errors.${groupErrorKind(accept.error)}`)} />
        )}
      </View>
    );
  }

  return (
    <NavScreen title={t('groupChat.join.title')}>
      <Head>
        <title>{t('groupChat.join.pageTitle')}</title>
        <meta name="description" content={t('groupChat.join.pageDescription')} />
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
