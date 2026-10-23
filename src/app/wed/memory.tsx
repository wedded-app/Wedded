import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText, useFontScale } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { ListRow, ListSection } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import type { Fact } from '@/features/wed/mock';
import { WedCloseButton } from '@/features/wed/close-wed';
import { openWed, WED_BACK } from '@/features/wed/open-wed';
import { useWed, wed } from '@/features/wed/wed-store';
import { selectionHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

const GROUPS: { group: Fact['group']; header: string }[] = [
  { group: 'wedding', header: 'Your wedding' },
  { group: 'wishes', header: 'Family wishes' },
];

// How long a forgotten line stays, struck through, with Undo
const UNDO_MS = 10_000;

type Forgotten = { fact: Fact; index: number; until: number };

/**
 * MOCKUP: What Wed knows. Its memory isn't hidden: the wedding's facts and
 * the family's wishes. Each says who sees it (Shared with family or Only
 * me); changing that takes its own button and a clear choice, never a tap
 * on the words. Forget leaves the line struck through with Undo for 10
 * seconds; Forget everything at the end asks to be sure first.
 */
export default function WedMemoryScreen() {
  const styles = useStyles();
  const facts = useWed((s) => s.facts);
  const [forgotten, setForgotten] = useState<Forgotten[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const forget = (fact: Fact) => {
    selectionHaptic();
    const index = facts.findIndex((f) => f.id === fact.id);
    wed.forget(fact.id);
    setForgotten((list) => [...list, { fact, index, until: Date.now() + UNDO_MS }]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setForgotten((list) => list.filter((f) => f.fact.id !== fact.id));
    }, UNDO_MS);
    timers.current.add(timer);
  };
  const undo = (item: Forgotten) => {
    selectionHaptic();
    wed.restoreFact(item.fact, item.index);
    setForgotten((list) => list.filter((f) => f.fact.id !== item.fact.id));
  };

  if (facts.length === 0 && forgotten.length === 0) {
    return (
      <NavScreen title="What Wed knows" backTo={WED_BACK} trailing={<WedCloseButton />}>
        <Animated.View entering={Motion.enter}>
          <StateView
            state="empty"
            icon="book-outline"
            message="Wed doesn't remember anything yet. Tell it about your wedding in the chat."
            action={{ label: 'Open Wed', onPress: () => openWed() }}
          />
        </Animated.View>
      </NavScreen>
    );
  }

  return (
    <NavScreen
      title="What Wed knows"
      subtitle="Each line says who can see it."
      backTo={WED_BACK}
      trailing={<WedCloseButton />}
    >
      {GROUPS.map(({ group, header }) => {
        // What Wed knows, with lines just forgotten back in their places
        const rows: (Fact | Forgotten)[] = facts.filter((fact) => fact.group === group);
        for (const item of [...forgotten].sort((a, b) => a.index - b.index)) {
          if (item.fact.group !== group) continue;
          const before = facts.slice(0, item.index).filter((f) => f.group === group).length;
          rows.splice(Math.min(before, rows.length), 0, item);
        }
        if (rows.length === 0) return null;
        return (
          <Animated.View key={group} layout={Motion.layout} exiting={Motion.exit}>
            <ListSection header={header}>
              {rows.map((row) =>
                'until' in row ? (
                  <ForgottenRow key={row.fact.id} item={row} onUndo={() => undo(row)} />
                ) : (
                  <FactRow key={row.id} fact={row} onForget={() => forget(row)} />
                ),
              )}
            </ListSection>
          </Animated.View>
        );
      })}

      <Animated.View layout={Motion.layout} style={styles.end}>
        <AppText variant="label" weight={400} color="text2" style={styles.footnote}>
          Ask Wed to forget anything, any time. Wed never shares this outside your family.
        </AppText>

        {facts.length > 0 ? (
          <ListSection>
            <ListRow
              title="Forget everything"
              tone="error"
              onPress={() => confirmForgetAll(facts.length)}
            />
          </ListSection>
        ) : null}
      </Animated.View>
    </NavScreen>
  );
}

// The phone's own "are you sure?" (a browser has no Alert, so it asks there)
function confirmForgetAll(count: number) {
  const title = 'Forget everything?';
  const body = `Wed forgets all ${count} things it knows about your wedding. You can't undo this.`;
  const forget = () => {
    selectionHaptic();
    wed.forgetAll();
  };
  if (Platform.OS === 'web') {
    if (globalThis.confirm(`${title} ${body}`)) forget();
    return;
  }
  Alert.alert(title, body, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Forget everything', style: 'destructive', onPress: forget },
  ]);
}

/**
 * One thing Wed knows, in the row's full width (the words themselves do
 * nothing when tapped). Under it, who sees it as its own button, which opens
 * the two choices right there, and a quiet Forget on the right.
 */
function FactRow({ fact, onForget }: { fact: Fact; onForget: () => void }) {
  const Colors = useColors();
  const styles = useStyles();
  const scale = Math.min(useFontScale('label'), 1.4);
  const [choosing, setChoosing] = useState(false);
  const who = fact.shared ? 'Shared with family' : 'Only me';

  const choose = (shared: boolean) => {
    selectionHaptic();
    wed.setShared(fact.id, shared);
    setChoosing(false);
  };

  return (
    <Animated.View layout={Motion.layout} exiting={Motion.exit} style={styles.row}>
      <AppText>{fact.text}</AppText>
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: choosing }}
          accessibilityLabel={`Who sees it: ${who}`}
          accessibilityHint="Shows who can see this"
          onPress={() => setChoosing((open) => !open)}
          hitSlop={4}
          style={({ pressed }) => [styles.who, pressed && styles.dim]}
        >
          <Icon
            name={fact.shared ? 'people-outline' : 'lock-closed-outline'}
            size={16 * scale}
            color={Colors.text2}
          />
          <AppText variant="label" weight={600} color="text2">
            {who}
          </AppText>
          <Icon
            name={choosing ? 'chevron-up' : 'chevron-down'}
            size={14 * scale}
            color={Colors.text2}
            weight="semibold"
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Forget: ${fact.text}`}
          onPress={onForget}
          hitSlop={4}
          style={({ pressed }) => [styles.forget, pressed && styles.dim]}
        >
          <AppText variant="label" weight={600} color="text2">
            Forget
          </AppText>
        </Pressable>
      </View>
      {choosing ? (
        <Animated.View entering={Motion.enter} style={styles.choices}>
          <Choice label="Shared with family" selected={fact.shared} onPress={() => choose(true)} />
          <View style={styles.choiceLine} />
          <Choice label="Only me" selected={!fact.shared} onPress={() => choose(false)} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** One of the two who-sees-it choices, ticked when it's the one now. */
function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
    >
      <AppText style={styles.grow}>{label}</AppText>
      {selected ? <Icon name="checkmark" size={20} color={Colors.text} weight="semibold" /> : null}
    </Pressable>
  );
}

/** A line just forgotten: struck through, with Undo for 10 seconds. */
function ForgottenRow({ item, onUndo }: { item: Forgotten; onUndo: () => void }) {
  const styles = useStyles();
  return (
    <Animated.View
      layout={Motion.layout}
      entering={Motion.enter}
      exiting={Motion.exit}
      style={[styles.row, styles.forgottenRow]}
    >
      <AppText color="text2" style={[styles.grow, styles.struck]}>
        {item.fact.text}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Undo forgetting: ${item.fact.text}`}
        onPress={onUndo}
        hitSlop={4}
        style={({ pressed }) => [styles.undo, pressed && styles.dim]}
      >
        <AppText weight={600} color="primary">
          Undo
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

const useStyles = makeStyles((Colors) => ({
  row: {
    minHeight: Sizes.row,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.surface,
  },
  // Who sees it on the left, Forget on the right, close under the words
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  who: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  forget: {
    minHeight: 40,
    justifyContent: 'center',
    paddingLeft: Spacing.md,
  },
  choices: {
    marginBottom: Spacing.md,
    borderRadius: Radius.field,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: Colors.fill,
  },
  choice: {
    minHeight: Sizes.tapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  choicePressed: {
    backgroundColor: Colors.fillPressed,
  },
  choiceLine: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.md,
    backgroundColor: Colors.separator,
  },
  forgottenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: 0,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  undo: {
    minHeight: Sizes.tapTarget,
    justifyContent: 'center',
  },
  grow: {
    flex: 1,
  },
  dim: {
    opacity: 0.5,
  },
  end: {
    gap: Spacing.xl,
    // Closer to the sections above than the page's usual gap: it's their footer
    marginTop: -Spacing.md,
  },
  footnote: {
    paddingHorizontal: Spacing.lg,
  },
}));
