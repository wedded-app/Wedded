import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

import { AppText, useFontScale } from '@/components/app-text';
import { eventIcon } from '@/components/event-icon';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Spacing, Timing, useColors } from '@/constants/theme';
import { stubParts } from '@/features/home/greeting';
import { iosEasing } from '@/lib/motion';

const STUB = 78;
const NOTCH = 20;

export type EventTicketProps = {
  slug: string;
  name: string;
  /** The day on the stub, yyyy-mm-dd: the event's own, else the wedding's. */
  date: string | null;
  /** When and where, as far as the family has said, or when it usually happens. */
  when: string | null;
  /** What it still needs, in words ("To book: DJ, cake"), or All set. */
  stillNeeds: string;
  complete: boolean;
  /** Who's booked, in words, when anyone is. */
  booked: string | null;
  /** How many are coming, from the RSVPs, when anyone's invited. */
  coming: string | null;
  open: boolean;
  onPress: () => void;
  /** Spoken in full for screen readers. */
  accessibilityLabel: string;
};

/**
 * One event on the Wedding tab as a ticket (the final look, 2026-10-23),
 * like Up next on Home and the date ticket on a vendor's page: the day on
 * a stub, a dashed perforation with notches cut top and bottom, then the
 * event's name, when and where, what it still needs in words, who's booked
 * and how many are coming. A tap opens or folds the event below it.
 */
export function EventTicket({
  slug,
  name,
  date,
  when,
  stillNeeds,
  complete,
  booked,
  coming,
  open,
  onPress,
  accessibilityLabel,
}: EventTicketProps) {
  const Colors = useColors();
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  // The stub widens a little with large text so the day still fits
  const stubWidth = Math.round(STUB * Math.min(useFontScale('caption'), 1.3));
  const stub = stubParts(date);

  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.value = reduceMotion
      ? open
        ? 1
        : 0
      : withTiming(open ? 1 : 0, { duration: Timing.quick, easing: iosEasing });
  }, [open, reduceMotion, turn]);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={accessibilityLabel}
      pressedScale={0.98}
      onPress={onPress}
      style={styles.ticket}
    >
      <View style={[styles.stub, { width: stubWidth }]}>
        {stub ? (
          <>
            <AppText variant="caption" weight={600} color="primary" style={styles.caps}>
              {stub.month}
            </AppText>
            <AppText weight={700} style={styles.day} maxFontSizeMultiplier={1.3}>
              {stub.day}
            </AppText>
            <AppText variant="caption" weight={600} color="text2" style={styles.caps}>
              {stub.weekday}
            </AppText>
          </>
        ) : (
          <Icon name={eventIcon(slug)} size={28} color={Colors.primary} />
        )}
      </View>
      <Svg width={2} height="100%" style={styles.perforation}>
        <Line
          x1={1}
          y1={10}
          x2={1}
          y2="100%"
          stroke={Colors.separator}
          strokeWidth={2}
          strokeDasharray="5 5"
        />
      </Svg>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <AppText variant="heading" weight={600} style={styles.grow}>
            {name}
          </AppText>
          <Animated.View style={[styles.chevron, chevron]}>
            <Icon name="chevron-down" size={18} color={Colors.chevron} weight="semibold" />
          </Animated.View>
        </View>
        {when && (
          <AppText variant="label" weight={400} color="text2">
            {when}
          </AppText>
        )}
        <View style={styles.status}>
          <View
            style={[styles.dot, { backgroundColor: complete ? Colors.success : Colors.primary }]}
          />
          <AppText
            variant="label"
            weight={600}
            color={complete ? 'success' : 'primary'}
            style={styles.grow}
          >
            {stillNeeds}
          </AppText>
        </View>
        {booked && (
          <AppText variant="label" weight={400} color="text2">
            {booked}
          </AppText>
        )}
        {coming && (
          <AppText variant="label" weight={400} color="text2">
            {coming}
          </AppText>
        )}
      </View>
      <View style={[styles.notch, styles.notchTop, { left: stubWidth - NOTCH / 2 }]} />
      <View style={[styles.notch, styles.notchBottom, { left: stubWidth - NOTCH / 2 }]} />
    </PressableScale>
  );
}

const useStyles = makeStyles((Colors) => ({
  ticket: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  stub: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: Spacing.lg,
  },
  caps: {
    letterSpacing: 0.6,
  },
  day: {
    fontSize: 34,
    lineHeight: 38,
  },
  perforation: {
    marginVertical: Spacing.sm,
  },
  body: {
    flex: 1,
    gap: Spacing.xs,
    paddingVertical: Spacing.lg,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  chevron: {
    marginTop: 3,
  },
  grow: {
    flex: 1,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 7,
  },
  // Cut out of the ticket in the page's colour, where the perforation meets the edges
  notch: {
    position: 'absolute',
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
    backgroundColor: Colors.bg,
  },
  notchTop: {
    top: -NOTCH / 2,
  },
  notchBottom: {
    bottom: -NOTCH / 2,
  },
}));
