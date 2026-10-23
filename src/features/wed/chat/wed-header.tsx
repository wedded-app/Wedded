import { router } from 'expo-router';
import { Platform, Pressable, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, useFontScale } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { OmbreBackground } from '@/components/ombre-background';
import {
  makeStyles,
  Palettes,
  Radius,
  Sizes,
  Spacing,
  Typography,
  useColors,
} from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { Motion } from '@/lib/motion';

import { FAMILY } from '../mock';
import { useWed, waitingCount, type WedState } from '../wed-store';
import { WedMark } from '../wed-mark';

// The status line, only while Wed is busy: which step of the running task
// (the thread's working line already says what), or what it waits for
// ("Waiting for 3 dhol players to reply"). Nothing when idle: the chips say
// when cards wait, and "All caught up" lives on Updates. (useWed compares
// shallowly, so an unchanged status doesn't draw the band again.)
type Status = { step: number; steps: number } | { words: string } | null;
const statusLine = (s: WedState): Status => {
  for (let i = s.tasks.length - 1; i >= 0; i--) {
    const task = s.tasks[i];
    if (task.state === 'running') return { step: task.now + 1, steps: task.steps.length };
  }
  for (let i = s.tasks.length - 1; i >= 0; i--) {
    if (s.tasks[i].state === 'waiting') return { words: s.tasks[i].short };
  }
  return null;
};

/**
 * The top of Wed's sheet: a band of the slowly moving maroon ombre
 * (OmbreBackground) with, in white, Wed's menu on the left, the bow and
 * "Wed" in the middle, and the chevron that closes the sheet on the right.
 * Under them, how much Wed does on its own (Ask me first, or Do the small
 * things), which opens Wed's settings, and while cards wait for a yes a
 * white "2 need your OK" (a quieter "1 waiting" for family who can't say
 * yes) that opens Updates. While Wed works or waits on a vendor, a short
 * line under the chips says how far along it is ("Working · 2 of 4") and
 * opens Updates too; `quiet` hides it while the progress chip under the
 * band already says it. Sits over the top of the thread; `onHeight` gets
 * its full height.
 */
export function WedHeader({
  onMenu,
  onClose,
  onHeight,
  quiet = false,
}: {
  onMenu: () => void;
  onClose: () => void;
  onHeight: (height: number) => void;
  quiet?: boolean;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const line = useWed(statusLine);
  const waiting = useWed(waitingCount);
  const mode = useWed((s) => s.mode);
  const canApprove = useWed((s) => s.role === 'owner');
  const openUpdates = () => router.push('/wed/updates');
  const modeWords = t(mode === 'ask' ? 'wedSheet.modes.ask' : 'wedSheet.modes.small');
  // Only someone who can say yes is asked for their OK
  const okWords = canApprove
    ? t('wedSheet.needOk', { count: waiting })
    : t('wedSheet.waiting', { count: waiting });
  const okLabel = canApprove
    ? okWords
    : t('wedSheet.waitingLabel', { count: waiting, owner: FAMILY.owner });
  const lineWords = !line
    ? null
    : 'words' in line
      ? line.words
      : t('wedSheet.working', { step: line.step, steps: line.steps });

  return (
    <View
      style={styles.band}
      onLayout={(event: LayoutChangeEvent) => onHeight(event.nativeEvent.layout.height)}
    >
      <OmbreBackground />
      <View style={[styles.inner, { paddingTop: Math.max(insets.top, Spacing.md) }]}>
        <View style={styles.row}>
          <View style={styles.title}>
            <WedMark size={30} color="onHero" />
            <AppText
              variant="heading"
              color="onHero"
              accessibilityRole="header"
              maxFontSizeMultiplier={1.3}
            >
              {t('wedSheet.title')}
            </AppText>
          </View>
          <RoundButton icon="menu-outline" label={t('wedSheet.menu')} onPress={onMenu} />
          <RoundButton icon="chevron-down" label={t('wedSheet.close')} onPress={onClose} />
        </View>
        <View style={styles.chips}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('wedSheet.modeLabel', { mode: modeWords })}
            accessibilityHint={t('wedSheet.modeHint')}
            onPress={() => router.push('/wed/settings')}
            hitSlop={4}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <AppText
              variant="label"
              weight={600}
              color="onHero"
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
              style={styles.chipWords}
            >
              {modeWords}
            </AppText>
            <Icon name="chevron-forward" size={14} color={Colors.onHero} weight="semibold" />
          </Pressable>
          {waiting > 0 ? (
            <Animated.View entering={Motion.popIn} exiting={Motion.popOut}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={okLabel}
                accessibilityHint={t('wedSheet.updatesHint')}
                onPress={openUpdates}
                hitSlop={4}
                style={({ pressed }) => [
                  styles.chip,
                  canApprove ? styles.ok : null,
                  pressed && (canApprove ? styles.okPressed : styles.chipPressed),
                ]}
              >
                <AppText
                  variant="label"
                  weight={600}
                  color="onHero"
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.3}
                  style={[styles.chipWords, canApprove && styles.okWords]}
                >
                  {okWords}
                </AppText>
              </Pressable>
            </Animated.View>
          ) : null}
        </View>
        {lineWords ? (
          // Keeps its room while the chip shows, so the thread doesn't jump
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={lineWords}
            accessibilityHint={t('wedSheet.updatesHint')}
            accessibilityElementsHidden={quiet}
            importantForAccessibility={quiet ? 'no-hide-descendants' : 'auto'}
            disabled={quiet}
            onPress={openUpdates}
            // With its hitSlop a 48-point target, reaching into the band's bottom edge
            hitSlop={{ top: 6, bottom: 14, left: 8, right: 8 }}
            style={({ pressed }) => [
              styles.status,
              quiet && styles.hidden,
              pressed && styles.pressed,
            ]}
          >
            <AppText
              variant="label"
              color="onHero2"
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
              style={styles.center}
            >
              {lineWords}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** A round see-through white button on the band, 48 across. */
function RoundButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const scale = Math.min(useFontScale('body'), 1.3);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.round, pressed && styles.roundPressed]}
    >
      <Icon name={icon} size={Math.round(22 * scale)} color={Colors.onHero} weight="semibold" />
    </Pressable>
  );
}

/** A CSS gradient as a view's background, on the web and on phones (the composer's edge). */
export const edgeStyle = (gradient: string) =>
  (Platform.OS === 'web'
    ? { backgroundImage: gradient }
    : { experimental_backgroundImage: gradient }) as ViewStyle;

const useStyles = makeStyles((Colors) => ({
  band: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    backgroundColor: Colors.ombreBase,
  },
  inner: {
    gap: Spacing.sm,
    paddingHorizontal: Sizes.pageGutter,
    paddingBottom: Spacing.lg,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    pointerEvents: 'none',
  },
  round: {
    width: Sizes.tapTarget,
    height: Sizes.tapTarget,
    borderRadius: Sizes.tapTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.onHeroFill,
  },
  roundPressed: {
    backgroundColor: Colors.onHeroFillPressed,
    transform: [{ scale: 0.94 }],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  // 40 high; with its hitSlop a 48-point target
  chip: {
    height: 40,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.chip,
    backgroundColor: Colors.onHeroFill,
  },
  chipPressed: {
    backgroundColor: Colors.onHeroFillPressed,
  },
  // Kept at 15 points, like the tab bar's labels, so two chips fit side by
  // side at the biggest text sizes
  chipWords: {
    flexShrink: 1,
    fontSize: Typography.label.size,
    lineHeight: 20,
  },
  // The one thing to act on: white, with the maroon words
  ok: {
    backgroundColor: Colors.onHero,
  },
  okPressed: {
    backgroundColor: Colors.onHero2,
  },
  // Maroon in both schemes (dark mode's rose is too light on white): 9.2:1
  okWords: {
    color: Palettes.light.primary,
  },
  status: {
    alignSelf: 'center',
    maxWidth: '100%',
    minHeight: 28,
    justifyContent: 'center',
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
