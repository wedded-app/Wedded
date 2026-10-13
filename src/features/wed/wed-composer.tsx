import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type TextStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { AppText, useTypeStyle } from '@/components/app-text';
import { Glass } from '@/components/glass';
import { Icon, type IconName } from '@/components/icon';
import { makeStyles, Radius, Sizes, Spacing, Springs, useColors } from '@/constants/theme';
import { selectionHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

import { useKeyboardHeight } from './keyboard-height';
import { HALL } from './mock';
import { VoiceBars } from './voice-bars';
import { getWed, useWed, wed } from './wed-store';

// Speech to text needs a development build, so dictation plays this script
const TRANSCRIPT = 'Find a dhol player for the Jaago';
const WORD_MS = 280;
const LINES = 5;
// The gap kept between the composer and the top of the keyboard
const KEYBOARD_GAP = Spacing.sm;
const CIRCLE = Sizes.tapTarget;

/**
 * Wed's composer: a glass capsule floating over the thread, `bottom` points
 * from the bottom of the screen (clear of the tab bar), lifting with the
 * keyboard. + on the left opens a small menu (a photo, a vendor or an event
 * to ask about); the field says "Ask Wed anything"; on the right the mic
 * turns into a maroon Send once there are words. The mic plays dictation in
 * place: Cancel, the words appearing beside moving bars, and Done, which
 * sends them. What it's about sits in a chip above it. Reads and writes the
 * store (draft, context), so openWed() can fill it from anywhere. On the web
 * Enter sends and Shift+Enter starts a new line.
 *
 * Render it as a direct child of the screen's full-size root view: it
 * positions itself, and while its menu is open it covers the screen to
 * close on a tap outside. `onHeight` reports how much of the thread it
 * covers, so the thread can keep its last row clear of a long draft.
 */
export function WedComposer({
  bottom,
  onHeight,
}: {
  bottom: number;
  /** The capsule's height with the chip above it (not the + menu), as it grows with the words. */
  onHeight?: (height: number) => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const draft = useWed((s) => s.draft);
  const context = useWed((s) => s.context);
  const keyboard = useKeyboardHeight();
  const [menuOpen, setMenuOpen] = useState(false);
  const [listening, setListening] = useState(false);

  const lift = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.max(0, keyboard.value + KEYBOARD_GAP - bottom) }],
  }));

  const pickPhoto = async () => {
    setMenuOpen(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      const uri = result.canceled ? undefined : result.assets[0]?.uri;
      // Whatever was typed goes with the photo
      if (uri) wed.send(getWed().draft, { photo: uri });
    } catch {
      // No photo: nothing changes
    }
  };

  return (
    <>
      {menuOpen && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close the menu"
          onPress={() => setMenuOpen(false)}
          style={StyleSheet.absoluteFill}
        />
      )}
      <Animated.View style={[styles.wrap, { bottom }, lift]}>
        {menuOpen && (
          <AddMenu
            onPhoto={pickPhoto}
            onVendor={() => {
              setMenuOpen(false);
              wed.setContext({
                kind: 'vendor',
                id: HALL.slug,
                label: HALL.name,
                thumb: HALL.photo,
              });
            }}
            onEvent={() => {
              setMenuOpen(false);
              wed.setContext({ kind: 'event', id: 'jaago', label: 'Jaago' });
            }}
          />
        )}
        <View
          style={styles.stack}
          onLayout={(event) => onHeight?.(event.nativeEvent.layout.height)}
        >
          {context && !listening ? (
            // No fade: iOS drops the glass on a view that fades from transparent
            <View style={styles.chipRow}>
              <Glass style={styles.chip}>
                {context.thumb ? (
                  <Image
                    source={{ uri: context.thumb }}
                    contentFit="cover"
                    style={styles.thumb}
                    accessible={false}
                  />
                ) : null}
                <AppText weight={500} numberOfLines={1} style={styles.chipText}>
                  {`About: ${context.label}`}
                </AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Stop asking about ${context.label}`}
                  onPress={() => wed.setContext(null)}
                  hitSlop={4}
                  style={({ pressed }) => [styles.chipClose, pressed && styles.pressed]}
                >
                  <Icon name="close" size={18} color={Colors.text2} weight="semibold" />
                </Pressable>
              </Glass>
            </View>
          ) : null}
          <Glass interactive style={styles.capsule}>
            {listening ? (
              <Dictation
                onCancel={() => setListening(false)}
                onDone={() => {
                  setListening(false);
                  wed.send(TRANSCRIPT, { spoken: true });
                }}
              />
            ) : (
              <Typing
                draft={draft}
                menuOpen={menuOpen}
                onAdd={() => setMenuOpen((open) => !open)}
                onMic={() => {
                  setMenuOpen(false);
                  selectionHaptic();
                  setListening(true);
                }}
              />
            )}
          </Glass>
        </View>
      </Animated.View>
    </>
  );
}

/** The field, + and the mic that turns into Send. */
function Typing({
  draft,
  menuOpen,
  onAdd,
  onMic,
}: {
  draft: string;
  menuOpen: boolean;
  onAdd: () => void;
  onMic: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const { script, maxFontSizeMultiplier, ...font } = useTypeStyle({ variant: 'body', text: draft });
  const hasWords = draft.trim().length > 0;
  const shown = useSharedValue(hasWords ? 1 : 0);

  useEffect(() => {
    const target = hasWords ? 1 : 0;
    shown.value = reduceMotion ? target : withSpring(target, Springs.snappy);
  }, [hasWords, reduceMotion, shown]);

  const micStyle = useAnimatedStyle(() => ({
    opacity: 1 - shown.value,
    transform: [{ scale: 1 - 0.2 * shown.value }],
  }));
  const sendStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ scale: 0.8 + 0.2 * shown.value }],
  }));

  const send = () => {
    if (hasWords) wed.send(draft);
  };

  // The web: Enter sends, Shift+Enter is a new line
  const onKeyPress =
    Platform.OS === 'web'
      ? (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
          const key = event.nativeEvent as TextInputKeyPressEventData & {
            shiftKey?: boolean;
            isComposing?: boolean;
          };
          if (key.key !== 'Enter' || key.shiftKey || key.isComposing) return;
          (event as unknown as { preventDefault: () => void }).preventDefault();
          send();
        }
      : undefined;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add a photo, a vendor or an event"
        accessibilityState={{ expanded: menuOpen }}
        onPress={onAdd}
        style={({ pressed }) => [styles.circle, pressed && styles.pressed]}
      >
        <Icon name="add" size={26} color={Colors.text} weight="medium" />
      </Pressable>
      <TextInput
        value={draft}
        onChangeText={wed.setDraft}
        placeholder="Ask Wed anything"
        placeholderTextColor={Colors.text2}
        multiline
        {...ONE_ROW_ON_WEB}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        accessibilityLabel="Ask Wed anything"
        accessibilityLanguage={script}
        onKeyPress={onKeyPress}
        style={[
          font,
          styles.input,
          { color: Colors.text, maxHeight: font.lineHeight * LINES + Spacing.md * 2 },
          Platform.OS === 'web' && growOnWeb,
        ]}
      />
      <View style={styles.circle}>
        {/* Whether each takes taps is always written out: Reanimated on the
            web never removes a style key that drops out of an animated view */}
        <Animated.View
          style={[styles.layer, micStyle, { pointerEvents: hasWords ? 'none' : 'auto' }]}
          accessibilityElementsHidden={hasWords}
          importantForAccessibility={hasWords ? 'no-hide-descendants' : 'auto'}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Talk to Wed"
            onPress={onMic}
            style={({ pressed }) => [styles.circle, pressed && styles.pressed]}
          >
            <Icon name="mic-outline" size={24} color={Colors.text} />
          </Pressable>
        </Animated.View>
        <Animated.View
          style={[styles.layer, sendStyle, { pointerEvents: hasWords ? 'auto' : 'none' }]}
          accessibilityElementsHidden={!hasWords}
          importantForAccessibility={hasWords ? 'auto' : 'no-hide-descendants'}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            onPress={send}
            style={({ pressed }) => [styles.circle, styles.sendFill, pressed && styles.sendPressed]}
          >
            <Icon name="arrow-up" size={24} color={Colors.onPrimary} weight="bold" />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

/** Dictation in the capsule: Cancel, the words as they're heard, Done. */
function Dictation({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const Colors = useColors();
  const styles = useStyles();
  const words = TRANSCRIPT.split(' ');
  const [heard, setHeard] = useState(0);

  // A beat to start, then a word every 280 ms
  useEffect(() => {
    if (heard >= words.length) return;
    const timer = setTimeout(() => setHeard((n) => n + 1), heard === 0 ? 600 : WORD_MS);
    return () => clearTimeout(timer);
  }, [heard, words.length]);

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        onPress={onCancel}
        style={({ pressed }) => [styles.circle, styles.cancelFill, pressed && styles.pressed]}
      >
        <Icon name="close" size={22} color={Colors.text} weight="semibold" />
      </Pressable>
      <View style={styles.heard}>
        <VoiceBars height={24} />
        <AppText
          numberOfLines={2}
          color={heard === 0 ? 'text2' : 'text'}
          style={styles.grow}
          accessibilityLiveRegion="polite"
        >
          {heard === 0 ? 'Listening…' : words.slice(0, heard).join(' ')}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Done, send it"
        onPress={onDone}
        style={({ pressed }) => [styles.done, styles.sendFill, pressed && styles.sendPressed]}
      >
        <Icon name="checkmark" size={22} color={Colors.onPrimary} weight="bold" />
        <AppText weight={600} color="onPrimary" maxFontSizeMultiplier={1.3}>
          Done
        </AppText>
      </Pressable>
    </View>
  );
}

/** The small menu above +: a photo, a vendor or an event to ask about. */
function AddMenu({
  onPhoto,
  onVendor,
  onEvent,
}: {
  onPhoto: () => void;
  onVendor: () => void;
  onEvent: () => void;
}) {
  const styles = useStyles();
  return (
    <Animated.View entering={Motion.popIn} exiting={Motion.popOut} style={styles.menuWrap}>
      {/* Solid, not glass: what's behind it would show through the words */}
      <View style={styles.menu}>
        <MenuRow icon="images-outline" label="Photo" onPress={onPhoto} />
        <MenuRow icon="storefront-outline" label="A vendor" onPress={onVendor} />
        <MenuRow icon="calendar-outline" label="An event" onPress={onEvent} />
      </View>
    </Animated.View>
  );
}

function MenuRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && styles.menuPressed]}
    >
      <Icon name={icon} size={22} color={Colors.text} />
      <AppText>{label}</AppText>
    </Pressable>
  );
}

// Grows with its lines in browsers that can (field-sizing), up to maxHeight,
// from one row (a textarea starts at two)
const growOnWeb = { fieldSizing: 'content' } as unknown as TextStyle;
const ONE_ROW_ON_WEB = (Platform.OS === 'web' ? { rows: 1 } : {}) as object;

const useStyles = makeStyles((Colors) => ({
  wrap: {
    position: 'absolute',
    left: Sizes.pageGutter,
    right: Sizes.pageGutter,
    gap: Spacing.sm,
  },
  stack: {
    gap: Spacing.sm,
  },
  capsule: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
    borderRadius: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Dictation's Done: the word beside the tick, so it's clear it sends
  done: {
    minHeight: CIRCLE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.lg,
    borderRadius: CIRCLE / 2,
  },
  sendFill: {
    backgroundColor: Colors.primaryFill,
  },
  sendPressed: {
    backgroundColor: Colors.primaryFillPressed,
  },
  cancelFill: {
    backgroundColor: Colors.fill,
  },
  input: {
    flex: 1,
    minHeight: CIRCLE,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    textAlignVertical: 'center',
    outlineWidth: 0,
  },
  heard: {
    flex: 1,
    minHeight: CIRCLE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  grow: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
  },
  chip: {
    height: 44,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    borderRadius: Radius.chip,
  },
  thumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginLeft: -Spacing.xs,
  },
  chipText: {
    flexShrink: 1,
  },
  chipClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuWrap: {
    alignItems: 'flex-start',
  },
  menu: {
    minWidth: 248,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
  },
  menuRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  menuPressed: {
    backgroundColor: Colors.fillPressed,
  },
  pressed: {
    opacity: 0.55,
  },
}));
