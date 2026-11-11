import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Sizes, Spacing, Timing, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

import { LIVE_COUNTERS, type Menu } from './ask-draft';

// Free Pexels photos shipped with the app (assets/images/food/README.md)
const MENU_PHOTOS: Record<Menu, number> = {
  veg: require('../../../assets/images/food/thali.jpg'),
  nonveg: require('../../../assets/images/food/tikka.jpg'),
};
const COUNTER_PHOTOS: Partial<Record<string, number>> = {
  tandoor: require('../../../assets/images/food/tikka.jpg'),
  chaat: require('../../../assets/images/food/chaat.jpg'),
  jalebi: require('../../../assets/images/food/jalebi.jpg'),
  dosa: require('../../../assets/images/food/dosa.jpg'),
};

/** A new part of the page arriving: a quick fade, nothing with Reduce Motion. */
export function useArrive() {
  const reduceMotion = useReducedMotion();
  return reduceMotion ? undefined : FadeIn.duration(Timing.quick);
}

/** One question on a page: its words, a short line of what this vendor said, then the answers. */
export function Question({
  title,
  note,
  children,
}: {
  title: string;
  note?: string | null;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.question}>
      <View style={styles.words}>
        <AppText variant="heading" accessibilityRole="header">
          {title}
        </AppText>
        {note && <AppText color="text2">{note}</AppText>}
      </View>
      {children}
    </View>
  );
}

export type Tile<T extends string> = {
  value: T;
  label: string;
  sub: string;
  icon: IconName;
  /** Shown dashed and grey: this vendor doesn't offer it. */
  off?: boolean;
};

/**
 * Three big tiles in a row, an icon over a word and a few small words (Day
 * or evening, Who's bringing the food). The picked one turns ink. One this
 * vendor doesn't offer is dashed and grey, and says why when it's tapped.
 */
export function ChoiceTiles<T extends string>({
  label,
  tiles,
  value,
  onChange,
  onOff,
}: {
  label: string;
  tiles: Tile<T>[];
  value: T | null;
  onChange: (value: T) => void;
  onOff?: (value: T) => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.tiles} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {tiles.map((tile) => {
        const on = !tile.off && value === tile.value;
        const tint = tile.off ? Colors.textDisabled : on ? Colors.onPrimary : Colors.text;
        return (
          <PressableScale
            key={tile.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: tile.off }}
            accessibilityLabel={`${tile.label}, ${tile.sub}`}
            onPress={() => {
              selectionHaptic();
              if (tile.off) onOff?.(tile.value);
              else onChange(tile.value);
            }}
            style={[styles.tile, on && styles.tileOn, tile.off && styles.tileOff]}
          >
            <Icon name={tile.icon} size={24} color={tint} />
            <AppText
              variant="label"
              weight={700}
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ color: tint }}
            >
              {tile.label}
            </AppText>
            <AppText
              variant="caption"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{
                color: tile.off ? Colors.textDisabled : on ? Colors.onPrimary : Colors.text2,
              }}
            >
              {tile.sub}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** A row of round-ended answers sharing the width (Yes, No alcohol, Not decided). */
export function ChoicePills<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.pills} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const on = value === option.value;
        return (
          <PressableScale
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => {
              selectionHaptic();
              onChange(option.value);
            }}
            style={[styles.pill, on && styles.pillOn]}
          >
            <AppText
              variant="label"
              weight={600}
              numberOfLines={1}
              adjustsFontSizeToFit
              color={on ? 'onPrimary' : 'text'}
            >
              {option.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** One quiet line under a choice: a green tick and what will be said, or a maroon reason. */
export function NoteLine({ text, warn = false }: { text: string; warn?: boolean }) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <Animated.View entering={useArrive()} style={styles.note} accessibilityLiveRegion="polite">
      {!warn && <Icon name="checkmark" size={16} color={Colors.success} weight="bold" />}
      <AppText color={warn ? 'primary' : 'text'} style={styles.grow}>
        {text}
      </AppText>
    </Animated.View>
  );
}

/** A soft dark fade at the bottom of a photo, so white words on it can be read. */
function PhotoShade({ id }: { id: string }) {
  const Colors = useColors();
  return (
    <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 10 10">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.35" stopColor={Colors.viewer} stopOpacity={0} />
          <Stop offset="1" stopColor={Colors.viewer} stopOpacity={0.7} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="10" height="10" fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * "What's on the menu?": a photo card for each, to swipe between and tap.
 * The picked one has a ring and a tick.
 */
export function MenuCards({
  value,
  onChange,
}: {
  value: Menu | null;
  onChange: (menu: Menu) => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={CARD_W + Spacing.md}
      decelerationRate="fast"
      contentContainerStyle={styles.cards}
      style={styles.bleed}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('ask.details.menu')}
    >
      {(['veg', 'nonveg'] as Menu[]).map((menu) => {
        const on = value === menu;
        return (
          <PressableScale
            key={menu}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${t(`ask.details.menus.${menu}`)}, ${t(`ask.details.menusSub.${menu}`)}`}
            pressedScale={0.98}
            onPress={() => {
              selectionHaptic();
              onChange(menu);
            }}
            style={[styles.card, on && { borderColor: Colors.text }]}
          >
            <Image source={MENU_PHOTOS[menu]} style={styles.cardPhoto} contentFit="cover" />
            <PhotoShade id={`menu-${menu}`} />
            <View style={styles.cardWords}>
              <AppText variant="title" weight={700} style={styles.onPhoto}>
                {t(`ask.details.menus.${menu}`)}
              </AppText>
              <AppText variant="label" style={styles.onPhoto}>
                {t(`ask.details.menusSub.${menu}`)}
              </AppText>
            </View>
            {on && (
              <View style={styles.tick}>
                <Icon name="checkmark" size={16} color={Colors.viewer} weight="bold" />
              </View>
            )}
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

/** "Any live counters?": tiles to tick, a photo where we have one, three across. */
export function CounterTiles({
  value,
  onChange,
}: {
  value: string[];
  onChange: (counters: string[]) => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <View style={styles.counters} accessibilityLabel={t('ask.details.counters')}>
      {LIVE_COUNTERS.map((counter) => {
        const on = value.includes(counter);
        const photo = COUNTER_PHOTOS[counter];
        return (
          <Pressable
            key={counter}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={t(`inquiry.questions.stations.${counter}`)}
            onPress={() => {
              selectionHaptic();
              onChange(on ? value.filter((c) => c !== counter) : [...value, counter]);
            }}
            style={({ pressed }) => [
              styles.counter,
              !photo && styles.counterPlain,
              on && styles.counterOn,
              pressed && styles.pressed,
            ]}
          >
            {photo && (
              <>
                <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" />
                <PhotoShade id={`counter-${counter}`} />
              </>
            )}
            <AppText
              variant="label"
              weight={700}
              style={[styles.counterName, photo ? styles.onPhoto : null]}
            >
              {t(`inquiry.questions.stations.${counter}`)}
            </AppText>
            {on && (
              <View style={styles.counterTick}>
                <Icon name="checkmark" size={12} color={Colors.onPrimary} weight="bold" />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const CARD_W = 270;

const useStyles = makeStyles((Colors) => ({
  grow: {
    flex: 1,
  },
  question: {
    gap: Spacing.md,
  },
  words: {
    gap: Spacing.xs,
  },
  tiles: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  tile: {
    flex: 1,
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.canvas,
  },
  tileOn: {
    borderColor: Colors.primaryFill,
    backgroundColor: Colors.primaryFill,
  },
  tileOff: {
    borderStyle: 'dashed',
    borderColor: Colors.separator,
    backgroundColor: Colors.surface,
  },
  pills: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  pill: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.button,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.canvas,
  },
  pillOn: {
    borderColor: Colors.primaryFill,
    backgroundColor: Colors.primaryFill,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bleed: {
    marginHorizontal: -Sizes.pageGutter,
  },
  cards: {
    gap: Spacing.md,
    paddingHorizontal: Sizes.pageGutter,
    paddingVertical: Spacing.xs,
  },
  card: {
    width: CARD_W,
    height: 200,
    overflow: 'hidden',
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  cardPhoto: {
    ...StyleSheet.absoluteFill,
  },
  cardWords: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.md,
    gap: 2,
  },
  onPhoto: {
    color: Colors.onPhoto,
  },
  tick: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.onPhoto,
  },
  counters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  counter: {
    width: '31.5%',
    flexGrow: 1,
    height: 88,
    overflow: 'hidden',
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  counterPlain: {
    backgroundColor: Colors.sand,
  },
  counterOn: {
    borderColor: Colors.text,
  },
  pressed: {
    opacity: 0.8,
  },
  counterName: {
    position: 'absolute',
    left: Spacing.sm,
    bottom: Spacing.sm,
  },
  counterTick: {
    position: 'absolute',
    top: Spacing.xs + 2,
    right: Spacing.xs + 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryFill,
  },
}));
