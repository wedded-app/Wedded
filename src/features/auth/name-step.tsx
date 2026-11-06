import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { AppText, useTypeStyle } from '@/components/app-text';
import { FieldError } from '@/components/field-error';
import { makeStyles, Spacing, useColors } from '@/constants/theme';
import { ArrowButton } from '@/features/onboarding/onboarding-step';
import { useLocale } from '@/i18n/locale-context';

/**
 * The one thing sign-up asks about the person, after "What brings you to
 * Wedded?" (DECISIONS.md, 2026-11-05), like Hinge's: "What's your name?" big
 * and bold, one large field on a line, and the round black arrow under it,
 * where the keyboard never covers it. Apple and Google fill the name in, so
 * most people only tap the arrow; the keyboard opens by itself only when the
 * field is empty. The city and phone are asked the first time they message a
 * vendor, and 18+ was confirmed by the line under Create account.
 */
export function NameStep({
  initialName,
  forBusiness,
  saving,
  error,
  onSubmit,
}: {
  initialName?: string;
  forBusiness: boolean;
  saving: boolean;
  error?: string;
  onSubmit: (name: string) => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const type = useTypeStyle({ variant: 'title', weight: 600 });
  const [name, setName] = useState(initialName ?? '');
  const [focused, setFocused] = useState(false);
  // Trimmed, inner spaces collapsed, as the profile keeps it (1 to 80 characters)
  const clean = name.trim().replace(/\s+/g, ' ');

  const submit = () => {
    if (clean && !saving) onSubmit(clean);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View style={styles.intro}>
        <AppText variant="display" weight={700} accessibilityRole="header" style={styles.title}>
          {t('aboutYou.nameTitle')}
        </AppText>
        <AppText variant="bodyLg" color="text2">
          {t(forBusiness ? 'aboutYou.nameHintBusiness' : 'aboutYou.nameHint')}
        </AppText>
      </View>

      <TextInput
        value={name}
        onChangeText={setName}
        accessibilityLabel={t('aboutYou.name')}
        autoFocus={!initialName}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        autoCorrect={false}
        maxLength={80}
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={submit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectionColor={Colors.text}
        maxFontSizeMultiplier={type.maxFontSizeMultiplier}
        style={[
          type,
          styles.input,
          { borderBottomColor: focused ? Colors.text : Colors.borderInput },
        ]}
      />
      {error && <FieldError message={error} />}

      <View style={styles.actions}>
        <ArrowButton
          label={t('onboarding.continue')}
          disabled={!clean}
          loading={saving}
          onPress={submit}
        />
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((Colors) => ({
  content: {
    gap: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  intro: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  title: {
    letterSpacing: -0.5,
  },
  input: {
    color: Colors.text,
    minHeight: 56,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: 2,
  },
  actions: {
    alignItems: 'flex-end',
  },
}));
