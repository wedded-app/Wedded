import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/app-text';
import { SampleTag } from '@/components/sample-tag';
import { GlassButton } from '@/components/glass-button';
import { PressableScale } from '@/components/pressable-scale';
import { distanceWords, priceWords } from '@/components/vendor-card';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useSavedEventsFor, useSaveVendor } from '@/data/saved';
import { useVendorSearch, type VendorResult } from '@/data/search';
import { photoUrl } from '@/data/vendor-media';
import { useSearchLocation } from '@/features/location/search-location';
import { filtersForGuests } from '@/features/planner/find-for-plan';
import { NO_FILTERS } from '@/features/search/search-filters';
import { localized } from '@/i18n/localized';
import { StateView } from '@/components/state-view';
import { useLocale } from '@/i18n/locale-context';
import { saveHaptic } from '@/lib/haptics';

import { shortDate } from './book-first';
import { SectionHeader } from './section-header';

const SHOWN = 10;

const SHADE = 'linear-gradient(to bottom, rgba(0,0,0,0) 45%, rgba(0,0,0,0.78) 100%)';
const shade = (
  Platform.OS === 'web' ? { backgroundImage: SHADE } : { experimental_backgroundImage: SHADE }
) as ViewStyle;

type Props = {
  /** Leave out for cards with no title row of their own. */
  title?: string;
  link?: string;
  onLink?: () => void;
  /** Only this kind of vendor; leave out for any kind ("Popular near you"). */
  categorySlug?: string;
  groupSlug?: string;
  /** Where a heart saves, and what the profile's Save and Ask start with. */
  eventSlug?: string;
  /** Leave out vendors booked all day on this yyyy-mm-dd date. */
  date?: string | null;
  guestBand?: string | null;
  /** Shown instead of nothing when no vendor fits. */
  emptyText?: string;
};

/**
 * Big photo cards you swipe through: the vendors that fit (near the search
 * location, free on the date, seating the guests), each with its name, how
 * far and from what price over the photo, and a heart. Vendors without
 * photos are left out here, since the photo is the point. Hidden when
 * nothing fits, so Home never shows an empty shelf.
 */
export function VendorPhotoCards({
  title,
  link,
  onLink,
  categorySlug,
  groupSlug,
  eventSlug,
  date,
  guestBand,
  emptyText,
}: Props) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const { place, maxMiles } = useSearchLocation();
  const search = useVendorSearch({
    latitude: place?.latitude,
    longitude: place?.longitude,
    maxMiles,
    categorySlug,
    filters: {
      ...NO_FILTERS,
      ...(groupSlug ? filtersForGuests(groupSlug, guestBand) : {}),
      availableOn: date ?? null,
    },
    limit: 30,
  });
  const vendors = (search.data ?? []).filter((vendor) => vendor.coverPath).slice(0, SHOWN);
  const cardWidth = Math.round(Math.min(300, width * 0.76));

  if (search.isError || (search.isSuccess && vendors.length === 0)) {
    return emptyText ? <StateView state="empty" message={emptyText} /> : null;
  }

  return (
    <View style={styles.block}>
      {title && <SectionHeader title={title} link={link} onLink={onLink} />}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + Spacing.md}
        decelerationRate="fast"
        style={styles.bleed}
        contentContainerStyle={styles.track}
      >
        {search.isPending
          ? [0, 1, 2].map((key) => (
              <View key={key} style={[styles.card, styles.skeleton, { width: cardWidth }]} />
            ))
          : vendors.map((vendor) => (
              <PhotoCard
                key={vendor.id}
                vendor={vendor}
                width={cardWidth}
                eventSlug={eventSlug}
                date={date}
              />
            ))}
      </ScrollView>
    </View>
  );
}

function PhotoCard({
  vendor,
  width,
  eventSlug,
  date,
}: {
  vendor: VendorResult;
  width: number;
  eventSlug?: string;
  date?: string | null;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { toggleSave } = useSaveVendor();
  const savedFor = useSavedEventsFor(vendor.id);
  const saved = eventSlug ? savedFor.includes(eventSlug) : savedFor.length > 0;
  const name = localized(vendor.name);
  const distance = distanceWords(vendor.distanceMiles, t);
  const price = priceWords(vendor.startingPrice, t);
  const facts = [vendor.category ? localized(vendor.category) : null, vendor.city, distance?.shown]
    .filter(Boolean)
    .join(' · ');
  const spoken = [
    name,
    vendor.category ? localized(vendor.category) : null,
    vendor.city,
    distance?.spoken,
    price?.spoken,
  ]
    .filter(Boolean)
    .join(', ');

  const open = () =>
    router.push({
      pathname: '/v/[slug]',
      params: eventSlug ? { slug: vendor.slug, event: eventSlug } : { slug: vendor.slug },
    });
  const saveLabel = saved ? t('vendorCard.unsave', { name }) : t('vendorCard.save', { name });
  const save = () => {
    saveHaptic();
    toggleSave(vendor.id, eventSlug);
  };

  return (
    <View style={[styles.card, { width }]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={spoken}
        // The heart sits on the card, which screen readers treat as one
        // element, so saving is also offered as an action on the card.
        accessibilityActions={[{ name: 'toggleSave', label: saveLabel }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'toggleSave') save();
        }}
        onPress={open}
        pressedScale={0.97}
        style={styles.press}
      >
        <Image
          source={{ uri: photoUrl(vendor.coverPath ?? '', 'medium') }}
          contentFit="cover"
          transition={250}
          accessible={false}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, shade]} />
        <View style={styles.words}>
          <SampleTag show={vendor.isSample} onPhoto />
          <AppText variant="heading" weight={700} color="onPhoto" numberOfLines={2}>
            {name}
          </AppText>
          {facts ? (
            <AppText variant="label" weight={500} color="onPhoto" numberOfLines={1}>
              {facts}
            </AppText>
          ) : null}
          {price ? (
            <AppText variant="label" weight={700} color="onPhoto" numberOfLines={1}>
              {price.shown}
            </AppText>
          ) : null}
          <View style={styles.seeMore}>
            <AppText variant="label" weight={700} numberOfLines={1}>
              {t('home.seeMore')}
            </AppText>
          </View>
        </View>
      </PressableScale>
      {date && (
        <View style={styles.free}>
          <View style={styles.dot} />
          <AppText variant="caption" weight={700} numberOfLines={1}>
            {t('home.freeOn', { date: shortDate(date) })}
          </AppText>
        </View>
      )}
      <View style={styles.heart}>
        <GlassButton
          icon={saved ? 'heart' : 'heart-outline'}
          color={saved ? Colors.primary : Colors.text}
          accessibilityLabel={saveLabel}
          onPress={save}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.md,
  },
  bleed: {
    marginHorizontal: -Sizes.pageGutter,
  },
  track: {
    gap: Spacing.md,
    paddingHorizontal: Sizes.pageGutter,
  },
  card: {
    aspectRatio: 4 / 5,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderRadius: Radius.card + 2,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface2,
  },
  skeleton: {
    backgroundColor: Colors.skeleton,
  },
  press: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  words: {
    gap: 2,
    padding: Spacing.lg,
  },
  seeMore: {
    minHeight: Sizes.tapTarget - 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    borderRadius: Radius.button,
    backgroundColor: Colors.canvas,
  },
  free: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm - 1,
    borderRadius: Radius.chip,
    backgroundColor: Colors.glassFallback,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  heart: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
  },
}));
