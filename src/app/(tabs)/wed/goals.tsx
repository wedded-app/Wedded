import { useSyncExternalStore } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText, useFontScale } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { ListSection, SectionTitle } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { ProgressBar } from '@/components/progress-bar';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { AskWedButton } from '@/features/wed/ask-wed-button';
import { GOALS, WATCHES, type MockGoal, type MockWatch } from '@/features/wed/mock';
import { openWed, WED_BACK } from '@/features/wed/open-wed';
import { onWedReset, receiptText, useWed } from '@/features/wed/wed-store';
import { selectionHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

type Watch = MockWatch & { paused: boolean };

// MOCKUP: the watches live here, not in Wed's store, so a pause or a
// removal lasts while the app is open (until a reload or Replay the demo)
const freshWatches = (): Watch[] => WATCHES.map((watch) => ({ ...watch, paused: false }));
let watchList = freshWatches();
const watchListeners = new Set<() => void>();

function setWatchList(next: Watch[]) {
  watchList = next;
  watchListeners.forEach((listener) => listener());
}

onWedReset(() => setWatchList(freshWatches()));

function subscribeWatches(listener: () => void) {
  watchListeners.add(listener);
  return () => {
    watchListeners.delete(listener);
  };
}

const getWatches = () => watchList;

/**
 * Goals: one for each event (how much of it is booked and what Wed is doing
 * about the rest), then what Wed watches for and tells the family about only
 * when it changes. "Talk about it" opens the chat about that event, with
 * "What's left to book for the …?" waiting in the composer.
 */
export default function WedGoalsScreen() {
  const styles = useStyles();
  const watches = useSyncExternalStore(subscribeWatches, getWatches, getWatches);

  const update = (next: Watch[]) => {
    selectionHaptic();
    setWatchList(next);
  };
  const togglePause = (id: string) =>
    update(watches.map((w) => (w.id === id ? { ...w, paused: !w.paused } : w)));
  const remove = (id: string) => update(watches.filter((w) => w.id !== id));

  return (
    <NavScreen
      title="Goals"
      subtitle="Wed keeps working on these and tells you only when something changes."
      backTo={WED_BACK}
    >
      <View style={styles.block}>
        <SectionTitle>Your events</SectionTitle>
        {GOALS.map((goal) => (
          <GoalCard key={goal.slug} goal={goal} />
        ))}
      </View>

      <View style={styles.block}>
        <SectionTitle>Watching for you</SectionTitle>
        <ListSection>
          {watches.map((watch) => (
            <Animated.View key={watch.id} layout={Motion.layout} exiting={Motion.exit}>
              <WatchRow
                watch={watch}
                onPause={() => togglePause(watch.id)}
                onRemove={() => remove(watch.id)}
              />
            </Animated.View>
          ))}
          <Animated.View key="add" layout={Motion.layout} style={styles.add}>
            <AskWedButton variant="row" label="Add something to watch" ask="Tell me if " />
          </Animated.View>
        </ListSection>
      </View>
    </NavScreen>
  );
}

/** An event: its name and date, essentials booked, and what Wed is doing next. */
function GoalCard({ goal }: { goal: MockGoal }) {
  const Colors = useColors();
  const styles = useStyles();
  const scale = useFontScale('body');
  const complete = goal.done >= goal.total;
  const answered = useWed((s) =>
    s.approvals.find((a) => a.id === goal.waitsOn && ['done', 'declined'].includes(a.stage)),
  );

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.grow}>
          <AppText variant="heading" accessibilityRole="header">
            {goal.name}
          </AppText>
          <AppText color="text2">{goal.when}</AppText>
        </View>
        <View style={styles.count}>
          {/* Green only on the tick: green words are too faint on white */}
          {complete ? (
            <Icon name="checkmark-circle" size={Sizes.iconSmall * scale} color={Colors.success} />
          ) : null}
          <AppText weight={600} color={complete ? 'text' : 'text2'}>
            {complete ? 'All booked' : `${goal.done} of ${goal.total} booked`}
          </AppText>
        </View>
      </View>
      <ProgressBar
        value={goal.total > 0 ? goal.done / goal.total : 0}
        color={complete ? Colors.success : Colors.text}
        trackColor={Colors.fill}
      />
      {/* "All booked" is already up top */}
      {complete ? null : (
        <AppText color="text2">{answered ? receiptText(answered) : goal.note}</AppText>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Talk about the ${goal.name} with Wed`}
        onPress={() =>
          openWed({ about: goal.about, ask: `What's left to book for the ${goal.name}?` })
        }
        hitSlop={4}
        style={({ pressed }) => [styles.talk, pressed && styles.dim]}
      >
        <AppText weight={600}>Talk about it</AppText>
      </Pressable>
    </View>
  );
}

/** Something Wed checks on by itself, with Pause or Resume and Remove under it. */
function WatchRow({
  watch,
  onPause,
  onRemove,
}: {
  watch: Watch;
  onPause: () => void;
  onRemove: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.watch}>
      <View style={styles.watchText} accessible>
        <AppText color={watch.paused ? 'text2' : 'text'}>{watch.title}</AppText>
        <AppText variant="label" weight={400} color="text2">
          {watch.paused ? 'Paused' : watch.detail}
        </AppText>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${watch.paused ? 'Resume' : 'Pause'}: ${watch.title}`}
          onPress={onPause}
          hitSlop={4}
          style={({ pressed }) => [styles.action, pressed && styles.dim]}
        >
          <AppText weight={600}>{watch.paused ? 'Resume' : 'Pause'}</AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove: ${watch.title}`}
          onPress={onRemove}
          hitSlop={4}
          style={({ pressed }) => [styles.action, pressed && styles.dim]}
        >
          <AppText weight={600} color="text2">
            Remove
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.lg,
  },
  card: {
    gap: Spacing.md,
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    columnGap: Spacing.md,
    rowGap: Spacing.xs,
  },
  grow: {
    flexGrow: 1,
    flexShrink: 1,
    gap: 2,
  },
  count: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingTop: 2,
  },
  talk: {
    minHeight: Sizes.tapTarget,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    marginTop: -Spacing.xs,
  },
  watch: {
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.surface,
  },
  watchText: {
    gap: 2,
  },
  // The words sit close under the text; their 48-point targets overlap it
  actions: {
    flexDirection: 'row',
    gap: Spacing.xl,
    marginTop: -Spacing.sm,
  },
  action: {
    minHeight: Sizes.tapTarget,
    justifyContent: 'center',
  },
  add: {
    paddingHorizontal: Spacing.lg,
  },
  dim: {
    opacity: 0.5,
  },
}));
