import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, type TextInput } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { FieldError } from '@/components/field-error';
import { ListRow, ListSection } from '@/components/list';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { TextField } from '@/components/text-field';
import { Spacing, useColors } from '@/constants/theme';
import { findZip, matchCities, useAreaCodes, useCities, type City } from '@/data/places';
import { hasLocationPermission, locateNearestCity } from '@/features/location/current-location';
import { DISTANCE_CHOICES, useSearchLocation } from '@/features/location/search-location';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/**
 * "Where should we look?" (vision S22a), a modal: type a city or ZIP (with
 * suggestions from our NorCal list), or pick an area-code chip, then how far.
 * Saved on this phone. "Use my current location" explains itself before the
 * phone's permission prompt (S22b) and uses the nearest city, never the exact
 * position.
 */
export default function LocationScreen() {
  const Colors = useColors();
  const { t } = useLocale();
  const { place, maxMiles, setPlace, setMaxMiles, clearPlace } = useSearchLocation();
  const cities = useCities();
  const areaCodes = useAreaCodes();
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string>();
  const [checkingZip, setCheckingZip] = useState(false);
  const [explainGps, setExplainGps] = useState(false);
  const [locating, setLocating] = useState(false);
  const cityInput = useRef<TextInput>(null);

  const typed = text.trim();
  const zip = /^\d{5}$/.test(typed) ? typed : null;
  const suggestions = !zip && cities.data ? matchCities(cities.data, typed) : [];

  function close() {
    if (router.canGoBack()) router.back();
  }

  /** S22b: explain first, then the phone's own prompt; never at launch. */
  async function useCurrentLocation() {
    setMessage(undefined);
    if (await hasLocationPermission()) {
      await locate();
    } else {
      setExplainGps(true);
    }
  }

  async function locate() {
    setExplainGps(false);
    if (!cities.data) return;
    setLocating(true);
    const result = await locateNearestCity(cities.data);
    setLocating(false);
    if (result.kind === 'found') {
      chooseCity(result.city);
    } else {
      setMessage(t(`location.gps.${result.kind}`));
      if (result.kind === 'denied' || result.kind === 'unavailable') cityInput.current?.focus();
    }
  }

  function chooseCity(city: City) {
    setPlace({ label: city.name, latitude: city.latitude, longitude: city.longitude });
    setText('');
    setMessage(undefined);
  }

  async function chooseZip(code: string) {
    setCheckingZip(true);
    setMessage(undefined);
    try {
      const found = await findZip(code);
      if (found) {
        setPlace(found);
        setText('');
      } else {
        setMessage(t('location.zipOutside'));
      }
    } catch {
      setMessage(t('states.error'));
    } finally {
      setCheckingZip(false);
    }
  }

  function submitTyped() {
    if (zip) void chooseZip(zip);
    else if (suggestions[0]) chooseCity(suggestions[0]);
    else if (typed) setMessage(t('location.noMatch'));
  }

  const customMiles = maxMiles !== null && !DISTANCE_CHOICES.includes(maxMiles) ? maxMiles : null;

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader onClose={close} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.intro}>
          <AppText variant="title" accessibilityRole="header">
            {t('location.title')}
          </AppText>
          <AppText color="text2">{t('location.subtitle')}</AppText>
        </View>

        <ListSection inset>
          <ListRow
            icon="navigate-outline"
            title={t('location.gps.use')}
            tone="primary"
            onPress={locating ? undefined : useCurrentLocation}
            trailing={locating ? <ActivityIndicator color={Colors.chevron} /> : undefined}
          />
          {place ? (
            <ListRow
              icon="location"
              title={t('location.current', { place: place.label })}
              trailing={
                <Button
                  variant="text"
                  label={t('location.clear')}
                  onPress={clearPlace}
                  style={styles.clear}
                />
              }
            />
          ) : null}
        </ListSection>
        {explainGps && (
          <Card style={styles.explain}>
            <AppText variant="heading">{t('location.gps.explainTitle')}</AppText>
            <AppText>{t('location.gps.explainBody')}</AppText>
            <Button label={t('location.gps.allow')} onPress={locate} />
            <Button
              variant="text"
              label={t('location.gps.typeInstead')}
              onPress={() => {
                setExplainGps(false);
                cityInput.current?.focus();
              }}
            />
          </Card>
        )}

        <TextField
          ref={cityInput}
          label={t('location.cityOrZip')}
          hint={t('location.cityOrZipHint')}
          value={text}
          onChangeText={(value) => {
            setText(value);
            setMessage(undefined);
          }}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={submitTyped}
        />
        {message && <FieldError message={message} />}

        {zip && (
          <Button
            label={t('location.useZip', { zip })}
            icon="navigate-outline"
            loading={checkingZip}
            onPress={() => chooseZip(zip)}
          />
        )}
        {suggestions.length > 0 && (
          <ListSection inset>
            {suggestions.map((city) => (
              <ListRow
                key={city.slug}
                icon="location-outline"
                iconColor="text2"
                title={city.name}
                titleVariant="bodyLg"
                value={city.areaCode}
                chevron={false}
                onPress={() => chooseCity(city)}
              />
            ))}
          </ListSection>
        )}
        {typed.length > 1 && !zip && cities.data && suggestions.length === 0 && (
          <AppText color="text2">{t('location.noMatch')}</AppText>
        )}

        <AppText variant="heading" accessibilityRole="header" style={styles.groupTitle}>
          {t('location.areas')}
        </AppText>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {(areaCodes.data ?? []).map((area) => {
            const label = `${area.code} · ${localized(area.label)}`;
            return (
              <Chip
                key={area.code}
                role="radio"
                label={label}
                selected={place?.label === label}
                onPress={() => {
                  setPlace(
                    { label, latitude: area.latitude, longitude: area.longitude },
                    area.radiusMiles,
                  );
                  setMessage(undefined);
                }}
              />
            );
          })}
        </View>

        <AppText variant="heading" accessibilityRole="header" style={styles.groupTitle}>
          {t('location.distance')}
        </AppText>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {DISTANCE_CHOICES.map((miles) => (
            <Chip
              key={miles ?? 'anywhere'}
              role="radio"
              label={
                miles === null ? t('location.anywhere') : t('location.miles', { count: miles })
              }
              selected={maxMiles === miles}
              onPress={() => setMaxMiles(miles)}
            />
          ))}
          {customMiles !== null && (
            <Chip
              role="radio"
              label={t('location.miles', { count: customMiles })}
              selected
              onPress={() => setMaxMiles(customMiles)}
            />
          )}
        </View>

        <Button label={t('location.done')} onPress={close} style={styles.done} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  intro: {
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  explain: {
    gap: Spacing.md,
  },
  clear: {
    minHeight: 44,
    paddingHorizontal: Spacing.sm,
  },
  groupTitle: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  done: {
    marginTop: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
});
