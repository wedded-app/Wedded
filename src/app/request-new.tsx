import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { TextField } from '@/components/text-field';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { matchCities, useCities } from '@/data/places';
import { useCategories } from '@/data/reference';
import { requestProblem, usePostRequest } from '@/data/requests';
import { useSession } from '@/features/auth/session';
import { StartPlanCard } from '@/features/planner/start-plan-card';
import { usePlanView } from '@/features/planner/use-plan-view';
import { LookingPost } from '@/features/requests/request-parts';
import { budgetBands, shortName } from '@/features/requests/requests-format';
import { useRequestWords } from '@/features/requests/use-request-words';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/**
 * Post a request (#219): a family tells vendors what they need, and vendors
 * on Wedded Pro send prices. The plan fills in the date, guests and town, so
 * the family picks the event and the vendor type, maybe a budget and a note.
 * A live preview shows exactly what vendors will see: the short name and the
 * town, never a phone number or email. /request-new?event=&category=
 */
export default function PostRequestSheet() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const params = useLocalSearchParams<{ event?: string; category?: string }>();
  const { profile } = useSession();
  const view = usePlanView();
  const words = useRequestWords();
  const post = usePostRequest(view.wedding?.id ?? '');
  const cities = useCities();

  const [event, setEvent] = useState<string | null>(params.event ?? view.chosen[0]?.slug ?? null);
  const [category, setCategory] = useState<string | null>(params.category ?? null);
  const [budget, setBudget] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [town, setTown] = useState(profile?.city ?? '');

  // What the chosen event needs: essentials first
  const categories = useCategories();
  const eventNeeds = (event ? (view.needsByEvent[event] ?? []) : []).flatMap((s) => s.needs);
  // No plan yet: every vendor type, A to Z
  const needs =
    eventNeeds.length > 0
      ? eventNeeds
      : (categories.data ?? []).map((c) => ({ categorySlug: c.slug, name: c.name }));
  const group = category ? words.group(category) : null;
  const bands = budgetBands(group);
  const band = bands.find((b) => b.key === budget) ?? null;
  const date = (event && view.plan.eventDates?.[event]) || view.plan.weddingDate || null;
  const guestBand = (event && view.plan.guests?.[event]) || null;
  // The town as one of our cities, so vendors' distances work
  const place = matchCities(cities.data ?? [], town, 1)[0] ?? null;
  const city = place?.name ?? '';
  const name = shortName(profile?.full_name) || t('requests.post.you');

  const draft = {
    categorySlug: category ?? '',
    eventSlug: event,
    eventDate: date,
    guestBand,
    budgetMinCents: band?.min != null ? band.min * 100 : null,
    budgetMaxCents: band?.max != null ? band.max * 100 : null,
  };

  const submit = () => {
    setAttempted(true);
    if (!category || !place) return;
    post.mutate(
      { ...draft, categorySlug: category, note: note.trim(), citySlug: place.slug },
      {
        onSuccess: (id) =>
          router.replace({ pathname: '/request/[id]', params: { id: String(id), posted: '1' } }),
      },
    );
  };

  if (!view.wedding && !view.loading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <SheetHeader onClose={() => router.canGoBack() && router.back()} />
        <View style={styles.content}>
          <AppText variant="title" accessibilityRole="header">
            {t('requests.post.title')}
          </AppText>
          <AppText color="text2">{t('requests.post.needsPlan')}</AppText>
          <StartPlanCard />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader onClose={() => router.canGoBack() && router.back()} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.intro}>
          <AppText variant="title" accessibilityRole="header">
            {t('requests.post.title')}
          </AppText>
          <AppText color="text2">{t('requests.post.body')}</AppText>
        </View>

        <View style={styles.preview} accessibilityLabel={t('requests.post.previewLabel')}>
          <AppText variant="caption" weight={600} color="text2">
            {t('requests.post.preview')}
          </AppText>
          <LookingPost
            familyName={name}
            city={city}
            ago={t('requests.ago.now')}
            headline={category ? words.headline(draft) : t('requests.post.pickType')}
            facts={words.facts(draft)}
            note={note.trim() || null}
          />
        </View>

        {view.chosen.length > 0 && (
          <View style={styles.field}>
            <AppText variant="heading">{t('requests.post.event')}</AppText>
            <View style={styles.chips}>
              {view.chosen.map((e) => (
                <Chip
                  key={e.slug}
                  role="radio"
                  label={localized(e.name)}
                  selected={event === e.slug}
                  onPress={() => {
                    setEvent(e.slug);
                    setCategory(null);
                    setBudget(null);
                  }}
                />
              ))}
            </View>
          </View>
        )}

        <View style={styles.field}>
          <AppText variant="heading">{t('requests.post.type')}</AppText>
          <View style={styles.chips}>
            {needs.map((need) => (
              <Chip
                key={need.categorySlug}
                role="radio"
                label={localized(need.name)}
                selected={category === need.categorySlug}
                onPress={() => {
                  setCategory(need.categorySlug);
                  setBudget(null);
                }}
              />
            ))}
          </View>
          {attempted && !category && <FieldError message={t('requests.post.typeError')} />}
        </View>

        {category && (
          <View style={styles.field}>
            <AppText variant="heading">{t('requests.post.budget')}</AppText>
            <View style={styles.chips}>
              {bands.map((b) => (
                <Chip
                  key={b.key}
                  role="radio"
                  label={t(`requests.budget.bands.${b.key}`)}
                  selected={budget === b.key}
                  onPress={() => setBudget(budget === b.key ? null : b.key)}
                />
              ))}
            </View>
          </View>
        )}

        <TextField
          label={t('requests.post.town')}
          value={town}
          onChangeText={setTown}
          hint={place ? t('requests.post.townMatch', { city: place.name }) : undefined}
          error={attempted && !place ? t('requests.post.townError') : undefined}
          autoComplete="off"
        />

        <TextField
          label={t('requests.post.note')}
          hint={t('requests.post.noteHint')}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={600}
        />

        <View style={styles.privacy}>
          <Icon name="lock-closed" size={18} color={Colors.text2} />
          <AppText variant="label" weight={400} color="text2" style={styles.grow}>
            {t('requests.post.privacy', { name, city: city || t('requests.post.yourTown') })}
          </AppText>
        </View>

        {post.isError && (
          <FieldError message={t(`requests.problems.${requestProblem(post.error)}`)} />
        )}
        <Button label={t('requests.post.send')} loading={post.isPending} onPress={submit} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  content: {
    gap: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  intro: {
    gap: Spacing.xs,
  },
  preview: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  field: {
    gap: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  privacy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  grow: {
    flex: 1,
  },
}));
