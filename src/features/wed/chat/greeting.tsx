import { router } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, useFontScale } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { daysUntil, usePlan } from '@/features/planner/plan';

import { daysToGo, FAMILY, greetingWords, STARTERS, WEDDING } from '../mock';
import { useWed, wed, type WedState } from '../wed-store';
import { WedMark } from '../wed-mark';

// The cards waiting for the family's yes, newest first (for the owner only)
const waitingTitles = (s: WedState) =>
  s.role !== 'owner'
    ? []
    : s.approvals
        .filter((a) => a.stage === 'waiting')
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((a) => a.title);

/**
 * The top of today in the thread: the mark, "Good evening, Simran" in the
 * serif, how many days are left and how much is left to book, the promise
 * that nothing is sent without a yes, then three things to try and More
 * ideas. When cards wait for a yes, a row under the promise says which
 * and opens Updates. With `minHeight` (an empty day) it fills the screen and
 * sits in the middle of what's left below `inset` (the header). A family
 * with a real plan sees their own days to go, not the sample's.
 */
export function Greeting({ minHeight, inset = 0 }: { minHeight?: number; inset?: number }) {
  const Colors = useColors();
  const styles = useStyles();
  const left = WEDDING.essentials - WEDDING.booked;
  const { weddingDate } = usePlan();
  const realDays = weddingDate ? daysUntil(weddingDate) : null;
  const days =
    realDays !== null && realDays >= 0
      ? `${realDays} days to go`
      : `${daysToGo()} days to go · ${left} things left to book`;
  const waiting = useWed(waitingTitles);
  const okWords =
    waiting.length === 1
      ? `Needs your OK: ${waiting[0]}`
      : `${waiting.length} need your OK: ${waiting[0]} and more`;

  return (
    <View style={[styles.greeting, minHeight ? { minHeight, paddingTop: inset } : styles.between]}>
      <WedMark size={40} />
      <View style={styles.words}>
        <AppText
          variant="title"

          weight={500}
          style={styles.center}
          accessibilityRole="header"
        >
          {`${greetingWords()}, ${FAMILY.me}`}
        </AppText>
        <View>
          <AppText color="text2" style={styles.center}>
            {days}
          </AppText>
          <AppText color="text2" style={styles.center}>
            Nothing is sent until you say yes.
          </AppText>
        </View>
      </View>
      {waiting.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={okWords}
          accessibilityHint="Opens Updates"
          onPress={() => router.push('/wed/updates')}
          style={({ pressed }) => [styles.waiting, pressed && styles.pressed]}
        >
          <WedMark size={20} />
          <AppText weight={600} style={styles.grow}>
            {okWords}
          </AppText>
          <Icon name="chevron-forward" size={17} color={Colors.chevron} weight="semibold" />
        </Pressable>
      ) : null}
      <View style={styles.starters}>
        <StarterRows />
      </View>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push('/wed/ideas')}
        hitSlop={4}
        style={({ pressed }) => [styles.more, pressed && styles.pressed]}
      >
        <AppText weight={600} color="primary">
          More ideas
        </AppText>
      </Pressable>
    </View>
  );
}

/**
 * The three things to try, as rows with hairlines between them. They only
 * read and look things up, so a tap sends at once; anything that would
 * reach a vendor still waits on a card. Also shown after an answer Wed
 * can't give yet.
 */
export function StarterRows() {
  const Colors = useColors();
  const styles = useStyles();
  const scale = Math.min(useFontScale('body'), 1.4);

  return (
    <View>
      {STARTERS.map((starter, index) => (
        <Fragment key={starter.text}>
          {index > 0 ? <View style={styles.hairline} /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={starter.text}
            accessibilityHint="Sends it to Wed"
            onPress={() => wed.send(starter.text)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Icon name={starter.icon} size={Math.round(20 * scale)} color={Colors.text2} />
            <AppText style={styles.grow}>{starter.text}</AppText>
            <Icon name="arrow-forward" size={Math.round(18 * scale)} color={Colors.chevron} />
          </Pressable>
        </Fragment>
      ))}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  greeting: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  // After yesterday's messages: room on either side, like a new day
  between: {
    paddingVertical: Spacing.xl,
  },
  words: {
    gap: Spacing.sm,
    alignSelf: 'stretch',
  },
  center: {
    textAlign: 'center',
  },
  starters: {
    alignSelf: 'stretch',
    marginTop: Spacing.sm,
  },
  // What waits for a yes, in a grey card so it reads as news, not a starter
  waiting: {
    alignSelf: 'stretch',
    minHeight: Sizes.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.canvasCard,
  },
  row: {
    minHeight: Sizes.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    // Under the words, past the icon
    marginLeft: Spacing.xxl,
    backgroundColor: Colors.separator,
  },
  more: {
    minHeight: Sizes.tapTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  grow: {
    flex: 1,
  },
  pressed: {
    opacity: 0.55,
  },
}));
