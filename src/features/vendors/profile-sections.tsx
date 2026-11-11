import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { MenuCard } from '@/components/menu-card';
import { makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';
import type { LinkedVendor } from '@/data/vendor-links';
import { useRealWeddingsAt, type VendorPhoto } from '@/data/vendor-media';
import { useVendorMenus } from '@/data/vendor-menus';
import type { VendorPrice } from '@/data/vendors';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

import { priceLine } from './profile-format';

// The vendor page's sections (/v/[slug]), each with only what it shows.

/** A section's name on the vendor page, flush with the text under it. */
export function PageHeading({ children }: { children: string }) {
  return (
    <AppText variant="section" accessibilityRole="header">
      {children}
    </AppText>
  );
}

/**
 * Other vendors linked to this one (approved caterers, venues that approved
 * them, worked with), each opening their own profile. Nothing when empty.
 */
export function LinkedVendors({ title, vendors }: { title: string; vendors: LinkedVendor[] }) {
  const Colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  if (vendors.length === 0) return null;

  return (
    <View style={styles.block}>
      <PageHeading>{title}</PageHeading>
      <View style={styles.rows}>
        {vendors.map((linked) => {
          const name = localized(linked.name);
          return (
            <Pressable
              key={linked.id}
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${linked.city}`}
              onPress={() => router.push({ pathname: '/v/[slug]', params: { slug: linked.slug } })}
              style={({ pressed }) => [styles.contact, pressed && styles.dimmed]}
            >
              <View style={styles.grow}>
                <AppText variant="bodyLg" weight={600}>
                  {name}
                </AppText>
                <AppText variant="label" color="text2">
                  {linked.city}
                </AppText>
              </View>
              <Icon name="chevron-forward" size={16} color={Colors.chevron} weight="semibold" />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Their photos (Fezy, 2026-11-11): with four or more, one tall photo beside
 * two, and a wide one under them; fewer sit side by side. See all opens the
 * full-screen viewer, as does each photo.
 */
export function PhotoGrid({ vendorId, photos }: { vendorId: string; photos: VendorPhoto[] }) {
  const styles = useStyles();
  const { t } = useLocale();
  const router = useRouter();
  const open = (index: number) =>
    router.push({ pathname: '/gallery', params: { vendorId, index: String(index) } });
  const tile = (photo: VendorPhoto, style: object) => {
    const index = photos.indexOf(photo);
    return (
      <Pressable
        key={photo.id}
        accessibilityRole="imagebutton"
        accessibilityLabel={t('gallery.open', { number: index + 1, total: photos.length })}
        onPress={() => open(index)}
        style={({ pressed }) => [styles.gridPhoto, style, pressed && styles.dimmed]}
      >
        <Image
          source={{ uri: photo.url.medium }}
          placeholder={photo.blurhash ? { blurhash: photo.blurhash } : undefined}
          contentFit="cover"
          transition={200}
          accessible={false}
          style={styles.gridImage}
        />
      </Pressable>
    );
  };
  const [first, second, third, fourth] = photos;

  return (
    <View style={styles.block}>
      <View style={styles.titleRow}>
        <View style={styles.grow}>
          <PageHeading>{t('vendor.photos')}</PageHeading>
        </View>
        {photos.length > 4 && (
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => open(0)}
            style={({ pressed }) => [styles.seeAll, pressed && styles.dimmed]}
          >
            <AppText variant="caption" weight={700} color="primary" style={styles.caps}>
              {t('vendor.seeAllPhotos', { number: photos.length }).toUpperCase()}
            </AppText>
          </Pressable>
        )}
      </View>
      {fourth ? (
        <View style={styles.mosaic}>
          <View style={styles.mosaicTop}>
            {tile(first, styles.tall)}
            <View style={styles.stack}>
              {tile(second, styles.short)}
              {tile(third, styles.short)}
            </View>
          </View>
          {tile(fourth, styles.wide)}
        </View>
      ) : (
        <View style={styles.mosaicTop}>{photos.map((photo) => tile(photo, styles.side))}</View>
      )}
    </View>
  );
}

/** What they charge, big, with their note and the caption for a "from" price. No card. */
export function PriceSection({ price, note }: { price: VendorPrice; note: string | null }) {
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <View style={styles.price}>
      <PageHeading>{t('vendor.price')}</PageHeading>
      <AppText variant="title" style={styles.tabular}>
        {priceLine(price, t)}
      </AppText>
      {note && <AppText variant="bodyLg">{note}</AppText>}
      {(price.kind === 'starting_at' || price.kind === 'range') && (
        <AppText color="text2">{t('vendor.priceCaption')}</AppText>
      )}
    </View>
  );
}

/** Caterers' and halls' menus (Town and Country asked for them, 2026-09-30). Nothing when empty. */
export function MenusSection({ vendorId }: { vendorId: string }) {
  const styles = useStyles();
  const { t } = useLocale();
  const router = useRouter();
  const menus = useVendorMenus(vendorId);
  if (!menus.data || menus.data.length === 0) return null;
  return (
    <View style={styles.block}>
      <PageHeading>{t('menus.title')}</PageHeading>
      {menus.data.map((menu) => (
        <MenuCard
          key={menu.id}
          menu={menu}
          onPress={() => router.push({ pathname: '/menu', params: { vendorId, menuId: menu.id } })}
        />
      ))}
    </View>
  );
}

/** "Good to know": the vendor's facts, one to a row with thin lines between. Nothing when empty. */
export function GoodToKnow({ facts }: { facts: string[] }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  if (facts.length === 0) return null;
  return (
    <View style={styles.block}>
      <PageHeading>{t('vendor.goodToKnow')}</PageHeading>
      <View style={styles.rows}>
        {facts.map((fact) => (
          <View key={fact} style={styles.factRow}>
            <Icon name="checkmark" size={17} color={Colors.success} weight="semibold" />
            <AppText variant="bodyLg" style={styles.grow}>
              {fact}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Other vendors' photos taken here, each opening that vendor. Nothing when empty. */
export function RealWeddings({ vendorId }: { vendorId: string }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const router = useRouter();
  const realWeddings = useRealWeddingsAt(vendorId);
  if (!realWeddings.data || realWeddings.data.length === 0) return null;
  return (
    <View style={styles.block}>
      <PageHeading>{t('vendor.realWeddings')}</PageHeading>
      {/* Sideways, so a hall with many doesn't make the page endless */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.realWeddings}
      >
        {realWeddings.data.map((photo) => {
          const by = localized(photo.vendor.name);
          return (
            <Pressable
              key={photo.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/v/[slug]', params: { slug: photo.vendor.slug } })
              }
              accessibilityLabel={t('vendor.photoBy', { name: by })}
              style={({ pressed }) => [styles.realWedding, pressed && styles.dimmed]}
            >
              <Image
                source={{ uri: photo.url.medium }}
                placeholder={photo.blurhash ? { blurhash: photo.blurhash } : undefined}
                contentFit="cover"
                transition={200}
                accessible={false}
                style={styles.realWeddingPhoto}
              />
              <View style={styles.realWeddingCaption}>
                <AppText weight={600} style={styles.grow}>
                  {t('vendor.photoBy', { name: by })}
                </AppText>
                <Icon name="chevron-forward" size={17} color={Colors.chevron} weight="semibold" />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export type ContactLine = {
  icon: IconName;
  /** The number, the address, or what it does ("Message Capitol Rose"). */
  title: string;
  /** What a tap does, or more about it ("Call", "Sacramento · Directions"). */
  subtitle?: string;
  onPress?: () => void;
  /** Read out instead of the title and subtitle. */
  spoken?: string;
};

/**
 * Contact (Fezy, 2026-11-11): message, call, directions and the rest as
 * plain rows with thin lines between, the numbers printed in full as well
 * (elders often read one aloud to someone else, vision S9 item 12). Each
 * row does what it says. Nothing when empty.
 */
export function ContactList({ contacts }: { contacts: ContactLine[] }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  if (contacts.length === 0) return null;
  return (
    <View style={styles.block}>
      <PageHeading>{t('vendor.contact')}</PageHeading>
      <View style={styles.rows}>
        {contacts.map((line) => (
          <Pressable
            key={line.title}
            accessibilityRole={line.onPress ? 'button' : undefined}
            accessibilityLabel={line.spoken}
            disabled={!line.onPress}
            onPress={line.onPress}
            style={({ pressed }) => [styles.contact, pressed && styles.dimmed]}
          >
            <Icon name={line.icon} size={22} color={Colors.text} />
            <View style={styles.grow}>
              <AppText variant="bodyLg" weight={600} selectable style={styles.tabular}>
                {line.title}
              </AppText>
              {line.subtitle && (
                <AppText variant="label" color="text2">
                  {line.subtitle}
                </AppText>
              )}
            </View>
            {line.onPress && (
              <Icon name="chevron-forward" size={16} color={Colors.chevron} weight="semibold" />
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.lg,
  },
  price: {
    gap: Spacing.sm,
  },
  rows: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  factRow: {
    minHeight: Sizes.row - 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAll: {
    minHeight: Sizes.tapTarget - 8,
    justifyContent: 'center',
  },
  caps: {
    letterSpacing: 0.6,
  },
  mosaic: {
    gap: Spacing.sm,
  },
  mosaicTop: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  stack: {
    flex: 1,
    gap: Spacing.sm,
  },
  gridPhoto: {
    overflow: 'hidden',
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: Colors.skeleton,
  },
  tall: {
    flex: 1.3,
    height: 288,
  },
  short: {
    height: 140,
  },
  wide: {
    height: 160,
  },
  side: {
    flex: 1,
    height: 180,
  },
  gridImage: {
    flex: 1,
  },
  dimmed: {
    opacity: 0.7,
  },
  bleed: {
    marginHorizontal: -Sizes.pageGutter,
  },
  realWeddings: {
    gap: Spacing.md,
    paddingHorizontal: Sizes.pageGutter,
  },
  realWedding: {
    width: 240,
    gap: Spacing.sm,
  },
  realWeddingPhoto: {
    width: '100%',
    aspectRatio: 3 / 2,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: Colors.skeleton,
  },
  realWeddingCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  grow: {
    flex: 1,
  },
  contact: {
    minHeight: Sizes.row + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
}));
