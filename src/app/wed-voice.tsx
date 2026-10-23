import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { AppText, useTypeStyle } from '@/components/app-text';
import { GlassButton } from '@/components/glass-button';
import { Icon, type IconName } from '@/components/icon';
import { Screen } from '@/components/screen';
import { type ColorToken, makeStyles, Spacing, Typography, useColors } from '@/constants/theme';
import { openWed, WED_HREF } from '@/features/wed/open-wed';
import { VoiceBars } from '@/features/wed/voice-bars';
import { wed } from '@/features/wed/wed-store';
import { WedMark } from '@/features/wed/wed-mark';
import { selectionHaptic } from '@/lib/haptics';

// Speech to text needs a development build, so for now what Wed "hears" is
// scripted, one word at a time
const SAID = 'Find a dhol player for the Jaago';
const FIRST_WORD_MS = 900;
const WORD_MS = 280;
const BARS = 44;
const ROUND = 64;

/**
 * MOCKUP: talking to Wed, full screen (a long press on Wed's bow). Wed
 * listens, the words appear big as they're heard (the newest one lighter
 * until the next arrives), and Done sends them to the chat, which takes this
 * screen's place (openWed), where Wed gets to work. Mute stops it listening
 * without leaving. Close leaves without sending anything.
 */
export default function WedVoiceScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const [heard, setHeard] = useState(0);
  const [muted, setMuted] = useState(false);
  const words = SAID.split(' ');
  const finished = heard >= words.length;

  // The next word arrives while Wed is listening
  useEffect(() => {
    if (muted || heard >= words.length) return;
    const timer = setTimeout(() => setHeard((n) => n + 1), heard === 0 ? FIRST_WORD_MS : WORD_MS);
    return () => clearTimeout(timer);
  }, [heard, muted, words.length]);

  // Two lines of captions are kept free, so the words never push the page about
  const { lineHeight } = useTypeStyle({ variant: 'title' });
  const { fontScale } = useWindowDimensions();
  const captionHeight = lineHeight * 2 * Math.min(fontScale, Typography.title.maxScale);

  const close = () => (router.canGoBack() ? router.back() : router.replace(WED_HREF));

  // Done sends the whole sentence once Wed has started hearing it (the last
  // words are still on their way), then opens the chat where it plays
  function end() {
    if (heard === 0) {
      close();
      return;
    }
    wed.send(SAID, { spoken: true });
    openWed();
  }

  const shown = words.slice(0, heard);
  const settled = finished ? shown : shown.slice(0, -1);
  const newest = finished ? undefined : shown.at(-1);

  return (
    <Screen plain edges={['top', 'bottom']}>
      <View style={styles.top}>
        <GlassButton icon="close" color={Colors.text} accessibilityLabel="Close" onPress={close} />
      </View>

      <View style={styles.middle}>
        <WedMark size={64} />
        <AppText variant="heading" color="text2" style={styles.center}>
          {muted ? "You're muted" : 'Wed is listening…'}
        </AppText>
        <View style={[styles.captions, { minHeight: captionHeight }]}>
          <AppText
            variant="title"
            weight={600}

            style={styles.center}
            accessibilityLiveRegion="polite"
          >
            {settled.join(' ')}
            {newest ? (
              <AppText variant="title" weight={600} color="text2">
                {settled.length > 0 ? ` ${newest}` : newest}
              </AppText>
            ) : null}
          </AppText>
        </View>
        {muted ? <QuietBars /> : <VoiceBars height={BARS} />}
      </View>

      <View style={styles.bottom}>
        <AppText color="text2" style={styles.center}>
          Wed keeps working while you talk
        </AppText>
        <View style={styles.actions}>
          <RoundAction
            icon="mic-off-outline"
            label={muted ? 'Unmute' : 'Mute'}
            fill={muted ? 'text' : 'fill'}
            tint={muted ? 'canvas' : 'text'}
            selected={muted}
            onPress={() => {
              selectionHaptic();
              setMuted((on) => !on);
            }}
          />
          {/* Done sends, so it says so: a red hang-up would read as cancel */}
          <RoundAction
            icon="checkmark"
            label="Done"
            a11y="Done, send what you said"
            fill="primaryFill"
            tint="onPrimary"
            onPress={end}
          />
        </View>
      </View>
    </Screen>
  );
}

/** A 64 circle with its word under it, like the iPhone's call buttons. */
function RoundAction({
  icon,
  label,
  a11y,
  fill,
  tint,
  selected,
  onPress,
}: {
  icon: IconName;
  label: string;
  a11y?: string;
  fill: ColorToken;
  tint: ColorToken;
  selected?: boolean;
  onPress: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      style={styles.action}
    >
      {({ pressed }) => (
        <>
          <View
            style={[styles.round, { backgroundColor: Colors[fill] }, pressed && styles.pressed]}
          >
            <Icon name={icon} size={28} color={Colors[tint]} />
          </View>
          <AppText variant="label">{label}</AppText>
        </>
      )}
    </Pressable>
  );
}

/** The bars lying flat while muted: nothing is being heard. */
function QuietBars() {
  const Colors = useColors();
  const dot = Math.max(3, Math.round(BARS / 7));
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: dot, height: BARS }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {Array.from({ length: 7 }, (_, index) => (
        <View
          key={index}
          style={{
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: Colors.textDisabled,
          }}
        />
      ))}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
  },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  captions: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
  bottom: {
    gap: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xxxl,
  },
  action: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  round: {
    width: ROUND,
    height: ROUND,
    borderRadius: ROUND / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
}));
