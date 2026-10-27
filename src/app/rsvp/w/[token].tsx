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
import { TextField } from '@/components/text-field';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { findInvitation, guestErrorKind } from '@/data/guests';
import { i18n } from '@/i18n';
import { useLocale } from '@/i18n/locale-context';

/** Like the family's own RSVP link: a private invitation, so noindex. */
export function generateMetadata(): Metadata {
  return {
    title: i18n.t('rsvp.pageTitle'),
    description: i18n.t('rsvp.pageDescription'),
    robots: 'noindex',
  };
}

/**
 * The wedding's one RSVP link (#337), /rsvp/w/{token}, the same for everyone
 * in a group text or WhatsApp group. A guest types the phone number or email
 * the family has for them and goes to their own RSVP page. No account needed.
 */
export default function FindInvitationScreen() {
  const styles = useStyles();
  const Colors = useColors();
  const { t } = useLocale();
  const { token = '' } = useLocalSearchParams<{ token: string }>();
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [dead, setDead] = useState(false);
  const [problem, setProblem] = useState<string>();

  const find = async () => {
    if (!contact.trim() || busy) return;
    setBusy(true);
    setProblem(undefined);
    try {
      const familyToken = await findInvitation(token, contact);
      if (familyToken) router.push(`/rsvp/${familyToken}`);
      else setProblem(t('website.site.notFound'));
    } catch (e) {
      const kind = guestErrorKind(e);
      if (kind === 'notFound') setDead(true);
      else
        setProblem(t(kind === 'findLimit' ? 'website.site.findLimit' : 'website.site.findFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <NavScreen title={t('rsvp.title')}>
      <Head>
        <title>{t('rsvp.pageTitle')}</title>
        <meta name="description" content={t('rsvp.pageDescription')} />
      </Head>
      {dead ? (
        <View style={styles.card}>
          <Icon name="link-outline" size={32} color={Colors.text2} />
          <AppText variant="heading" weight={700}>
            {t('rsvp.notFound')}
          </AppText>
          <AppText color="text2">{t('rsvp.askFamily')}</AppText>
        </View>
      ) : (
        <View style={styles.card}>
          <AppText variant="heading" weight={700}>
            {t('rsvp.findTitle')}
          </AppText>
          <AppText color="text2">{t('website.site.findHint')}</AppText>
          {/* Not the phone keypad: a family without a phone is found by email */}
          <TextField
            label={t('website.site.findLabel')}
            value={contact}
            onChangeText={setContact}
            onSubmitEditing={() => void find()}
            autoComplete="tel"
            textContentType="telephoneNumber"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
          />
          {problem && <FieldError message={problem} />}
          <Button
            icon="search-outline"
            label={t('website.site.find')}
            loading={busy}
            disabled={!contact.trim()}
            onPress={() => void find()}
          />
        </View>
      )}
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
