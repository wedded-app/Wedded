import { useRef, useState, type RefObject } from 'react';
import {
  AccessibilityInfo,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type TextInput,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Checkbox } from '@/components/checkbox';
import { FieldError } from '@/components/field-error';
import { TextField } from '@/components/text-field';
import { Spacing } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';

import {
  validateAboutYou,
  type AboutYouDraft,
  type AboutYouField,
  type AboutYouValues,
} from './about-you-validation';

export type { AboutYouValues } from './about-you-validation';

type TextFieldName = Exclude<AboutYouField, 'isAdult'>;

export type AboutYouFormProps = {
  /** Called with cleaned-up values once every field is valid. */
  onSubmit: (values: AboutYouValues) => void;
  /** Prefill what we already know, e.g. the email they just verified or the
   * city from their location. Read once when the form first shows. */
  initialValues?: Partial<Record<TextFieldName, string>>;
  /** True while the account is being created: the button shows a spinner and ignores taps. */
  submitting?: boolean;
  /** A problem from the server, shown above the button. Say what to do next,
   * e.g. "We couldn't create your account. Check your internet and try again." */
  error?: string;
  /** Show the email read-only: it's the one they signed in with. */
  emailLocked?: boolean;
  /** Leave the email out: the account has none (phone sign-in). It's optional
   * anyway, since it isn't saved to the profile. */
  emailHidden?: boolean;
  /** They already confirmed 18+ (editing an existing profile): hide the box. */
  confirmedAdult?: boolean;
  /** Button text; defaults to "Create account". */
  submitLabel?: string;
  /** A vendor account: the same details, asked in a business's words. */
  forBusiness?: boolean;
  style?: StyleProp<ViewStyle>;
};

const FIELD_ORDER: AboutYouField[] = ['name', 'city', 'phone', 'email', 'isAdult'];

/**
 * "About you" (vision doc S14): name, city, phone, email (when the account
 * has one) and the 18+ box, then
 * "Create account". It scrolls and keeps the focused field above the keyboard,
 * so it can fill a screen or a sheet; give it horizontal padding from the parent.
 * No placeholders, on purpose: grey example text reads as already filled in.
 * Errors show only after the first tap on "Create account", then clear as each
 * field is fixed.
 */
export function AboutYouForm({
  onSubmit,
  initialValues,
  submitting = false,
  error,
  emailLocked = false,
  emailHidden = false,
  confirmedAdult = false,
  submitLabel,
  forBusiness = false,
  style,
}: AboutYouFormProps) {
  const { t } = useLocale();
  const [draft, setDraft] = useState<AboutYouDraft>({
    name: initialValues?.name ?? '',
    city: initialValues?.city ?? '',
    phone: initialValues?.phone ?? '',
    email: initialValues?.email ?? '',
    isAdult: confirmedAdult,
  });
  const [attempted, setAttempted] = useState(false);

  const nameRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const inputRefs: Record<TextFieldName, RefObject<TextInput | null>> = {
    name: nameRef,
    city: cityRef,
    phone: phoneRef,
    email: emailRef,
  };

  const { errors, values } = validateAboutYou(draft);
  // The phone is the last box when the email is read-only or left out.
  const phoneIsLast = emailLocked || emailHidden;
  const errorFor = (field: AboutYouField) => {
    const key = attempted ? errors[field] : undefined;
    return key && t(`aboutYou.errors.${key}`);
  };
  const setField = (field: TextFieldName) => (text: string) =>
    setDraft((current) => ({ ...current, [field]: text }));

  function handleSubmit() {
    if (values) {
      onSubmit(values);
      return;
    }
    setAttempted(true);
    AccessibilityInfo.announceForAccessibility(t('aboutYou.fixErrors'));
    const firstInvalid = FIELD_ORDER.find((field) => errors[field]);
    if (firstInvalid && firstInvalid !== 'isAdult') {
      inputRefs[firstInvalid].current?.focus();
    }
  }

  return (
    <ScrollView
      style={style}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <AppText variant="title" accessibilityRole="header">
        {t(forBusiness ? 'aboutYou.business.title' : 'aboutYou.title')}
      </AppText>
      {forBusiness && <AppText color="text2">{t('aboutYou.business.intro')}</AppText>}

      <TextField
        ref={nameRef}
        type="name"
        label={t('aboutYou.name')}
        value={draft.name}
        onChangeText={setField('name')}
        error={errorFor('name')}
        maxLength={80}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => cityRef.current?.focus()}
      />
      <TextField
        ref={cityRef}
        type="city"
        label={t('aboutYou.city')}
        value={draft.city}
        onChangeText={setField('city')}
        error={errorFor('city')}
        maxLength={60}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => phoneRef.current?.focus()}
      />
      <TextField
        ref={phoneRef}
        type="phone"
        label={t('aboutYou.phone')}
        hint={t(forBusiness ? 'aboutYou.business.phoneHint' : 'aboutYou.phoneHint')}
        value={draft.phone}
        onChangeText={setField('phone')}
        error={errorFor('phone')}
        maxLength={20}
        returnKeyType={phoneIsLast ? 'done' : 'next'}
        submitBehavior={phoneIsLast ? 'blurAndSubmit' : 'submit'}
        onSubmitEditing={() => !phoneIsLast && emailRef.current?.focus()}
      />
      {!emailHidden && (
        <TextField
          ref={emailRef}
          type="email"
          label={t('aboutYou.email')}
          hint={emailLocked ? t('aboutYou.emailLockedHint') : undefined}
          value={draft.email}
          onChangeText={setField('email')}
          editable={!emailLocked}
          error={errorFor('email')}
          maxLength={254}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
        />
      )}
      {!confirmedAdult && (
        <Checkbox
          label={t('aboutYou.isAdult')}
          checked={draft.isAdult}
          onChange={(isAdult) => setDraft((current) => ({ ...current, isAdult }))}
          error={errorFor('isAdult')}
        />
      )}

      {attempted && !values && <FieldError message={t('aboutYou.fixErrors')} />}
      {error && <FieldError message={error} />}
      <Button
        label={submitLabel ?? t('aboutYou.submit')}
        loading={submitting}
        onPress={handleSubmit}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.xl,
    paddingVertical: Spacing.xl,
  },
});
