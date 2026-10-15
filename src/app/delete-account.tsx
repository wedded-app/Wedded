import { FunctionsHttpError } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { Sizes, Spacing, useColors } from '@/constants/theme';
import { toLatinDigits } from '@/features/auth/about-you-validation';
import { authErrorKey, reauthMethod } from '@/features/auth/auth-helpers';
import { useCaptcha } from '@/features/auth/captcha';
import { confirmWithProvider } from '@/features/auth/providers';
import { useSession } from '@/features/auth/session';
import { TurnstileBox } from '@/features/auth/turnstile-box';
import { useLocale } from '@/i18n/locale-context';
import { formatPhone } from '@/lib/phone';
import { supabase } from '@/lib/supabase';

const CODE_LENGTH = 6;

type Step = 'explain' | 'code' | 'confirm';

/**
 * Delete account (vision S19, required by Apple): screen 1 says plainly what
 * is removed and offers signing out instead; then they show it's really them
 * the way they signed up: a fresh email or text code (no English typing, and
 * a grandchild can't do it by accident), or signing in again with Apple or
 * Google followed by one last "Delete my account now". The delete-account
 * Edge Function checks that sign-in is fresh, then deletes.
 *
 * `?confirmed=google` is where the web lands after signing in again with
 * Google (a full-page redirect through /auth-callback).
 */
export default function DeleteAccountScreen() {
  const Colors = useColors();
  const { t } = useLocale();
  const { session, email, phone, signOut } = useSession();
  const queryClient = useQueryClient();
  const { confirmed } = useLocalSearchParams<{ confirmed?: string }>();
  const [step, setStep] = useState<Step>(confirmed === 'google' ? 'confirm' : 'explain');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // The proof-it's-you code goes through the same bot check as sign-in (#234)
  const captcha = useCaptcha();

  const method = session ? reauthMethod(session.user, Platform.OS) : null;
  const account = email ?? (phone ? formatPhone(phone) : null);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  /** Step 1's button: send a code, or sign in again with Apple or Google. */
  async function start() {
    setError(undefined);
    if (method === 'apple' || method === 'google') {
      setBusy(true);
      const result = await confirmWithProvider(method);
      setBusy(false);
      if (result === 'signedIn') setStep('confirm');
      else if (result === 'otherAccount') setError(t('deleteAccount.otherAccount'));
      else if (result !== 'cancelled') {
        setError(
          t(method === 'apple' ? 'signIn.errors.appleFailed' : 'signIn.errors.googleFailed'),
        );
      }
      return;
    }

    if (!captcha.ready) {
      setError(t('signIn.captchaWait'));
      return;
    }
    let sendError;
    setBusy(true);
    if (method === 'email' && email) {
      ({ error: sendError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, ...captcha.take() },
      }));
    } else if (method === 'phone' && phone) {
      ({ error: sendError } = await supabase.auth.signInWithOtp({
        phone,
        options: { shouldCreateUser: false, ...captcha.take() },
      }));
    }
    setBusy(false);
    if (sendError) {
      setError(t(authErrorKey(sendError, method === 'phone' ? 'phone' : 'email')));
      return;
    }
    setStep('code');
  }

  async function confirmCode(token: string) {
    if (token.length !== CODE_LENGTH) {
      setError(t('signIn.errors.codeLength'));
      return;
    }
    setBusy(true);
    setError(undefined);
    let verifyError;
    if (method === 'phone' && phone) {
      ({ error: verifyError } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' }));
    } else if (email) {
      ({ error: verifyError } = await supabase.auth.verifyOtp({ email, token, type: 'email' }));
    }
    if (verifyError) {
      setBusy(false);
      setCode('');
      setError(t(method === 'phone' ? 'signIn.errors.codeWrongPhone' : 'signIn.errors.codeWrong'));
      return;
    }
    await deleteNow();
  }

  async function deleteNow() {
    setBusy(true);
    setError(undefined);
    const { error: deleteError } = await supabase.functions.invoke('delete-account', { body: {} });
    if (deleteError) {
      setBusy(false);
      const status =
        deleteError instanceof FunctionsHttpError ? (deleteError.context as Response).status : 0;
      if (status === 403) {
        // The fresh sign-in is more than 10 minutes old: start again.
        setStep('explain');
        setError(t('deleteAccount.tooSlow'));
      } else {
        setError(t('deleteAccount.failed'));
      }
      return;
    }
    // The account is gone: forget it on this phone and go Home, logged out.
    queryClient.clear();
    await supabase.auth.signOut({ scope: 'local' });
    if (router.canDismiss()) router.dismissAll();
    router.replace('/');
  }

  if (!session) {
    return (
      <Screen edges={['top', 'bottom']}>
        <SheetHeader onClose={close} />
        <StateView
          state="empty"
          icon="person-circle-outline"
          message={t('deleteAccount.signInFirst')}
          action={{ label: t('profile.account.signIn'), onPress: () => router.replace('/sign-in') }}
        />
      </Screen>
    );
  }

  let body;
  if (step === 'explain') {
    body = (
      <>
        <Card style={styles.list}>
          <AppText weight={700}>{t('deleteAccount.removes')}</AppText>
          {['profile', 'saved', 'inquiries'].map((item) => (
            <View key={item} style={styles.row}>
              <Icon name="close-circle-outline" size={Sizes.iconSmall} color={Colors.error} />
              <AppText style={styles.grow}>{t(`deleteAccount.items.${item}`)}</AppText>
            </View>
          ))}
        </Card>
        <AppText color="text2">{t('deleteAccount.vendorsKeep')}</AppText>
        <Card style={styles.list}>
          <AppText>{t('deleteAccount.preferSignOut')}</AppText>
          <Button
            variant="secondary"
            label={t('profile.account.signOut')}
            onPress={async () => {
              await signOut();
              close();
            }}
          />
        </Card>
        {method === 'apple' || method === 'google' ? (
          <AppText>
            {t(method === 'apple' ? 'deleteAccount.reauthApple' : 'deleteAccount.reauthGoogle')}
          </AppText>
        ) : null}
        {error && <FieldError message={error} />}
        {method ? (
          <Button
            variant="danger"
            icon="trash-outline"
            label={t('deleteAccount.delete')}
            loading={busy}
            onPress={start}
          />
        ) : (
          <FieldError message={t('deleteAccount.cantConfirm')} />
        )}
      </>
    );
  } else if (step === 'code') {
    body = (
      <>
        <AppText variant="bodyLg">
          {method === 'phone' && phone
            ? t('deleteAccount.codeTexted', { phone: formatPhone(phone) })
            : t('deleteAccount.codeSent', { email: email ?? '' })}
        </AppText>
        <TextField
          label={t('signIn.code')}
          value={code}
          onChangeText={(text) => {
            const digits = toLatinDigits(text).replace(/\D/g, '').slice(0, CODE_LENGTH);
            setCode(digits);
            setError(undefined);
          }}
          error={error}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={12}
          autoFocus
        />
        <Button
          variant="danger"
          icon="trash-outline"
          label={t('deleteAccount.confirm')}
          loading={busy}
          onPress={() => confirmCode(code)}
        />
        <Button variant="text" label={t('deleteAccount.keep')} onPress={close} />
      </>
    );
  } else {
    body = (
      <>
        <AppText variant="bodyLg">
          {account ? t('deleteAccount.confirmAccount', { account }) : t('deleteAccount.confirmNow')}
        </AppText>
        {error && <FieldError message={error} />}
        <Button
          variant="danger"
          icon="trash-outline"
          label={t('deleteAccount.confirm')}
          loading={busy}
          onPress={deleteNow}
        />
        <Button variant="text" label={t('deleteAccount.keep')} onPress={close} />
      </>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader onClose={close} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText variant="title" accessibilityRole="header">
          {t('deleteAccount.title')}
        </AppText>
        {body}
        <TurnstileBox captcha={captcha} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  list: {
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  grow: {
    flex: 1,
  },
});
