import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import type { IconName } from '@/components/icon';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { Spacing } from '@/constants/theme';
import { startBusinessErrorKind, useStartMyBusiness } from '@/data/business';
import { matchCities, useCities } from '@/data/places';
import { useCategories } from '@/data/reference';
import { OptionCard } from '@/features/onboarding/option-card';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/** What someone new came for (profiles.joined_as, R5 #222). */
export type JoinedAs = 'planning' | 'looking' | 'business';

const CHOICES: { value: JoinedAs; icon: IconName }[] = [
  { value: 'planning', icon: 'heart-outline' },
  { value: 'looking', icon: 'play-circle-outline' },
  { value: 'business', icon: 'storefront-outline' },
];

/** Before About you, for a new account: planning, just looking, or a wedding business. */
export function JoinChoiceStep({ onChoose }: { onChoose: (choice: JoinedAs) => void }) {
  const { t } = useLocale();
  const [picked, setPicked] = useState<JoinedAs | null>(null);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppText variant="title" accessibilityRole="header">
        {t('signIn.join.title')}
      </AppText>
      <View style={styles.list} accessibilityRole="radiogroup">
        {CHOICES.map((choice, index) => (
          <OptionCard
            key={choice.value}
            index={index}
            icon={choice.icon}
            label={t(`signIn.join.${choice.value}`)}
            detail={t(`signIn.join.${choice.value}Detail`)}
            selected={picked === choice.value}
            onPress={() => setPicked(choice.value)}
          />
        ))}
      </View>
      <Button
        label={t('signIn.join.continue')}
        disabled={!picked}
        onPress={() => picked && onChoose(picked)}
      />
    </ScrollView>
  );
}

/**
 * After About you, for "Wedding business": the name, the main vendor type and the
 * town, which make a draft listing they own (start_my_business). A founder publishes it.
 */
export function BusinessStep({ initialTown, onDone }: { initialTown: string; onDone: () => void }) {
  const { t } = useLocale();
  const categories = useCategories();
  const cities = useCities();
  const start = useStartMyBusiness();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [town, setTown] = useState(initialTown);
  const [attempted, setAttempted] = useState(false);
  const [failed, setFailed] = useState<string>();

  if (!categories.data || !cities.data) {
    const error = categories.isError || cities.isError;
    return (
      <StateView
        state={error ? 'error' : 'loading'}
        onRetry={() => {
          void categories.refetch();
          void cities.refetch();
        }}
      />
    );
  }

  // The town as one of our cities, so families nearby find the listing
  const place = matchCities(cities.data, town, 1)[0] ?? null;

  function submit() {
    setAttempted(true);
    setFailed(undefined);
    if (!name.trim() || !category || !place) return;
    start.mutate(
      { name, categorySlug: category, citySlug: place.slug },
      {
        onSuccess: onDone,
        onError: (error) =>
          setFailed(t(`signIn.business.errors.${startBusinessErrorKind(error.message)}`)),
      },
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <AppText variant="title" accessibilityRole="header">
        {t('signIn.business.title')}
      </AppText>
      <AppText variant="bodyLg" color="text2">
        {t('signIn.business.intro')}
      </AppText>
      <TextField
        label={t('signIn.business.name')}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        maxLength={80}
        error={attempted && !name.trim() ? t('signIn.business.nameError') : undefined}
      />
      <TextField
        type="city"
        label={t('signIn.business.town')}
        value={town}
        onChangeText={setTown}
        hint={place ? t('signIn.business.townMatch', { city: place.name }) : undefined}
        error={attempted && !place ? t('signIn.business.townError') : undefined}
      />
      <View style={styles.group}>
        <AppText weight={600}>{t('signIn.business.type')}</AppText>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {categories.data.map((c) => (
            <Chip
              key={c.slug}
              role="radio"
              label={localized(c.name)}
              selected={category === c.slug}
              onPress={() => setCategory(c.slug)}
            />
          ))}
        </View>
        {attempted && !category ? (
          <AppText color="error">{t('signIn.business.typeError')}</AppText>
        ) : null}
      </View>
      {failed ? <AppText color="error">{failed}</AppText> : null}
      <Button label={t('signIn.business.submit')} loading={start.isPending} onPress={submit} />
    </ScrollView>
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
  group: {
    gap: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
});
