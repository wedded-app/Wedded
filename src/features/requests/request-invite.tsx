import { Image } from 'expo-image';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { backgroundCss, makeStyles, Radius, Spacing } from '@/constants/theme';
import { daysUntil } from '@/features/planner/plan-helpers';
import { useLocale } from '@/i18n/locale-context';

import { DateTile } from './night';
import type { PostFacts } from './request-parts';

/**
 * A request drawn like a small invitation (#219): a gold line across the top,
 * the date as a calendar page, the event in gold capitals, the headline in
 * the serif, "241 days away", the guests and budget, then `footer` (the
 * proposals, or a status). Readable at any text size: it stacks when there's
 * no room.
 */
export function RequestInvite({
  eventName,
  headline,
  date,
  facts,
  note,
  footer,
  sealed = false,
}: {
  eventName?: string | null;
  headline: string;
  date: string | null;
  facts: PostFacts;
  note?: string | null;
  footer?: ReactNode;
  /** A wax seal in the corner: the request is out with vendors. */
  sealed?: boolean;
}) {
  const styles = useStyles();
  const { t } = useLocale();
  const days = date ? daysUntil(date) : null;
  const details = [facts.guests, facts.budget].filter(Boolean).join(' · ');

  return (
    <View style={styles.card}>
      <GoldBand />
      {sealed && <WaxSeal />}
      <View style={styles.row}>
        {date ? <DateTile date={date} size="lg" /> : null}
        <View style={[styles.words, sealed && styles.roomForSeal]}>
          {eventName ? (
            <AppText variant="label" weight={700} color="champagne">
              {eventName.toUpperCase()}
            </AppText>
          ) : null}
          <AppText variant={headline.length > 11 ? 'section' : 'title'} serif weight={600}>
            {headline}
          </AppText>
          {days !== null && days >= 0 ? (
            <AppText weight={600} color="text2">
              {days === 0 ? t('requests.invite.today') : t('requests.invite.away', { count: days })}
            </AppText>
          ) : null}
        </View>
      </View>
      {details ? <AppText color="text2">{details}</AppText> : null}
      {note ? (
        <AppText style={styles.note} numberOfLines={4}>
          {`“${note}”`}
        </AppText>
      ) : null}
      {footer}
    </View>
  );
}

const RIBBON = require('../../../assets/images/ribbon-white.png');

/** A maroon wax seal with the Wedded ribbon pressed into it, tilted a little. */
function WaxSeal() {
  const styles = useStyles();
  return (
    <View style={styles.seal} accessible={false}>
      <View style={styles.sealRim}>
        <Image source={RIBBON} style={styles.sealMark} contentFit="contain" accessible={false} />
      </View>
    </View>
  );
}

/** The gold line across the top, with a brighter glint that sweeps along it now and then. */
function GoldBand() {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const sweep = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion || width === 0) return;
    sweep.set(
      withRepeat(
        withDelay(1200, withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.cubic) })),
        -1,
      ),
    );
  }, [reduceMotion, sweep, width]);
  const glint = useAnimatedStyle(() => ({
    transform: [{ translateX: -120 + sweep.value * (width + 240) }],
  }));
  return (
    <View style={styles.band} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {!reduceMotion && width > 0 && <Animated.View style={[styles.glint, glint]} />}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    gap: Spacing.md,
    padding: Spacing.xl,
    paddingTop: Spacing.xl + 4,
    borderRadius: Radius.card + 4,
    borderCurve: 'continuous',
    backgroundColor: Colors.nightCardStrong,
    borderWidth: 1,
    borderColor: Colors.nightLine,
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    overflow: 'hidden',
    ...backgroundCss(
      `linear-gradient(90deg, rgba(233,201,139,0) 0%, ${Colors.champagne} 50%, rgba(233,201,139,0) 100%)`,
    ),
  },
  seal: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 52,
    height: 52,
    borderRadius: 26,
    padding: 4,
    transform: [{ rotate: '-12deg' }],
    ...backgroundCss('radial-gradient(circle at 35% 30%, #C8405E 0%, #8A1C30 55%, #5A0F1E 100%)'),
    boxShadow: '0px 6px 14px rgba(0, 0, 0, 0.45)',
  },
  sealRim: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 220, 200, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealMark: {
    width: 26,
    height: 22,
    opacity: 0.8,
  },
  roomForSeal: {
    paddingRight: 40,
  },
  glint: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 120,
    ...backgroundCss(
      'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,246,220,0.95) 50%, rgba(255,255,255,0) 100%)',
    ),
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  words: {
    flex: 1,
    minWidth: 180,
    gap: Spacing.xs,
  },
  note: {
    fontStyle: 'italic',
  },
}));
