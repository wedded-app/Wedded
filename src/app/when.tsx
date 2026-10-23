import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, {
  FadeInLeft,
  FadeInRight,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientGlow } from '@/components/ambient-glow';
import { AppText } from '@/components/app-text';
import { DateField } from '@/components/date-field';
import { Icon } from '@/components/icon';
import { OmbreBackground } from '@/components/ombre-background';
import { PressableScale } from '@/components/pressable-scale';
import { TextField } from '@/components/text-field';
import { makeStyles, SchemeContext, Sizes, Spacing, Springs, useColors } from '@/constants/theme';
import { matchCities, useAreaCodes, useCities } from '@/data/places';
import { stampDate } from '@/features/home/date-card';
import { setWeddingDraft, useWeddingDraft } from '@/features/home/wedding-draft';
import { GUEST_BANDS } from '@/features/inquiry/inquiry-helpers';
import { useSearchLocation } from '@/features/location/search-location';
import { PillButton } from '@/features/onboarding/onboarding-step';
import { OptionCard } from '@/features/onboarding/option-card';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';

type Step = 'date' | 'place' | 'guests';
const STEPS: Step[] = ['date', 'place', 'guests'];
// Where each question's words are in the strings (when.guests is the strip's)
const WORDS: Record<Step, string> = { date: 'date', place: 'place', guests: 'guestsStep' };

/**
 * The quick questions behind Home's wedding card, no account needed: when
 * the wedding is, where, and about how many guests. One question at a
 * time, sliding forward and back, over the same soft glow as phone sign-in,
 * with what they've said so far on a little ombre strip above Continue.
 * Each answer is kept on the phone as soon as it's picked (wedding-draft,
 * and the search location), so closing early loses nothing. Always light.
 */
export default function WhenScreen() {
  return (
    <SchemeContext.Provider value="light">
      <StatusBar style="dark" />
      <WhenSteps />
    </SchemeContext.Provider>
  );
}

function WhenSteps() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const draft = useWeddingDraft();
  const { place, setPlace } = useSearchLocation();
  const areas = useAreaCodes();
  const cities = useCities();
  const [at, setAt] = useState(0);
  const [moved, setMoved] = useState<'forward' | 'back' | null>(null);
  const [typed, setTyped] = useState('');
  const step = STEPS[at];
  const last = at === STEPS.length - 1;
  const matches = typed.trim().length >= 2 ? matchCities(cities.data ?? [], typed, 4) : [];

  const answered =
    step === 'date'
      ? draft.date !== null || draft.noDateYet
      : step === 'place'
        ? place !== null
        : draft.guestBand !== null;

  const next = () => {
    if (last) {
      successHaptic();
      router.back();
      return;
    }
    setMoved('forward');
    setAt(at + 1);
  };
  const back = () => {
    selectionHaptic();
    if (at === 0) {
      router.back();
      return;
    }
    setMoved('back');
    setAt(at - 1);
  };

  const entering = moved === 'forward' ? FadeInRight : moved === 'back' ? FadeInLeft : undefined;

  return (
    <View style={[styles.root, { backgroundColor: Colors.canvas }]}>
      <AmbientGlow />
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            styles.page,
            { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.sm },
          ]}
        >
          <View style={styles.bar}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={at === 0 ? t('when.close') : t('common.back')}
              hitSlop={8}
              pressedScale={0.9}
              onPress={back}
              style={styles.round}
            >
              <Icon
                name={at === 0 ? 'close' : 'chevron-back'}
                size={22}
                color={Colors.text}
                weight="semibold"
              />
            </PressableScale>
            <View
              style={styles.progress}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={t('when.stepOf', { step: at + 1, total: STEPS.length })}
            >
              {STEPS.map((s, index) => (
                <Segment key={s} on={index <= at} />
              ))}
            </View>
            <View style={styles.side}>
              {!last && (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={12}
                  onPress={() => {
                    selectionHaptic();
                    next();
                  }}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <AppText weight={600} color="text2">
                    {t('when.skip')}
                  </AppText>
                </Pressable>
              )}
            </View>
          </View>

          <Animated.View key={step} entering={entering} style={styles.fill}>
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.intro}>
                <AppText variant="label" weight={600} color="primary">
                  {t('when.stepOf', { step: at + 1, total: STEPS.length })}
                </AppText>
                <AppText
                  variant="display"
                  weight={600}

                  accessibilityRole="header"
                  style={styles.title}
                >
                  {t(`when.${WORDS[step]}.title`)}
                </AppText>
                <AppText variant="bodyLg" color="text2">
                  {t(`when.${WORDS[step]}.subtitle`)}
                </AppText>
              </View>

              {step === 'date' && (
                <View style={styles.list}>
                  <DateField
                    value={draft.date}
                    onChange={(date) => setWeddingDraft({ date, noDateYet: false })}
                    placeholder={t('when.date.pick')}
                  />
                  <OptionCard
                    index={1}
                    role="checkbox"
                    icon="time-outline"
                    label={t('when.date.notYet')}
                    detail={t('when.date.notYetDetail')}
                    selected={draft.noDateYet}
                    onPress={() => setWeddingDraft({ noDateYet: !draft.noDateYet, date: null })}
                  />
                </View>
              )}

              {step === 'place' && (
                <View style={styles.list}>
                  <TextField
                    label={t('when.place.typeLabel')}
                    type="city"
                    value={typed}
                    onChangeText={setTyped}
                    placeholder={t('when.place.typePlaceholder')}
                  />
                  {matches.map((city, index) => (
                    <OptionCard
                      key={city.slug}
                      index={index}
                      role="radio"
                      icon="location-outline"
                      label={city.name}
                      selected={place?.label === city.name}
                      onPress={() => {
                        setTyped(city.name);
                        setPlace({
                          label: city.name,
                          latitude: city.latitude,
                          longitude: city.longitude,
                        });
                      }}
                    />
                  ))}
                  {matches.length === 0 &&
                    (areas.data ?? []).map((area, index) => {
                      const label = `${area.code} · ${localized(area.label)}`;
                      return (
                        <OptionCard
                          key={area.code}
                          index={index}
                          role="radio"
                          label={localized(area.label)}
                          detail={t('when.place.areaCode', { code: area.code })}
                          selected={place?.label === label}
                          onPress={() =>
                            setPlace(
                              { label, latitude: area.latitude, longitude: area.longitude },
                              area.radiusMiles,
                            )
                          }
                        />
                      );
                    })}
                </View>
              )}

              {step === 'guests' && (
                <View style={styles.list}>
                  {GUEST_BANDS.map((band, index) => (
                    <OptionCard
                      key={band}
                      index={index}
                      role="radio"
                      label={t(`inquiry.guestBands.${band}`)}
                      selected={draft.guestBand === band}
                      onPress={() => setWeddingDraft({ guestBand: band })}
                    />
                  ))}
                </View>
              )}
            </ScrollView>
          </Animated.View>

          <View style={styles.footer}>
            <SoFar />
            <PillButton
              label={last ? t('when.finish') : t('when.continue')}
              disabled={!answered}
              onPress={next}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** What they've said so far, on a slim strip of the card's ombre. */
function SoFar() {
  const styles = useStyles();
  const { t } = useLocale();
  const draft = useWeddingDraft();
  const { place } = useSearchLocation();
  const parts = [
    place?.label.split(' · ').pop(),
    draft.guestBand ? t('when.guests', { band: t(`inquiry.guestBands.${draft.guestBand}`) }) : null,
  ].filter(Boolean);

  return (
    <View style={styles.strip} accessible accessibilityLabel={parts.join(', ')}>
      <OmbreBackground />
      <AppText color="onHero" style={styles.stamp} maxFontSizeMultiplier={1.3}>
        {stampDate(draft.date)}
      </AppText>
      <AppText color="onHero2" weight={600} numberOfLines={1} style={styles.grow}>
        {parts.length > 0 ? parts.join(' · ') : t('when.yourWedding')}
      </AppText>
    </View>
  );
}

/** One part of the progress bar, filling in maroon once that question is reached. */
function Segment({ on }: { on: boolean }) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(on ? 1 : 0);

  useEffect(() => {
    const target = on ? 1 : 0;
    fill.value = reduceMotion ? target : withSpring(target, Springs.smooth);
  }, [fill, on, reduceMotion]);

  const inner = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.segmentFill, inner]} />
    </View>
  );
}

const MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, Menlo, Consolas, monospace',
});

const useStyles = makeStyles((Colors) => ({
  root: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  page: {
    flex: 1,
    paddingHorizontal: Sizes.pageGutter,
  },
  bar: {
    minHeight: Sizes.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.canvasField,
  },
  progress: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: Colors.canvasField,
  },
  segmentFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.primaryFill,
  },
  side: {
    minWidth: 44,
    alignItems: 'flex-end',
  },
  pressed: {
    opacity: 0.5,
  },
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
    letterSpacing: -0.3,
  },
  list: {
    gap: Spacing.md,
  },
  footer: {
    gap: Spacing.sm + 2,
    paddingTop: Spacing.md,
  },
  strip: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 18,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: Colors.ombreBase,
  },
  stamp: {
    fontFamily: MONO,
    fontSize: 17,
    letterSpacing: 1,
  },
  grow: {
    flex: 1,
    textAlign: 'right',
  },
}));
