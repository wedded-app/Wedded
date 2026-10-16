import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { AppText, useFontScale } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { Motion } from '@/lib/motion';

import { SOURCE_ICONS, type Source } from '../wed-store';

// How long each source stays before the next one: long enough to read
const EVERY_MS = 2500;
const SLOT = 40;

/**
 * What Wed is looking at right now, under the working line: "Looking at"
 * over one source ("instagram.com/gabru.dhol", "Dhol Di Awaaz · Yuba City"),
 * changing to the next every 2.5 seconds with a quick fade. With Reduce
 * Motion it holds still on a summary ("… and 3 more"). A vendor on Wedded
 * shows its photo; a web page, a map, a calendar or a chat shows its glyph
 * in a grey circle. Never Instagram's own pictures: Wed shows the search
 * result, not the page. Screen readers aren't told of every change (the
 * working line says what Wed is doing). Give it a `key` per step so it
 * starts over.
 */
export function SourceCard({ sources }: { sources: Source[] }) {
  const Colors = useColors();
  const styles = useStyles();
  const scale = Math.min(useFontScale('body'), 1.4);
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const still = reduceMotion || sources.length < 2;

  useEffect(() => {
    if (still) return;
    const timer = setInterval(() => setIndex((n) => (n + 1) % sources.length), EVERY_MS);
    return () => clearInterval(timer);
  }, [still, sources.length]);

  const source = sources[still ? 0 : index % Math.max(sources.length, 1)];
  if (!source) return null;
  const detail =
    reduceMotion && sources.length > 1
      ? `${source.detail} and ${sources.length - 1} more`
      : source.detail;

  return (
    <View style={styles.card} accessible accessibilityLabel={`Looking at ${detail}`}>
      <Animated.View key={`${index}-${source.detail}`} entering={Motion.enter} style={styles.inner}>
        <View style={styles.slot}>
          {source.kind === 'wedded' && source.photo ? (
            <Image
              source={{ uri: source.photo }}
              contentFit="cover"
              style={styles.photo}
              accessible={false}
            />
          ) : (
            <View style={styles.circle}>
              <Icon
                name={SOURCE_ICONS[source.kind]}
                size={Math.round(20 * scale)}
                color={Colors.text2}
              />
            </View>
          )}
        </View>
        <View style={styles.words}>
          <AppText variant="label" weight={400} color="text2" numberOfLines={1}>
            Looking at
          </AppText>
          <AppText numberOfLines={2}>{detail}</AppText>
        </View>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.field,
    borderCurve: 'continuous',
    backgroundColor: Colors.canvasCard,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  slot: {
    width: SLOT,
    height: SLOT,
  },
  photo: {
    width: SLOT,
    height: SLOT,
    borderRadius: Radius.thumb,
    backgroundColor: Colors.skeleton,
  },
  circle: {
    width: SLOT,
    height: SLOT,
    borderRadius: SLOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.fill,
  },
  words: {
    flex: 1,
  },
}));
