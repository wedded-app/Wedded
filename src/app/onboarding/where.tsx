import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';
import { matchCities, useAreaCodes, useCities, type City } from '@/data/places';
import { locateNearestCity } from '@/features/location/current-location';
import { useSearchLocation } from '@/features/location/search-location';
import { OnboardingStep } from '@/features/onboarding/onboarding-step';
import { nextHref } from '@/features/onboarding/steps';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

/**
 * Question 4: where the wedding is, so vendors near it come first. One big
 * underlined line to type the town into, with the towns it matches as they
 * type; or "Use where I am", which asks the phone once and keeps only the
 * nearest town (current-location); or one of the areas by area code. The
 * answer is the search location, kept on this phone like any other, so it
 * needs no account. Then the guests.
 */
export default function WhereStep() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { place, setPlace } = useSearchLocation();
  const cities = useCities();
  const areas = useAreaCodes();
  // A town they picked before shows in the line; an area shows ticked below
  const [typed, setTyped] = useState(() =>
    place && !place.label.includes(' · ') ? place.label : '',
  );
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const picked = !!place && typed === place.label;
  const searching = typed.trim().length >= 2 && !picked;
  const matches = searching ? matchCities(cities.data ?? [], typed, 5) : [];
  const next = () => router.push(nextHref('where'));

  const pickCity = (city: City) => {
    setTyped(city.name);
    setPlace({ label: city.name, latitude: city.latitude, longitude: city.longitude });
    setNote(null);
    Keyboard.dismiss();
  };

  const locate = async () => {
    setLocating(true);
    setNote(null);
    const result = await locateNearestCity(cities.data ?? []);
    setLocating(false);
    if (result.kind === 'found') pickCity(result.city);
    else setNote(t(`location.gps.${result.kind}`));
  };

  return (
    <OnboardingStep
      step="where"
      title={t('onboarding.where.title')}
      subtitle={t('onboarding.where.subtitle')}
      canContinue={!!place}
      onContinue={next}
      onSkip={next}
    >
      <View style={styles.page}>
        <View style={[styles.line, picked && styles.lineDone]}>
          <TextInput
            value={typed}
            onChangeText={(text) => {
              setTyped(text);
              setNote(null);
            }}
            placeholder={t('onboarding.where.placeholder')}
            placeholderTextColor={Colors.textDisabled}
            accessibilityLabel={t('onboarding.where.label')}
            autoCapitalize="words"
            autoCorrect={false}
            autoComplete="postal-address-locality"
            textContentType="addressCity"
            returnKeyType="done"
            onSubmitEditing={() => matches[0] && pickCity(matches[0])}
            maxFontSizeMultiplier={1.4}
            selectionColor={Colors.primary}
            style={[styles.input, { color: Colors.text }]}
          />
          {picked ? (
            <Animated.View entering={Motion.popIn}>
              <Icon name="checkmark-circle" size={26} color={Colors.primary} />
            </Animated.View>
          ) : (
            typed.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('onboarding.where.clear')}
                hitSlop={12}
                onPress={() => {
                  selectionHaptic();
                  setTyped('');
                }}
                style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
              >
                <Icon name="close" size={13} color={Colors.text2} weight="bold" />
              </Pressable>
            )
          )}
        </View>

        {searching ? (
          <View>
            {matches.map((city, index) => (
              <Choice
                key={city.slug}
                index={index}
                label={city.name}
                selected={false}
                onPress={() => pickCity(city)}
              />
            ))}
            {matches.length === 0 && cities.isSuccess && (
              <AppText color="text2" style={styles.note}>
                {t('location.noMatch')}
              </AppText>
            )}
          </View>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: locating }}
              disabled={locating}
              onPress={() => {
                selectionHaptic();
                void locate();
              }}
              style={({ pressed }) => [styles.here, pressed && styles.pressed]}
            >
              {locating ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <Icon name="location" size={20} color={Colors.primary} />
              )}
              <AppText variant="bodyLg" weight={600} color="primary">
                {t('onboarding.where.here')}
              </AppText>
            </Pressable>
            {note && (
              <AppText color="text2" style={styles.note}>
                {note}
              </AppText>
            )}

            {areas.data && areas.data.length > 0 && (
              <View>
                <AppText variant="caption" weight={600} color="text2" style={styles.caps}>
                  {t('onboarding.where.areas')}
                </AppText>
                {areas.data.map((area, index) => {
                  const label = `${area.code} · ${localized(area.label)}`;
                  return (
                    <Choice
                      key={area.code}
                      index={index}
                      label={localized(area.label)}
                      detail={t('onboarding.where.areaCode', { code: area.code })}
                      selected={place?.label === label}
                      onPress={() => {
                        setTyped('');
                        setNote(null);
                        setPlace(
                          { label, latitude: area.latitude, longitude: area.longitude },
                          area.radiusMiles,
                        );
                      }}
                    />
                  );
                })}
              </View>
            )}
          </>
        )}
      </View>
    </OnboardingStep>
  );
}

/** One place to pick: its name (and area code), a hairline above, a maroon tick once picked. */
function Choice({
  label,
  detail,
  selected,
  onPress,
  index,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  index: number;
}) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.choice,
        index > 0 && styles.divided,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.grow}>
        <AppText variant="bodyLg" weight={600}>
          {label}
        </AppText>
        {detail && (
          <AppText variant="label" weight={400} color="text2">
            {detail}
          </AppText>
        )}
      </View>
      {selected && (
        <Animated.View entering={Motion.popIn}>
          <Icon name="checkmark" size={20} color={Colors.primary} weight="bold" />
        </Animated.View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((Colors) => ({
  page: {
    gap: Spacing.lg,
  },
  line: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: Colors.text,
  },
  lineDone: {
    borderBottomColor: Colors.primary,
  },
  input: {
    flex: 1,
    // The web gives a text field a width of its own; let it shrink for the tick
    minWidth: 0,
    paddingVertical: Spacing.sm,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  clear: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.separator,
  },
  here: {
    minHeight: Sizes.tapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  note: {
    paddingHorizontal: Spacing.xs,
  },
  caps: {
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  choice: {
    minHeight: Sizes.row + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  divided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
  },
  grow: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.55,
  },
}));
