import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Alert, Platform, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { OmbreBackground } from '@/components/ombre-background';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { useSearchLocation } from '@/features/location/search-location';
import { useSaveDraftPlan } from '@/features/onboarding/save-draft';
import { useStartPlanning } from '@/features/onboarding/start';
import { STEPS } from '@/features/onboarding/steps';
import { daysUntil } from '@/features/planner/plan';
import { WedMark } from '@/features/wed/wed-mark';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { iosEasing, Motion } from '@/lib/motion';
import { useCountUp } from '@/lib/use-count-up';

import { hasDraftPlan, useWeddingDraft } from './wedding-draft';

// The date in the corner, like a stamp: 06.13.27
const MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, Menlo, Consolas, monospace',
});

/** "2027-06-13" as "06.13.27"; dashes before there's a date. */
export function stampDate(date: string | null): string {
  if (!date) return '--.--.--';
  const [year, month, day] = date.split('-');
  return `${month}.${day}.${year.slice(2)}`;
}

/**
 * The first thing on Home: the wedding, on a card of slowly moving
 * wine-and-rose ombre (OmbreBackground).
 *
 * - Before a plan: "Start your plan", every event with one countdown, in a
 *   few quick questions and no account needed, with an arrow that nudges
 *   now and then. A tap starts the first questions.
 * - With a plan made before signing in (kept on this phone): its countdown,
 *   and "Open my plan" in the corner. A tap saves it to their account
 *   (signing in first) and opens My Wedding: the rest of the app is behind
 *   it, so the card is the reason to sign in.
 * - With a plan (`planDate` given, null when there's no date yet): the
 *   plan's countdown, opening My Wedding.
 */
export function DateCard({ planDate }: { planDate?: string | null }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { status, requireSignIn } = useSession();
  const draft = useWeddingDraft();
  const { place } = useSearchLocation();
  const startPlanning = useStartPlanning();
  const { save } = useSaveDraftPlan();
  const signedIn = status === 'signedIn';
  const planning = planDate !== undefined;
  const drafted = !planning && hasDraftPlan(draft);
  const date = planning ? planDate : draft.date;
  const days = date ? daysUntil(date) : null;
  const counting = days !== null && days > 0;
  const shownDays = useCountUp(counting ? days : 0);
  const where = place?.label.split(' · ').pop();

  const open = () => {
    selectionHaptic();
    if (planning) router.push('/plan');
    else if (drafted) {
      requireSignIn(() => {
        save()
          .then(() => router.navigate('/plan'))
          .catch(() => {
            const message = t('home.dateCard.saveFailed');
            if (Platform.OS === 'web') globalThis.alert(message);
            else Alert.alert(message);
          });
      });
    } else startPlanning();
  };

  const label = counting
    ? t('home.dateCard.countingLabel', { count: days, date: formatDate(date!) })
    : planning || drafted
      ? t('home.dateCard.yourWedding')
      : t('home.dateCard.startLabel', { count: STEPS.length });
  const hint = planning
    ? t('home.dateCard.hintPlan')
    : drafted
      ? t('home.dateCard.hintSave')
      : t('home.dateCard.hint');

  let corner: ReactNode;
  if (planning) corner = counting ? <WedMark size={30} color="onHero" /> : <Go />;
  else if (drafted) {
    corner = (
      <Nudge>
        <View style={styles.open}>
          <AppText variant="label" weight={700} style={{ color: Colors.ombreBase }}>
            {t('home.dateCard.open')}
          </AppText>
          <Icon name="arrow-forward" size={16} color={Colors.ombreBase} weight="bold" />
        </View>
      </Nudge>
    );
  } else {
    corner = (
      <Nudge>
        <Go />
      </Nudge>
    );
  }

  return (
    <Animated.View entering={Motion.rise}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        pressedScale={0.98}
        onPress={open}
        style={styles.card}
      >
        <OmbreBackground />

        <View style={styles.top}>
          {counting ? (
            <>
              <View style={styles.countRow}>
                <AppText
                  weight={800}
                  color="onHero"
                  style={styles.count}
                  maxFontSizeMultiplier={1.3}
                >
                  {String(shownDays)}
                </AppText>
                <AppText variant="heading" weight={800} color="onHero" style={styles.upper}>
                  {t('home.dateCard.days', { count: days })}
                </AppText>
              </View>
              <AppText color="onHero2" style={styles.kicker} maxFontSizeMultiplier={1.4}>
                {(where
                  ? t('home.dateCard.untilIn', { place: where })
                  : t('home.dateCard.until')
                ).toUpperCase()}
              </AppText>
            </>
          ) : (
            <>
              <AppText
                variant="title"
                weight={800}
                color="onHero"
                style={[styles.title, styles.upper]}
                accessibilityRole="header"
              >
                {days !== null
                  ? days === 0
                    ? t('home.dateCard.today')
                    : t('home.dateCard.married')
                  : planning || drafted
                    ? t('home.dateCard.yourWedding')
                    : t('home.dateCard.start')}
              </AppText>
              <AppText color="onHero2" style={styles.kicker} maxFontSizeMultiplier={1.4}>
                {(days !== null
                  ? formatDate(date!)
                  : planning || drafted
                    ? t('home.dateCard.noDateYet')
                    : t('home.dateCard.startKicker')
                ).toUpperCase()}
              </AppText>
            </>
          )}
        </View>

        <View style={styles.bottom}>
          {planning || drafted ? (
            <AppText color="onHero2" style={styles.stamp} maxFontSizeMultiplier={1.3}>
              {stampDate(date ?? null)}
            </AppText>
          ) : (
            <View style={styles.grow}>
              <AppText color="onHero2" style={styles.small} maxFontSizeMultiplier={1.4}>
                {t('home.dateCard.questions', { count: STEPS.length }).toUpperCase()}
              </AppText>
              {!signedIn && (
                <AppText color="onHero2" style={styles.small} maxFontSizeMultiplier={1.4}>
                  {t('home.dateCard.noAccount').toUpperCase()}
                </AppText>
              )}
            </View>
          )}
          {corner}
        </View>
      </PressableScale>
    </Animated.View>
  );
}

/** The round white arrow in the card's corner. */
function Go() {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.go}>
      <Icon name="arrow-forward" size={22} color={Colors.ombreBase} weight="semibold" />
    </View>
  );
}

/**
 * Leans forward a few points every few seconds and back, on the iPhone's
 * curve, like a hand beckoning: the card is meant to be tapped. Still with
 * Reduce Motion.
 */
function Nudge({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    x.value = withRepeat(
      withSequence(
        withDelay(2400, withTiming(6, { duration: 280, easing: iosEasing })),
        withTiming(0, { duration: 360, easing: iosEasing }),
      ),
      -1,
    );
  }, [x, reduceMotion]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const useStyles = makeStyles((Colors) => ({
  card: {
    minHeight: 228,
    justifyContent: 'space-between',
    gap: Spacing.xl,
    padding: Spacing.xl,
    borderRadius: Radius.card + 8,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: Colors.ombreBase,
    boxShadow: '0 12px 32px rgba(92, 15, 32, 0.28)',
  },
  top: {
    gap: Spacing.sm,
  },
  title: {
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  upper: {
    textTransform: 'uppercase',
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: Spacing.sm,
  },
  count: {
    fontSize: 64,
    lineHeight: 70,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  kicker: {
    fontFamily: MONO,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 2.4,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  grow: {
    flex: 1,
  },
  stamp: {
    fontFamily: MONO,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 1,
  },
  small: {
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 1.8,
  },
  go: {
    width: Sizes.tapTarget,
    height: Sizes.tapTarget,
    borderRadius: Sizes.tapTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.onHero,
  },
  open: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    borderRadius: 20,
    backgroundColor: Colors.onHero,
  },
}));
