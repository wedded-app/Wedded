import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PetalBurst } from '@/components/petal-burst';
import { makeStyles, Spacing, Springs, useColors } from '@/constants/theme';

import { FamilyAvatar } from './request-parts';

/** One gold ring that grows out from the middle and fades, again and again. */
function Ring({ delay, pulse }: { delay: number; pulse: SharedValue<number> }) {
  const styles = useStyles();
  const ring = useAnimatedStyle(() => {
    const p = (pulse.value + delay) % 1;
    return { opacity: 0.7 * (1 - p), transform: [{ scale: 0.7 + p * 1.6 }] };
  });
  return <Animated.View style={[styles.ring, ring]} />;
}

/**
 * After asking vendors: gold rings pulse out from a glowing paper plane, like
 * a message going out over town, with "Sent!" in the serif and who will see
 * it. It covers the screen for a moment, then the caller moves on. With
 * Reduce Motion the rings stand still.
 */
export function SentMoment({ title, body }: { title: string; body: string }) {
  const Colors = useColors();
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1));
  }, [pulse, reduceMotion]);

  return (
    <Animated.View
      entering={FadeIn.duration(240)}
      style={styles.cover}
      accessibilityViewIsModal
      accessibilityLiveRegion="assertive"
      accessibilityLabel={`${title} ${body}`}
    >
      <View style={styles.center}>
        <Ring delay={0} pulse={pulse} />
        <Ring delay={0.33} pulse={pulse} />
        <Ring delay={0.66} pulse={pulse} />
        <View style={styles.core}>
          <Icon name="paper-plane-outline" size={40} color={Colors.onHero} weight="semibold" />
        </View>
      </View>
      <Animated.View entering={FadeInUp.delay(200).duration(420)} style={styles.words}>
        <AppText variant="display" weight={600} style={styles.text}>
          {title}
        </AppText>
        <AppText variant="bodyLg" color="text2" style={styles.text}>
          {body}
        </AppText>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Choosing a vendor: the family's letters and the vendor's face slide in from
 * either side and meet inside a gold ring, petals burst, and "You chose …"
 * in the serif. Then the caller opens the chat.
 */
export function MatchMoment({
  familyName,
  vendorName,
  vendorPhoto,
  title,
  body,
}: {
  familyName: string;
  vendorName: string;
  vendorPhoto: string | null;
  title: string;
  body: string;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const meet = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    meet.set(withDelay(150, withSpring(1, Springs.pop)));
  }, [meet, reduceMotion]);

  const left = useAnimatedStyle(() => ({
    transform: [{ translateX: -90 * (1 - meet.value) + 18 }, { rotate: `${-8 * meet.value}deg` }],
  }));
  const right = useAnimatedStyle(() => ({
    transform: [{ translateX: 90 * (1 - meet.value) - 18 }, { rotate: `${8 * meet.value}deg` }],
  }));
  const ring = useAnimatedStyle(() => ({
    opacity: meet.value,
    transform: [{ scale: 0.8 + 0.2 * meet.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(240)}
      style={styles.cover}
      accessibilityViewIsModal
      accessibilityLiveRegion="assertive"
      accessibilityLabel={`${title} ${body}`}
    >
      <View style={styles.center}>
        <Animated.View style={[styles.matchRing, ring]} />
        <View style={styles.pair}>
          <Animated.View style={[styles.face, left]}>
            <FamilyAvatar name={familyName} size={104} />
          </Animated.View>
          <Animated.View style={[styles.face, right]}>
            {vendorPhoto ? (
              <Image source={{ uri: vendorPhoto }} style={styles.vendorPhoto} contentFit="cover" />
            ) : (
              <View style={[styles.vendorPhoto, styles.vendorEmpty]}>
                <AppText weight={600} style={styles.initial} maxFontSizeMultiplier={1}>
                  {vendorName.trim()[0]?.toUpperCase() ?? ''}
                </AppText>
              </View>
            )}
          </Animated.View>
        </View>
        <View style={styles.heart}>
          <Icon name="heart" size={22} color={Colors.onHero} />
        </View>
      </View>
      <Animated.View entering={FadeInUp.delay(350).duration(420)} style={styles.words}>
        <AppText variant="display" weight={600} style={styles.text}>
          {title}
        </AppText>
        <AppText variant="bodyLg" color="text2" style={styles.text}>
          {body}
        </AppText>
      </Animated.View>
      <PetalBurst play={1} origin={0.38} />
    </Animated.View>
  );
}

const useStyles = makeStyles((Colors) => ({
  cover: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    backgroundColor: 'rgba(18, 6, 10, 0.94)',
  },
  center: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: Colors.champagne,
  },
  core: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryFill,
    boxShadow: Colors.roseGlow,
  },
  words: {
    gap: Spacing.sm,
    maxWidth: 420,
  },
  text: {
    textAlign: 'center',
  },
  matchRing: {
    position: 'absolute',
    width: 236,
    height: 236,
    borderRadius: 118,
    borderWidth: 2,
    borderColor: Colors.champagne,
    boxShadow: '0px 0px 40px rgba(233, 201, 139, 0.35)',
  },
  pair: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  face: {
    borderRadius: 60,
    borderWidth: 4,
    borderColor: Colors.night,
  },
  vendorPhoto: {
    width: 104,
    height: 104,
    borderRadius: 52,
  },
  vendorEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.heroTo,
  },
  initial: {
    fontSize: 48,
    lineHeight: 56,
    color: Colors.onHero,
  },
  heart: {
    position: 'absolute',
    bottom: 22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryFill,
    borderWidth: 3,
    borderColor: Colors.night,
    boxShadow: Colors.roseGlow,
  },
}));
