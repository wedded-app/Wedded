import { Pressable, View } from 'react-native';

import { AppText, useFontScale } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { BorderWidth, makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { selectionHaptic } from '@/lib/haptics';

import type { Mode } from './wed-store';

const MODES: { value: Mode; title: string; body: string }[] = [
  {
    value: 'ask',
    title: 'Ask me first',
    body: 'Wed looks things up and gets everything ready. It asks you before it does anything else.',
  },
  {
    value: 'small',
    title: 'Do the small things',
    body: "Wed can save vendors to your lists, add tours to your calendar and set reminders for you without asking. You'll see each one with Undo.",
  },
];

/**
 * How much Wed does on its own, as two cards to pick from: Ask me first (the
 * default), or Do the small things. The picked card has a maroon edge and a
 * check, so colour isn't the only signal. Messaging, booking and paying
 * always need a tap either way; there is no "do everything" choice.
 */
export function ModeSwitch({ value, onChange }: { value: Mode; onChange(mode: Mode): void }) {
  const Colors = useColors();
  const styles = useStyles();
  const scale = Math.min(useFontScale('body'), 1.4);
  return (
    <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel="How much Wed does">
      {MODES.map((mode) => {
        const selected = mode.value === value;
        return (
          <Pressable
            key={mode.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, selected }}
            accessibilityLabel={`${mode.title}. ${mode.body}`}
            onPress={() => {
              if (selected) return;
              selectionHaptic();
              onChange(mode.value);
            }}
            style={({ pressed }) => [
              styles.card,
              selected && styles.selected,
              pressed && !selected && styles.pressed,
            ]}
          >
            <View style={styles.top}>
              <AppText variant="heading" style={styles.grow}>
                {mode.title}
              </AppText>
              <Icon
                name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                size={26 * scale}
                color={selected ? Colors.primary : Colors.chevron}
              />
            </View>
            <AppText color="text2">{mode.body}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  list: {
    gap: Spacing.md,
  },
  card: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    borderWidth: BorderWidth.strong,
    // The same width either way, so picking doesn't nudge the text
    borderColor: 'transparent',
    backgroundColor: Colors.surface,
  },
  selected: {
    borderColor: Colors.primary,
  },
  pressed: {
    backgroundColor: Colors.rowPressed,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  grow: {
    flex: 1,
  },
}));
