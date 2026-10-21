import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { distanceWords, priceWords } from '@/components/vendor-card';
import { makeStyles, Radius, Spacing } from '@/constants/theme';
import { useVendorSearch, type VendorResult } from '@/data/search';
import { useSearchLocation } from '@/features/location/search-location';
import { NO_FILTERS } from '@/features/search/search-filters';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

import { SectionHeader } from './section-header';

const SHOWN = 4;

/**
 * A short list under the photo cards: any kind of vendor near the search
 * location, and with a date only those not booked that day; each row a
 * photo, the name, kind, town and distance, and the starting price. Hidden
 * when nothing fits.
 */
export function VendorRows({ date }: { date: string | null }) {
  const styles = useStyles();
  const { t } = useLocale();
  const { place, maxMiles } = useSearchLocation();
  const search = useVendorSearch({
    latitude: place?.latitude,
    longitude: place?.longitude,
    maxMiles,
    filters: { ...NO_FILTERS, availableOn: date },
    limit: 20,
  });
  const vendors = (search.data ?? []).filter((vendor) => vendor.photoUrl).slice(0, SHOWN);
  if (vendors.length === 0) return null;

  return (
    <View style={styles.block}>
      <SectionHeader
        title={date ? t('home.freeOnYourDate') : t('home.nearYou')}
        link={t('home.seeAll')}
        onLink={() => router.navigate('/search')}
      />
      <View style={styles.list}>
        {vendors.map((vendor) => (
          <VendorRow key={vendor.id} vendor={vendor} />
        ))}
      </View>
    </View>
  );
}

function VendorRow({ vendor }: { vendor: VendorResult }) {
  const styles = useStyles();
  const { t } = useLocale();
  const name = localized(vendor.name);
  const distance = distanceWords(vendor.distanceMiles, t);
  const price = priceWords(vendor.startingPrice, t);
  const facts = [vendor.category ? localized(vendor.category) : null, vendor.city, distance?.shown]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[name, facts, price?.spoken].filter(Boolean).join(', ')}
      onPress={() => router.push({ pathname: '/v/[slug]', params: { slug: vendor.slug } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Image
        source={{ uri: vendor.photoUrl ?? '' }}
        contentFit="cover"
        transition={250}
        accessible={false}
        style={styles.thumb}
      />
      <View style={styles.words}>
        <AppText weight={700} numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="label" color="text2" numberOfLines={1}>
          {facts}
        </AppText>
      </View>
      {price && (
        <AppText variant="label" weight={700} numberOfLines={1}>
          {price.shown}
        </AppText>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.md,
  },
  list: {
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: Radius.photo,
    backgroundColor: Colors.skeleton,
  },
  words: {
    flex: 1,
    gap: 2,
  },
}));
