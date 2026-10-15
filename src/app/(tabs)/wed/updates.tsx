import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  LayoutAnimationConfig,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { AppText, useFontScale } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { ListRow, ListSection, SectionTitle } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { makeStyles, Sizes, Spacing, Springs, useColors } from '@/constants/theme';
import { ApprovalCard } from '@/features/wed/approval-card';
import { FAMILY } from '@/features/wed/mock';
import { StepList } from '@/features/wed/step-list';
import { WED_BACK } from '@/features/wed/open-wed';
import { WedMark } from '@/features/wed/wed-mark';
import {
  activeTasks,
  clockTime,
  doneEntries,
  useWed,
  wed,
  type Task,
  type WedState,
} from '@/features/wed/wed-store';
import { Motion } from '@/lib/motion';

/**
 * Updates (the side menu's first page, and where "2 need your OK" goes):
 * the cards that wait for the family's yes, what Wed is working on (each
 * opens to its steps and what it looked at), and what's done. It reads the
 * same store as the thread and Home, so a yes here clears the tab badge and
 * resolves the card everywhere.
 */
export default function WedUpdatesScreen() {
  const styles = useStyles();
  // A card said "Not now" to stays here (with its Undo) until the page closes
  const [openedAt] = useState(() => Date.now());
  const cards = useWed((s) =>
    s.approvals
      .filter(
        (a) =>
          a.stage === 'waiting' ||
          a.stage === 'held' ||
          (a.stage === 'declined' && (a.doneAt ?? 0) >= openedAt),
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((a) => a.id),
  );
  const tasks = useWed(activeTasks);
  const done = useWed(doneRows);
  const role = useWed((s) => s.role);
  // Only someone who can say yes is asked for their OK
  const cardsTitle =
    role === 'owner'
      ? 'Needs your OK'
      : role === 'suggester'
        ? `Ideas for ${FAMILY.owner}`
        : 'Waiting for an OK';
  const [open, setOpen] = useState<string[]>([]);
  const toggle = (id: string) =>
    setOpen((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const caughtUp = cards.length === 0 && tasks.length === 0;

  return (
    <NavScreen title="Updates" backTo={WED_BACK}>
      {/* Cards already here when the page opens just show; new ones rise in */}
      <LayoutAnimationConfig skipEntering>
        {caughtUp ? (
          <Animated.View key="caught-up" entering={Motion.enter}>
            <StateView
              state="empty"
              icon="checkmark-circle-outline"
              message="All caught up. Nothing needs you right now."
              style={styles.empty}
            />
          </Animated.View>
        ) : null}

        {cards.length > 0 ? (
          <Animated.View key="cards" layout={Motion.layout} style={styles.block}>
            <SectionTitle>{cardsTitle}</SectionTitle>
            {cards.map((id) => (
              <Animated.View
                key={id}
                entering={Motion.rise}
                exiting={Motion.exit}
                layout={Motion.layout}
              >
                <ApprovalCard id={id} on="grouped" />
              </Animated.View>
            ))}
          </Animated.View>
        ) : null}

        {tasks.length > 0 ? (
          <Animated.View key="working" layout={Motion.layout} entering={Motion.rise}>
            <ListSection header="Working on" inset>
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  open={open.includes(task.id)}
                  onToggle={() => toggle(task.id)}
                />
              ))}
            </ListSection>
          </Animated.View>
        ) : null}

        {done.length > 0 ? (
          <Animated.View key="done" layout={Motion.layout} entering={Motion.rise}>
            <ListSection header="Done" inset>
              {done.map((row) => (
                <DoneRow key={row.key} row={row} />
              ))}
            </ListSection>
          </Animated.View>
        ) : null}
      </LayoutAnimationConfig>
    </NavScreen>
  );
}

/**
 * One thing Wed is doing. A running task shows its current step and "3 of
 * 4", and opens to every step with what it found or is looking at. A task
 * waiting on vendors ("Waiting for 3 dhol players to reply") is one still row.
 */
function TaskRow({ task, open, onToggle }: { task: Task; open: boolean; onToggle: () => void }) {
  const styles = useStyles();
  const scale = useFontScale('body');
  const mark = (
    <View style={[styles.slot, { width: Sizes.rowIcon * Math.min(scale, 1.4) }]}>
      <WedMark size={20} />
    </View>
  );

  if (task.state !== 'running' || task.steps.length === 0) {
    return <ListRow leading={mark} title={task.title} subtitle={task.short} />;
  }

  const progress = `${task.now + 1} of ${task.steps.length}`;
  return (
    <Animated.View layout={Motion.layout}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${task.title}. ${task.short}. Step ${progress}`}
        accessibilityHint={open ? 'Hides the steps' : 'Shows every step'}
        onPress={onToggle}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {mark}
        <View style={styles.grow}>
          <AppText>{task.title}</AppText>
          <AppText variant="label" weight={400} color="text2">
            {task.short}
          </AppText>
        </View>
        <AppText color="text2">{progress}</AppText>
        <Disclosure open={open} />
      </Pressable>
      {open ? (
        <Animated.View entering={Motion.enter} exiting={Motion.exit} style={styles.steps}>
          <StepList steps={task.steps} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

type Done = { key: string; text: string; at: number; preview?: boolean; undo?: () => void };

// Everything finished, newest first, with Undo where it still works: a
// receipt with an undo flow ("Saved 3 to your Jaago list"), or a card done
// the other way ("Marked Royal Orchard's deposit paid")
function doneRows(s: WedState): Done[] {
  return doneEntries(s).map((entry) => {
    const item = s.items.find((i) => i.key === entry.key);
    if (item?.kind === 'receipt' && item.undoFlow) {
      return { ...entry, undo: () => wed.undoReceipt(entry.key) };
    }
    const card = s.approvals.find((a) => a.id === entry.key);
    if (card?.stage === 'done' && card.chose === 'alt') {
      return { ...entry, undo: () => wed.undo(entry.key) };
    }
    return entry;
  });
}

function DoneRow({ row }: { row: Done }) {
  const time = clockTime(row.at);
  if (!row.undo) {
    return (
      <ListRow
        // A preview moved nothing: no green check that could read as paid
        icon={row.preview ? 'information-circle-outline' : 'checkmark-circle'}
        iconColor={row.preview ? 'text2' : 'success'}
        title={row.text}
        value={time}
        accessibilityLabel={`${row.text}, ${time}`}
      />
    );
  }
  return (
    <ListRow
      icon="checkmark-circle"
      iconColor="success"
      title={row.text}
      subtitle={time}
      trailing={<TextButton label="Undo" a11y={`Undo: ${row.text}`} onPress={row.undo} />}
    />
  );
}

/** A word in maroon that does one thing: "Undo". */
function TextButton({
  label,
  a11y,
  onPress,
}: {
  label: string;
  a11y: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.textButton, pressed && styles.dim]}
    >
      <AppText weight={600} color="primary">
        {label}
      </AppText>
    </Pressable>
  );
}

/** The chevron on a row that opens in place: down when closed, turning up when open. */
function Disclosure({ open }: { open: boolean }) {
  const Colors = useColors();
  const scale = useFontScale('body');
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(open ? 180 : 0);

  useEffect(() => {
    const to = open ? 180 : 0;
    turn.value = reduceMotion ? to : withSpring(to, Springs.snappy);
  }, [open, reduceMotion, turn]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <Icon
        name="chevron-down"
        size={17 * Math.min(scale, 1.4)}
        color={Colors.chevron}
        weight="semibold"
      />
    </Animated.View>
  );
}

// Where a row's text starts after its icon slot: the steps line up with it
const TEXT_INSET = Spacing.lg + Sizes.rowIcon + Spacing.md;

const useStyles = makeStyles((Colors) => ({
  empty: {
    paddingTop: Spacing.xxxl,
  },
  block: {
    gap: Spacing.lg,
  },
  row: {
    minHeight: Sizes.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
  },
  pressed: {
    backgroundColor: Colors.rowPressed,
  },
  slot: {
    alignItems: 'center',
  },
  grow: {
    flex: 1,
    gap: 2,
  },
  steps: {
    paddingLeft: TEXT_INSET,
    paddingRight: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  textButton: {
    minHeight: Sizes.tapTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    marginRight: -Spacing.sm,
  },
  dim: {
    opacity: 0.5,
  },
}));
