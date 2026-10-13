import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useCities } from '@/data/places';
import { useBackgrounds, useFaiths, useTraditions } from '@/data/reference';
import { useSession } from '@/features/auth/session';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { resetAnswers, setAnswers } from '@/features/onboarding/answers';
import { answersForTraditions } from '@/features/onboarding/faith';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

import { planFromQuery, type NamedEvent, type PlanHint } from './plan-from-query';
import { traditionsForSearch } from './plan-traditions';

/**
 * What a search says about a wedding (planFromQuery), with the database's
 * backgrounds, faiths, every tradition's event names and the cities to read
 * it against. Null while those load, or when the search isn't about planning.
 */
export function usePlanFromQuery(query: string): PlanHint | null {
  const backgrounds = useBackgrounds();
  const faiths = useFaiths();
  const traditions = useTraditions();
  const cities = useCities();

  const events = useMemo(() => {
    const names = new Map<string, Set<string>>();
    for (const tradition of traditions.data ?? []) {
      for (const event of tradition.events) {
        const set = names.get(event.slug) ?? new Set<string>();
        set.add(event.name.en);
        if (event.name.pa) set.add(event.name.pa);
        names.set(event.slug, set);
      }
    }
    return [...names].map(([slug, set]): NamedEvent => ({ slug, names: [...set] }));
  }, [traditions.data]);

  return useMemo(
    () =>
      planFromQuery(query, {
        backgrounds: backgrounds.data ?? [],
        faiths: faiths.data ?? [],
        events,
        cities: cities.data ?? [],
      }),
    [query, backgrounds.data, faiths.data, events, cities.data],
  );
}

/**
 * The top of Search when someone types a wedding ("punjabi wedding in yuba
 * city for 300"): what we understood, and "Build my plan", which opens the
 * first questions with those answers filled in, so they only check and
 * continue (like Thumbtack turning a search into a plan).
 */
export function PlanCard({ hint }: { hint: PlanHint }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t, locale } = useLocale();
  const backgrounds = useBackgrounds();
  const faiths = useFaiths();
  const traditions = useTraditions();
  const cities = useCities();
  const { requireSignIn } = useSession();

  const eventName = (slug: string) => {
    for (const tradition of traditions.data ?? []) {
      const event = tradition.events.find((e) => e.slug === slug);
      if (event) return localized(event.name, locale);
    }
    return slug;
  };
  const understood = [
    ...hint.backgrounds.map((slug) => backgrounds.data?.find((b) => b.slug === slug)?.name),
    ...hint.faiths.map((slug) => faiths.data?.find((f) => f.slug === slug)?.name),
  ]
    .filter((name) => !!name)
    .map((name) => localized(name!, locale))
    .concat(hint.events.map(eventName));
  if (hint.guestBand) {
    understood.push(t('search.plan.guests', { band: t(`inquiry.guestBands.${hint.guestBand}`) }));
  }
  const city = cities.data?.find((c) => c.slug === hint.city?.slug);
  if (city) understood.push(city.name);
  if (hint.date) understood.push(formatDate(hint.date));

  // A plan belongs to an account: signed out, they sign in first, then the
  // questions open with what they typed filled in
  function build() {
    selectionHaptic();
    const kinds = traditionsForSearch(hint.backgrounds, hint.faiths, traditions.data ?? []);
    requireSignIn(() => {
      resetAnswers();
      setAnswers({
        ...answersForTraditions(kinds),
        extraEvents: hint.events,
        guestBand: hint.guestBand,
        citySlug: hint.city?.slug ?? null,
        weddingDate: hint.date,
      });
      router.push('/onboarding/who');
    });
  }

  return (
    <Animated.View entering={Motion.rise} style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.mark}>
          <Icon name="sparkles" size={22} color={Colors.onPrimary} />
        </View>
        <View style={styles.grow}>
          <AppText variant="heading" weight={700} accessibilityRole="header">
            {t('search.plan.title')}
          </AppText>
          <AppText variant="label" weight={400} color="text2">
            {t('search.plan.body')}
          </AppText>
        </View>
      </View>
      {understood.length > 0 && (
        <View style={styles.pills} accessibilityLabel={understood.join(', ')}>
          {understood.map((item) => (
            <View key={item} style={styles.pill}>
              <Icon name="checkmark" size={14} color={Colors.primary} weight="bold" />
              <AppText variant="label" weight={600}>
                {item}
              </AppText>
            </View>
          ))}
        </View>
      )}
      <Button icon="arrow-forward" label={t('search.plan.build')} onPress={build} />
    </Animated.View>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primaryTint,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  mark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryFill,
  },
  grow: {
    flex: 1,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 32,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.chip,
    backgroundColor: Colors.primaryTint,
  },
}));
