import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText, useFontScale } from '@/components/app-text';
import { Card } from '@/components/card';
import { Glass } from '@/components/glass';
import { Icon } from '@/components/icon';
import { makeStyles, Radius, Sizes, Spacing, Springs, useColors } from '@/constants/theme';
import { localized, type LocalizedText } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { saveHaptic } from '@/lib/haptics';

export type PriceUnit = 'event' | 'hour' | 'person' | 'plate' | 'hand' | 'turban' | 'day';

export type VendorCardProps = {
  /** The business name; `pa` is shown in Punjabi mode when the vendor has one. */
  name: LocalizedText;
  /** The vendor's main category, from the database. */
  category: LocalizedText;
  /** Where they're based, e.g. "Tracy, CA". Never a street address. */
  city: string;
  /** Distance from the user; leave out when no location is set. */
  distanceMiles?: number | null;
  /** Their lowest advertised price in whole US dollars, and what it's for. */
  startingPrice?: { amount: number; unit?: PriceUnit } | null;
  /** Cover photo; cropped to 3:2. */
  photoUrl?: string | null;
  /** Shows the "Founding vendor" badge. */
  foundingNumber?: number | null;
  /** Shows "Travels to you": based outside your distance, but they cover your area. */
  travelsToYou?: boolean;
  /** Filled heart when true. */
  saved?: boolean;
  /** Shows the heart; the caller saves or removes (useSaveVendor().toggleSave). */
  onToggleSave?: () => void;
  /** Opens the profile. Without it the card is display-only. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

// Prices keep Latin digits in both languages (vision doc section 4).
const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

type Translate = (key: string, options?: Record<string, string | number>) => string;
type Words = { shown: string; spoken: string };

/** "12 mi" (and "12 miles" for screen readers), or "Under 1 mi". */
export function distanceWords(miles: number | null | undefined, t: Translate): Words | undefined {
  if (miles == null) return undefined;
  return miles < 1
    ? { shown: t('vendorCard.underOneMile'), spoken: t('vendorCard.underOneMileSpoken') }
    : {
        shown: t('vendorCard.miles', { count: Math.round(miles) }),
        spoken: t('vendorCard.milesSpoken', { count: Math.round(miles) }),
      };
}

/** "From $450 / event", or "From $450" without a unit. */
export function priceWords(
  startingPrice: { amount: number; unit?: PriceUnit } | null | undefined,
  t: Translate,
): Words | undefined {
  if (!startingPrice) return undefined;
  const amount = usd.format(startingPrice.amount);
  if (!startingPrice.unit) {
    const text = t('vendorCard.from', { price: amount });
    return { shown: text, spoken: text };
  }
  const unit = t(`vendorCard.units.${startingPrice.unit}`);
  return {
    shown: t('vendorCard.fromPer', { price: amount, unit }),
    spoken: t('vendorCard.fromPerSpoken', { price: amount, unit }),
  };
}

/**
 * A vendor in a list: 3:2 cover photo with a glass heart and glass badges on
 * it, then the name, "Dhol · Tracy, CA · 31 mi" and "From $450 / event". The
 * whole card opens the profile; there's deliberately no Call button on cards.
 */
export function VendorCard({
  name,
  category,
  city,
  distanceMiles,
  startingPrice,
  photoUrl,
  foundingNumber,
  travelsToYou = false,
  saved = false,
  onToggleSave,
  onPress,
  style,
}: VendorCardProps) {
  const Colors = useColors();
  const styles = useStyles();
  const { locale, t } = useLocale();
  const scale = Math.min(useFontScale('label'), 1.4);

  const distance = distanceWords(distanceMiles, t);
  const price = priceWords(startingPrice, t);

  const vendorName = localized(name, locale);
  const categoryName = localized(category, locale);
  // Non-breaking spaces keep "31 mi" together when the line wraps.
  const details = [categoryName, city, distance?.shown.replace(/ /g, ' ')]
    .filter(Boolean)
    .join(' · ');
  const saveLabel = saved
    ? t('vendorCard.unsave', { name: vendorName })
    : t('vendorCard.save', { name: vendorName });
  const badges: { key: string; label: string; icon: 'ribbon-outline' | 'car-outline' }[] = [];
  if (foundingNumber != null) {
    badges.push({ key: 'founding', label: t('vendorCard.founding'), icon: 'ribbon-outline' });
  }
  if (travelsToYou) {
    badges.push({ key: 'travels', label: t('vendorCard.travelsToYou'), icon: 'car-outline' });
  }
  const spoken = [
    vendorName,
    categoryName,
    city,
    distance?.spoken,
    ...badges.map((badge) => badge.label),
    price?.spoken,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Card
      onPress={onPress}
      accessible
      accessibilityLabel={spoken}
      // The heart sits inside the card, which screen readers treat as one
      // element, so saving is also offered as an action on the card.
      accessibilityActions={onToggleSave ? [{ name: 'toggleSave', label: saveLabel }] : undefined}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'toggleSave') onToggleSave?.();
      }}
      overlay={
        onToggleSave ? (
          <SaveHeart saved={saved} label={saveLabel} onPress={onToggleSave} />
        ) : undefined
      }
      style={[styles.card, style]}
    >
      <View>
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            contentFit="cover"
            transition={200}
            accessible={false}
            style={styles.photo}
          />
        ) : (
          <View style={[styles.photo, styles.noPhoto]}>
            <Icon name="image-outline" size={Sizes.iconLarge} color={Colors.textDisabled} />
          </View>
        )}
        {badges.length > 0 && (
          <View style={styles.badges}>
            {badges.map((badge) => (
              <Glass key={badge.key} style={styles.badge}>
                <Icon
                  name={badge.icon}
                  size={16 * scale}
                  color={badge.key === 'founding' ? Colors.kesari : Colors.text}
                />
                <AppText
                  variant="caption"
                  weight={600}
                  color={badge.key === 'founding' ? 'kesari' : 'text'}
                >
                  {badge.label}
                </AppText>
              </Glass>
            ))}
          </View>
        )}
      </View>
      <View style={styles.body}>
        <AppText variant="bodyLg" weight={600}>
          {vendorName}
        </AppText>
        <AppText variant="label" weight={400} color="text2">
          {details}
        </AppText>
        {price && (
          <AppText weight={600} style={styles.price}>
            {price.shown}
          </AppText>
        )}
      </View>
    </Card>
  );
}

/**
 * The glass heart on a cover photo. Saving pops it once (vision §4) with a
 * light tap you can feel; removing just changes the icon.
 */
function SaveHeart({
  saved,
  label,
  onPress,
}: {
  saved: boolean;
  label: string;
  onPress: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(1);
  const wasSaved = useRef(saved);

  useEffect(() => {
    if (saved && !wasSaved.current && !reduceMotion) {
      pop.value = withSequence(withTiming(1.25, { duration: 110 }), withSpring(1, Springs.pop));
    }
    wasSaved.current = saved;
  }, [saved, reduceMotion, pop]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        if (!saved) saveHaptic();
        onPress();
      }}
      hitSlop={4}
      style={styles.heartWrap}
    >
      <Glass interactive style={styles.heart}>
        <Animated.View style={popStyle}>
          <Icon
            name={saved ? 'heart' : 'heart-outline'}
            size={Sizes.iconSmall + 2}
            color={Colors.primary}
            weight="semibold"
          />
        </Animated.View>
      </Glass>
    </Pressable>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    padding: 0,
  },
  photo: {
    width: '100%',
    aspectRatio: 3 / 2,
    backgroundColor: Colors.skeleton,
  },
  noPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartWrap: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
  },
  heart: {
    width: Sizes.glassButton,
    height: Sizes.glassButton,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.circle,
  },
  badges: {
    pointerEvents: 'none',
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    bottom: Spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md - 2,
    paddingVertical: Spacing.xs + 1,
    borderRadius: Radius.chip,
  },
  body: {
    gap: 3,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  price: {
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
}));
