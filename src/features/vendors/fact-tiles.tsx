import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { makeStyles, Spacing } from '@/constants/theme';
import type { VendorProfile } from '@/data/vendors';
import { useLocale } from '@/i18n/locale-context';

import { ALL_NORCAL_MILES, usd } from './profile-format';

type Tile = { big: string; small: string };

/**
 * The numbers a family asks first, in one row with thin lines between
 * them, right under the vendor's name (Fezy, 2026-11-11: the numbers were
 * too far down):
 * how many the hall seats, the starting price, and how far they travel (or
 * how many cars a hall or other venue parks). A tile the vendor hasn't filled in is left out;
 * none at all and the row is hidden.
 */
export function FactTiles({ vendor: v }: { vendor: VendorProfile }) {
  const styles = useStyles();
  const { t } = useLocale();
  const tiles: Tile[] = [];
  if (v.facts.seatedCapacity) {
    tiles.push({ big: String(v.facts.seatedCapacity), small: t('vendor.tiles.seats') });
  }
  if (v.price?.kind === 'starting_at') {
    tiles.push({
      big: usd.format(v.price.amount),
      small: v.price.unit
        ? t('vendor.tiles.per', { unit: t(`vendorCard.units.${v.price.unit}`) })
        : t('vendor.tiles.toStart'),
    });
  } else if (v.price?.kind === 'range') {
    tiles.push({
      big: usd.format(v.price.from),
      small: t('vendor.tiles.upTo', { to: usd.format(v.price.to) }),
    });
  }
  // Halls and other venues are a place to come to, so they never "travel to you"
  const isVenue = v.categories[0]?.groupSlug === 'venues';
  if (v.addressLine || isVenue) {
    if (v.facts.parkingSpaces) {
      tiles.push({ big: String(v.facts.parkingSpaces), small: t('vendor.tiles.parking') });
    }
  } else if (v.serviceRadiusMiles >= ALL_NORCAL_MILES) {
    tiles.push({ big: t('vendor.tiles.norcal'), small: t('vendor.tiles.travelsAnywhere') });
  } else {
    tiles.push({
      big: t('vendor.tiles.miles', { miles: v.serviceRadiusMiles }),
      small: t('vendor.tiles.travels'),
    });
  }
  if (tiles.length === 0) return null;

  return (
    <View style={styles.row}>
      {tiles.map((tile, index) => (
        <View
          key={tile.small}
          style={[styles.tile, index > 0 && styles.divided]}
          accessible
          accessibilityLabel={`${tile.big} ${tile.small}`}
        >
          <AppText
            weight={700}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={styles.big}
            maxFontSizeMultiplier={1.3}
          >
            {tile.big}
          </AppText>
          <AppText
            variant="caption"
            weight={600}
            color="text2"
            numberOfLines={2}
            style={styles.caps}
          >
            {tile.small.toUpperCase()}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  row: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  tile: {
    flex: 1,
    gap: Spacing.xs,
    paddingVertical: Spacing.md + 2,
  },
  divided: {
    paddingLeft: Spacing.lg,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },
  big: {
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  caps: {
    letterSpacing: 0.6,
  },
}));
