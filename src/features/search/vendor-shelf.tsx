import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { GlassButton } from '@/components/glass-button';
import { PressableScale } from '@/components/pressable-scale';
import { SampleTag } from '@/components/sample-tag';
import { distanceWords, priceWords } from '@/components/vendor-card';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import type { EventNeed } from '@/data/reference';
import { useSavedEventsFor, useSaveVendor } from '@/data/saved';
import { useVendorSearch, type VendorResult } from '@/data/search';
import { photoUrl } from '@/data/vendor-media';
import { shortDate } from '@/features/home/book-first';
import { SectionHeader } from '@/features/home/section-header';
import { useSearchLocation } from '@/features/location/search-location';
import { filtersForGuests } from '@/features/planner/find-for-plan';
import { NO_FILTERS } from '@/features/search/search-filters';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { saveHaptic } from '@/lib/haptics';

const SHOWN = 10;

type Props = {
  kind: EventNeed;
  title: string;
  /** A line under the title, e.g. "The hall sets your date, so book it first." */
  subtitle?: string;
  /** Wide landscape cards (the hall) instead of small square ones. */
  wide?: boolean;
  /** Leave out vendors booked all day on this yyyy-mm-dd date. */
  date: string | null;
  guestBand: string | null;
  onSeeAll: () => void;
};

/**
 * A shelf on the Vendors tab (2026-11-08): a kind of vendor's title and See
 * all, then small photo cards you swipe through, about two and a half on a
 * phone, with the name, town, distance and starting price under each photo.
 * Only vendors near the search place, free on the date and seating the
 * guests, with a photo. Hidden when none fit.
 */
export function VendorShelf({ kind, title, subtitle, wide, date, guestBand, onSeeAll }: Props) {
  const styles = useStyles();
  const { t } = useLocale();
  const { width } = useWindowDimensions();
  const { place, maxMiles } = useSearchLocation();
  const search = useVendorSearch({
    latitude: place?.latitude,
    longitude: place?.longitude,
    maxMiles,
    categorySlug: kind.categorySlug,
    filters: {
      ...NO_FILTERS,
      ...filtersForGuests(kind.groupSlug, guestBand ?? undefined),
      availableOn: date,
    },
    limit: 24,
  });
  const vendors = (search.data ?? []).filter((vendor) => vendor.coverPath).slice(0, SHOWN);
  const room = width - Sizes.pageGutter - 2 * Spacing.md;
  const cardWidth = Math.round(wide ? Math.min(300, room / 1.3) : Math.min(180, room / 2.3));
  const photoHeight = Math.round(wide ? cardWidth * 0.66 : cardWidth);

  if (search.isError || (search.isSuccess && vendors.length === 0)) return null;

  return (
    <View style={styles.block}>
      <View style={styles.words}>
        <SectionHeader title={title} link={t('home.seeAll')} onLink={onSeeAll} />
        {subtitle ? (
          <AppText variant="label" weight={400} color="text2">
            {subtitle}
          </AppText>
        ) : null}
      </View>
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
              <View
                key={key}
                style={[styles.photo, styles.skeleton, { width: cardWidth, height: photoHeight }]}
              />
            ))
          : vendors.map((vendor) => (
              <ShelfCard
                key={vendor.id}
                vendor={vendor}
                width={cardWidth}
                photoHeight={photoHeight}
                date={date}
              />
            ))}
      </ScrollView>
    </View>
  );
}

function ShelfCard({
  vendor,
  width,
  photoHeight,
  date,
}: {
  vendor: VendorResult;
  width: number;
  photoHeight: number;
  date: string | null;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { toggleSave } = useSaveVendor();
  const saved = useSavedEventsFor(vendor.id).length > 0;
  const name = localized(vendor.name);
  const distance = distanceWords(vendor.distanceMiles, t);
  const price = priceWords(vendor.startingPrice, t);
  const where = [vendor.city, distance?.shown].filter(Boolean).join(' · ');
  const spoken = [
    name,
    vendor.category ? localized(vendor.category) : null,
    vendor.city,
    distance?.spoken,
    price?.spoken,
    date ? t('home.freeOn', { date: shortDate(date) }) : null,
  ]
    .filter(Boolean)
    .join(', ');
  const saveLabel = saved ? t('vendorCard.unsave', { name }) : t('vendorCard.save', { name });
  const save = () => {
    saveHaptic();
    toggleSave(vendor.id, undefined, { name, photo: vendor.photoUrl });
  };

  return (
    <View style={{ width }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={spoken}
        // The heart sits on the card, which screen readers treat as one
        // element, so saving is also offered as an action on the card.
        accessibilityActions={[{ name: 'toggleSave', label: saveLabel }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'toggleSave') save();
        }}
        onPress={() => router.push({ pathname: '/v/[slug]', params: { slug: vendor.slug } })}
        pressedScale={0.97}
        style={styles.card}
      >
        <View style={[styles.photo, { height: photoHeight }]}>
          <Image
            source={{ uri: photoUrl(vendor.coverPath ?? '', 'medium') }}
            contentFit="cover"
            transition={250}
            accessible={false}
            style={StyleSheet.absoluteFill}
          />
          {date ? (
            <View style={styles.free}>
              <View style={styles.dot} />
              <AppText variant="caption" weight={700} numberOfLines={1}>
                {t('home.freeOn', { date: shortDate(date) })}
              </AppText>
            </View>
          ) : null}
          <View style={styles.sample}>
            <SampleTag show={vendor.isSample} onPhoto />
          </View>
        </View>
        <AppText weight={600} numberOfLines={1}>
          {name}
        </AppText>
        {where ? (
          <AppText variant="label" weight={400} color="text2" numberOfLines={1}>
            {where}
          </AppText>
        ) : null}
        {price ? (
          <AppText variant="label" weight={600} numberOfLines={1}>
            {price.shown}
          </AppText>
        ) : null}
      </PressableScale>
      <View style={styles.heart}>
        <GlassButton
          size={40}
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
  words: {
    gap: 2,
  },
  bleed: {
    marginHorizontal: -Sizes.pageGutter,
  },
  track: {
    gap: Spacing.md,
    paddingHorizontal: Sizes.pageGutter,
  },
  card: {
    gap: 2,
  },
  photo: {
    marginBottom: Spacing.sm - 2,
    overflow: 'hidden',
    borderRadius: Radius.photo,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface2,
  },
  skeleton: {
    backgroundColor: Colors.skeleton,
  },
  free: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    maxWidth: '62%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.chip,
    backgroundColor: Colors.glassFallback,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  sample: {
    position: 'absolute',
    left: Spacing.sm,
    bottom: Spacing.sm,
  },
  heart: {
    position: 'absolute',
    top: Spacing.xs + 2,
    right: Spacing.xs + 2,
  },
}));
