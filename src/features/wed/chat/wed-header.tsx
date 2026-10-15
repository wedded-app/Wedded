import { router } from 'expo-router';
import { Platform, Pressable, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { GlassButton } from '@/components/glass-button';
import { makeStyles, Radius, Sizes, Spacing, Typography, useColors } from '@/constants/theme';
import { Motion } from '@/lib/motion';

import { FAMILY } from '../mock';
import { useWed, waitingCount, type WedState } from '../wed-store';

/** How far the header's page colour fades out below its words, over the thread. */
export const HEADER_FADE = Spacing.xl;
// Pulls the status line up under the title, between the round buttons
const TUCK = 6;

// The status line, only while Wed is busy: "Working · 2 of 4" while a task
// runs (the thread's working line already says what), or what it waits for
// ("Waiting for 3 dhol players to reply"). Nothing when idle: the capsule
// says when cards wait, and "All caught up" lives on Updates.
const statusLine = (s: WedState): string | null => {
  for (let i = s.tasks.length - 1; i >= 0; i--) {
    const task = s.tasks[i];
    if (task.state === 'running') return `Working · ${task.now + 1} of ${task.steps.length}`;
  }
  for (let i = s.tasks.length - 1; i >= 0; i--) {
    if (s.tasks[i].state === 'waiting') return s.tasks[i].short;
  }
  return null;
};

/**
 * The top of the chat, like ChatGPT's: the menu button and "Wed", with a
 * short status line under it only while Wed works or waits on a vendor
 * ("Working · 2 of 4"), which opens Updates. `quiet` hides the line while
 * the progress chip under the header already says it. On the right, only
 * while cards wait for a yes, a maroon "2 need your OK" that opens Updates
 * too (a grey "1 waiting" for family who can't say yes); otherwise an
 * empty slot keeps the title in the middle. Sits over the thread on the
 * page colour, which fades out below it (canvasEdge). `onHeight` gets its
 * full height, the fade included.
 */
export function WedHeader({
  onMenu,
  onHeight,
  quiet = false,
}: {
  onMenu: () => void;
  onHeight: (height: number) => void;
  quiet?: boolean;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const line = useWed(statusLine);
  const waiting = useWed(waitingCount);
  const canApprove = useWed((s) => s.role === 'owner');
  const openUpdates = () => router.push('/wed/updates');
  // Only someone who can say yes is asked for their OK
  const okWords = canApprove
    ? `${waiting} ${waiting === 1 ? 'needs' : 'need'} your OK`
    : `${waiting} waiting`;
  const okLabel = canApprove ? okWords : `${waiting} waiting for ${FAMILY.owner}'s OK`;

  return (
    <View
      style={styles.header}
      onLayout={(event: LayoutChangeEvent) => onHeight(event.nativeEvent.layout.height)}
    >
      <View style={[styles.solid, { paddingTop: Math.max(insets.top, Spacing.sm) }]}>
        <View style={styles.row}>
          <View style={styles.title}>
            <AppText variant="heading" accessibilityRole="header" maxFontSizeMultiplier={1.3}>
              Wed
            </AppText>
          </View>
          <GlassButton
            icon="menu-outline"
            accessibilityLabel="Wed menu"
            color={Colors.text}
            onPress={onMenu}
          />
          {waiting > 0 ? (
            <Animated.View entering={Motion.popIn} exiting={Motion.popOut}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={okLabel}
                accessibilityHint="Opens Updates"
                onPress={openUpdates}
                hitSlop={4}
                style={({ pressed }) => [
                  styles.ok,
                  !canApprove && styles.okNeutral,
                  pressed && (canApprove ? styles.okPressed : styles.okNeutralPressed),
                ]}
              >
                <AppText
                  variant="label"
                  weight={600}
                  color={canApprove ? 'onPrimary' : 'text'}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1}
                  style={styles.okWords}
                >
                  {okWords}
                </AppText>
              </Pressable>
            </Animated.View>
          ) : (
            <View style={styles.spacer} />
          )}
        </View>
        {line ? (
          // Keeps its room while the chip shows, so the thread doesn't jump
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={line}
            accessibilityHint="Opens Updates"
            accessibilityElementsHidden={quiet}
            importantForAccessibility={quiet ? 'no-hide-descendants' : 'auto'}
            disabled={quiet}
            onPress={openUpdates}
            hitSlop={{ top: 4, bottom: 12, left: 8, right: 8 }}
            style={({ pressed }) => [
              styles.status,
              quiet && styles.hidden,
              pressed && styles.pressed,
            ]}
          >
            <AppText
              color="text2"
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
              style={styles.center}
            >
              {line}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.fade, edgeStyle(Colors.canvasEdge)]} />
    </View>
  );
}

/** A CSS gradient as a view's background, on the web and on phones (the header's and composer's edges). */
export const edgeStyle = (gradient: string) =>
  (Platform.OS === 'web'
    ? { backgroundImage: gradient }
    : { experimental_backgroundImage: gradient }) as ViewStyle;

const useStyles = makeStyles((Colors) => ({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: 'box-none',
  },
  // Solid behind the words, so the thread never shows through them
  solid: {
    paddingHorizontal: Sizes.pageGutter,
    paddingBottom: Spacing.xs,
    backgroundColor: Colors.canvas,
  },
  fade: {
    height: HEADER_FADE,
    pointerEvents: 'none',
  },
  row: {
    height: Sizes.tapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Centred on the whole width, whatever sits on either side
  title: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  spacer: {
    width: Sizes.tapTarget,
    height: Sizes.tapTarget,
  },
  ok: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.chip,
    backgroundColor: Colors.primaryFill,
  },
  // Kept at 15 points, like the tab bar's labels, so it never runs into the
  // title at the biggest text sizes
  okWords: {
    fontSize: Typography.label.size,
    lineHeight: 20,
  },
  okPressed: {
    backgroundColor: Colors.primaryFillPressed,
  },
  // For family who can only suggest or view: no maroon, nothing for them to OK
  okNeutral: {
    backgroundColor: Colors.fill,
  },
  okNeutralPressed: {
    backgroundColor: Colors.fillPressed,
  },
  // With its hitSlop, a 48-point target
  status: {
    alignSelf: 'center',
    maxWidth: '100%',
    minHeight: 32,
    justifyContent: 'center',
    marginTop: -TUCK,
    paddingHorizontal: Spacing.sm,
  },
  hidden: {
    opacity: 0,
  },
  center: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.55,
  },
}));
