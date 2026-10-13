import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { GlassButton } from '@/components/glass-button';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { Spacing, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';
import { formatPhone } from '@/lib/phone';
import { supabase } from '@/lib/supabase';

import { AboutYouForm, type AboutYouValues } from './about-you-form';
import { isValidEmail, normalizePhone, toLatinDigits } from './about-you-validation';
import { authErrorKey } from './auth-helpers';
import { formatPhoneDigits, nextPhoneDigits } from './phone-entry';
import { useSession } from './session';
import { SignInOptions } from './sign-in-options';

const CODE_LENGTH = 6;
/** Supabase lets an address or number ask for a new code once a minute. */
const RESEND_SECONDS = 60;

export type SignInMode = 'signIn' | 'edit';
export type SignInMethod = 'phone' | 'email';

/** Where a code went: an email address, or a phone number in E.164. */
type CodeTarget = { kind: SignInMethod; to: string };

type Step = 'choose' | SignInMethod | 'code';

/** Send a sign-in code by email or text. New people get an account. */
function sendCode({ kind, to }: CodeTarget) {
  return kind === 'email'
    ? supabase.auth.signInWithOtp({ email: to, options: { shouldCreateUser: true } })
    : supabase.auth.signInWithOtp({ phone: to, options: { shouldCreateUser: true } });
}

/**
 * Sign-in and account setup in one modal (vision S13 and S14). Opened plainly
 * (what requireSignIn does for Save and Ask) it starts on the choice of
 * Apple, Google, phone or email; `method` opens straight on phone or email.
 * Phone and email send a 6-digit code; then About you if there's no profile
 * yet. New and returning people take the same path; there is no password.
 * In edit mode it opens straight on About you with their details filled in.
 */
export function SignInFlow({ mode, method }: { mode: SignInMode; method?: SignInMethod }) {
  const Colors = useColors();
  const { t } = useLocale();
  const { status, session, reloadProfile, finishSignIn, cancelSignIn } = useSession();
  const [step, setStep] = useState<Step>(method ?? 'choose');
  const [target, setTarget] = useState<CodeTarget | null>(null);
  // What they typed, kept when they go back to fix it.
  const [typedEmail, setTypedEmail] = useState('');
  const [typedPhone, setTypedPhone] = useState('');
  const finished = useRef(false);

  // Signed in without a profile (a code was just accepted, Apple or Google
  // just finished, or they came from Profile to finish setting up), or
  // editing: About you.
  const showAboutYou = mode === 'edit' || status === 'needsProfile';

  // Opened as a page of its own (a web link, or /auth-callback on the web),
  // there's nothing to go back to: go Home instead.
  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  const done = useCallback(() => {
    finished.current = true;
    const canGoBack = router.canGoBack();
    finishSignIn();
    if (!canGoBack) router.replace('/');
  }, [finishSignIn]);

  // Signed in with a profile, i.e. a returning person: nothing more to ask.
  useEffect(() => {
    if (mode === 'edit' || finished.current) return;
    if (status === 'signedIn') done();
  }, [mode, status, done]);

  // Closing the sheet without finishing forgets the action that was waiting.
  useEffect(() => () => cancelSignIn(), [cancelSignIn]);

  let content;
  let back: (() => void) | undefined;
  if (showAboutYou) {
    content = <AboutYouStep onDone={done} />;
  } else if (status === 'error') {
    content = <StateView state="error" onRetry={reloadProfile} />;
  } else if (status === 'signedIn' || status === 'loading') {
    // A code, Apple or Google just worked and the profile is loading: say so
    // rather than flashing the options again.
    content = <StateView state="loading" message={session ? t('signIn.signingIn') : undefined} />;
  } else if (step === 'choose') {
    content = <ChooseStep onChoose={setStep} />;
  } else if (step === 'email') {
    back = () => setStep('choose');
    content = (
      <EmailStep
        initialEmail={typedEmail}
        onSent={(sentTo) => {
          setTypedEmail(sentTo);
          setTarget({ kind: 'email', to: sentTo });
          setStep('code');
        }}
        onOtherWays={back}
      />
    );
  } else if (step === 'phone') {
    back = () => setStep('choose');
    content = (
      <PhoneStep
        initialPhone={typedPhone}
        onSent={(sentTo, typed) => {
          setTypedPhone(typed);
          setTarget({ kind: 'phone', to: sentTo });
          setStep('code');
        }}
        onOtherWays={back}
      />
    );
  } else if (target) {
    back = () => setStep(target.kind);
    content = <CodeStep target={target} onChange={back} />;
  } else {
    content = <ChooseStep onChoose={setStep} />;
  }

  return (
    <Screen edges={['top', 'bottom']} plain>
      <SheetHeader
        onClose={leave}
        leading={
          back && (
            <GlassButton
              icon="chevron-back"
              color={Colors.text}
              accessibilityLabel={t('common.back')}
              onPress={back}
              size={44}
            />
          )
        }
      />
      {content}
    </Screen>
  );
}

function ChooseStep({ onChoose }: { onChoose: (method: SignInMethod) => void }) {
  const { t } = useLocale();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppText variant="title" accessibilityRole="header">
        {t('signIn.title')}
      </AppText>
      <AppText variant="bodyLg" color="text2">
        {t('signIn.why')}
      </AppText>
      <SignInOptions onChoose={onChoose} />
    </ScrollView>
  );
}

function EmailStep({
  initialEmail,
  onSent,
  onOtherWays,
}: {
  initialEmail: string;
  onSent: (email: string) => void;
  onOtherWays: () => void;
}) {
  const { t } = useLocale();
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  async function send() {
    const clean = email.trim().toLowerCase();
    if (!isValidEmail(clean)) {
      setError(t('signIn.errors.emailInvalid'));
      return;
    }
    setError(undefined);
    setSending(true);
    const { error: authError } = await sendCode({ kind: 'email', to: clean });
    setSending(false);
    if (authError) {
      setError(t(authErrorKey(authError, 'email')));
      return;
    }
    onSent(clean);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <AppText variant="title" accessibilityRole="header">
        {t('signIn.title')}
      </AppText>
      <AppText variant="bodyLg" color="text2">
        {t('signIn.subtitle')}
      </AppText>
      <TextField
        type="email"
        label={t('signIn.email')}
        value={email}
        onChangeText={setEmail}
        error={error}
        maxLength={254}
        autoFocus
        returnKeyType="send"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={send}
      />
      <Button label={t('signIn.sendCode')} icon="mail-outline" loading={sending} onPress={send} />
      <Button variant="text" label={t('signIn.otherWays')} onPress={onOtherWays} />
    </ScrollView>
  );
}

function PhoneStep({
  initialPhone,
  onSent,
  onOtherWays,
}: {
  initialPhone: string;
  /** The number in E.164, and as they typed it. */
  onSent: (phone: string, typed: string) => void;
  onOtherWays: () => void;
}) {
  const { t } = useLocale();
  const [phone, setPhone] = useState(initialPhone);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  async function send() {
    const e164 = normalizePhone(phone);
    if (!e164) {
      setError(t(phone.trim() ? 'aboutYou.errors.phoneInvalid' : 'aboutYou.errors.phoneRequired'));
      return;
    }
    setError(undefined);
    setSending(true);
    const { error: authError } = await sendCode({ kind: 'phone', to: e164 });
    setSending(false);
    if (authError) {
      setError(t(authErrorKey(authError, 'phone')));
      return;
    }
    onSent(e164, phone);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <AppText variant="title" accessibilityRole="header">
        {t('signIn.phoneTitle')}
      </AppText>
      <AppText variant="bodyLg" color="text2">
        {t('signIn.phoneSubtitle')}
      </AppText>
      <TextField
        type="phone"
        label={t('signIn.phone')}
        hint={t('signIn.phoneHint')}
        value={phone}
        onChangeText={(text) =>
          // US numbers space out as they're typed, like /phone-sign-in;
          // a number starting with + (another country) stays as typed
          setPhone(
            text.trim().startsWith('+')
              ? text
              : formatPhoneDigits(nextPhoneDigits(phone.replace(/\D/g, ''), text, '1'), '1'),
          )
        }
        error={error}
        maxLength={20}
        autoFocus
        returnKeyType="send"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={send}
      />
      <Button
        label={t('signIn.textCode')}
        icon="chatbubble-outline"
        loading={sending}
        onPress={send}
      />
      <Button variant="text" label={t('signIn.otherWays')} onPress={onOtherWays} />
    </ScrollView>
  );
}

function CodeStep({ target, onChange }: { target: CodeTarget; onChange: () => void }) {
  const { t } = useLocale();
  const { kind, to } = target;
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // On success the session changes and SignInFlow moves on by itself.
  async function verify(token: string) {
    if (token.length !== CODE_LENGTH) {
      setError(t('signIn.errors.codeLength'));
      return;
    }
    setError(undefined);
    setNotice(undefined);
    setVerifying(true);
    const { error: authError } =
      kind === 'email'
        ? await supabase.auth.verifyOtp({ email: to, token, type: 'email' })
        : await supabase.auth.verifyOtp({ phone: to, token, type: 'sms' });
    setVerifying(false);
    if (authError) {
      const message = t(authErrorKey(authError, kind));
      setError(message);
      setCode('');
      AccessibilityInfo.announceForAccessibility(message);
    }
  }

  function changeCode(text: string) {
    const digits = toLatinDigits(text).replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH && !verifying) {
      void verify(digits);
    }
  }

  async function resend() {
    setError(undefined);
    setResending(true);
    const { error: authError } = await sendCode(target);
    setResending(false);
    if (authError) {
      setError(t(authErrorKey(authError, kind)));
      return;
    }
    const sent = t(kind === 'email' ? 'signIn.newCodeSent' : 'signIn.newCodeTexted');
    setCooldown(RESEND_SECONDS);
    setNotice(sent);
    AccessibilityInfo.announceForAccessibility(sent);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <AppText variant="title" accessibilityRole="header">
        {t(kind === 'email' ? 'signIn.checkEmail' : 'signIn.checkPhone')}
      </AppText>
      <AppText variant="bodyLg">
        {kind === 'email'
          ? t('signIn.codeSentTo', { email: to })
          : t('signIn.codeTextedTo', { phone: formatPhone(to) })}
      </AppText>
      <TextField
        label={t('signIn.code')}
        value={code}
        onChangeText={changeCode}
        error={error}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={12}
        autoFocus
      />
      {notice && <AppText color="success">{notice}</AppText>}
      <Button label={t('signIn.verify')} loading={verifying} onPress={() => verify(code)} />
      <AppText color="text2">
        {t(kind === 'email' ? 'signIn.checkSpam' : 'signIn.textDelay')}
      </AppText>
      <Button
        variant="text"
        label={cooldown > 0 ? t('signIn.resendIn', { seconds: cooldown }) : t('signIn.resend')}
        disabled={cooldown > 0}
        loading={resending}
        onPress={resend}
      />
      <Button
        variant="text"
        label={t(kind === 'email' ? 'signIn.changeEmail' : 'signIn.changePhone')}
        onPress={onChange}
      />
    </ScrollView>
  );
}

function AboutYouStep({ onDone }: { onDone: () => void }) {
  const { t } = useLocale();
  const { session, email, phone, nameHint, profile, profileSaved } = useSession();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  if (!session) {
    return <StateView state="loading" />;
  }
  const userId = session.user.id;
  // The profile's number first (editing), else the one they signed in with.
  const knownPhone = profile?.phone ?? phone;

  async function save(values: AboutYouValues) {
    setError(undefined);
    setSaving(true);
    const { data, error: saveError } = await supabase
      .from('profiles')
      .upsert({ id: userId, full_name: values.name, city: values.city, phone: values.phone })
      .select()
      .single();
    setSaving(false);
    if (saveError || !data) {
      setError(t('aboutYou.saveFailed'));
      return;
    }
    // A new account (not an edit) gets the success tap (vision §4).
    if (!profile) successHaptic();
    profileSaved(data);
    onDone();
  }

  return (
    <AboutYouForm
      initialValues={{
        email: email ?? '',
        name: profile?.full_name ?? nameHint ?? undefined,
        city: profile?.city,
        phone: knownPhone ? formatPhone(knownPhone) : undefined,
      }}
      emailLocked
      emailHidden={!email}
      confirmedAdult={!!profile}
      submitLabel={profile ? t('aboutYou.save') : undefined}
      submitting={saving}
      error={error}
      onSubmit={save}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
});
