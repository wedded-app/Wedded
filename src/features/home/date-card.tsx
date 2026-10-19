import { router } from 'expo-router';
import { Platform, Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { OmbreBackground } from '@/components/ombre-background';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { useSearchLocation } from '@/features/location/search-location';
import { useStartPlanning } from '@/features/onboarding/start';
import { daysUntil } from '@/features/planner/plan';
import { WedMark } from '@/features/wed/wed-mark';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';
import { useCountUp } from '@/lib/use-count-up';

import { hasDraft, useWeddingDraft } from './wedding-draft';

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
 * The first thing on Home before there's a plan: the wedding, on a card of
 * slowly moving wine-and-rose ombre (OmbreBackground). Before they've said:
 * "When's the wedding?" with a round arrow to tap. After: the days counting
 * up to it, where, and the date stamped in the corner. A tap opens the
 * quick questions (/when), which need no account; once there's something
 * to save, a line under it signs them in and makes the plan from it.
 * Signed in without a plan, the card starts the first questions instead.
 */
export function DateCard() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { status } = useSession();
  const draft = useWeddingDraft();
  const { place } = useSearchLocation();
  const startPlanning = useStartPlanning();
  const signedIn = status === 'signedIn';
  const days = draft.date ? daysUntil(draft.date) : null;
  const counting = days !== null && days > 0;
  const shownDays = useCountUp(counting ? days : 0);
  const where = place?.label.split(' · ').pop();

  const open = () => {
    selectionHaptic();
    if (signedIn) startPlanning();
    else router.push('/when');
  };

  const label = counting
    ? t('home.dateCard.countingLabel', { count: days, date: formatDate(draft.date!) })
    : t('home.dateCard.askLabel');

  return (
    <Animated.View entering={Motion.rise} style={styles.wrap}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('home.dateCard.hint')}
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
                  : t('home.dateCard.ask')}
              </AppText>
              <AppText color="onHero2" style={styles.kicker} maxFontSizeMultiplier={1.4}>
                {(days !== null
                  ? formatDate(draft.date!)
                  : draft.noDateYet
                    ? t('home.dateCard.noDateYet')
                    : t('home.dateCard.askKicker')
                ).toUpperCase()}
              </AppText>
            </>
          )}
        </View>

        <View style={styles.bottom}>
          <AppText color="onHero2" style={styles.stamp} maxFontSizeMultiplier={1.3}>
            {stampDate(draft.date)}
          </AppText>
          {counting ? (
            <WedMark size={30} color="onHero" />
          ) : (
            <View style={styles.go}>
              <Icon name="arrow-forward" size={22} color={Colors.ombreBase} weight="semibold" />
            </View>
          )}
        </View>
      </PressableScale>

      {!signedIn && hasDraft(draft) && (
        <Pressable
          accessibilityRole="button"
          onPress={startPlanning}
          style={({ pressed }) => [styles.save, pressed && styles.pressed]}
        >
          <AppText weight={600} color="primary">
            {t('home.dateCard.save')}
          </AppText>
          <Icon name="chevron-forward" size={16} color={Colors.primary} weight="semibold" />
        </Pressable>
      )}
    </Animated.View>
  );
}

const useStyles = makeStyles((Colors) => ({
  wrap: {
    gap: Spacing.sm,
  },
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
  },
  stamp: {
    fontFamily: MONO,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 1,
  },
  go: {
    width: Sizes.tapTarget,
    height: Sizes.tapTarget,
    borderRadius: Sizes.tapTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.onHero,
  },
  save: {
    minHeight: Sizes.tapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  pressed: {
    opacity: 0.5,
  },
}));
