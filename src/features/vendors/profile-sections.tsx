import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { ListRow, ListSection, SectionTitle } from '@/components/list';
import { MenuCard } from '@/components/menu-card';
import { StoryRing } from '@/components/story-ring';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useHomeEvents } from '@/data/reference';
import type { LinkedVendor } from '@/data/vendor-links';
import { useRealWeddingsAt, type VendorPhoto } from '@/data/vendor-media';
import { useVendorMenus } from '@/data/vendor-menus';
import type { VendorPrice } from '@/data/vendors';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

import { priceLine } from './profile-format';

// The vendor page's sections (/v/[slug]), each with only what it shows.

/**
 * Other vendors linked to this one (approved caterers, venues that approved
 * them, worked with), each opening their own profile. Nothing when empty.
 */
export function LinkedVendors({ title, vendors }: { title: string; vendors: LinkedVendor[] }) {
  const styles = useStyles();
  const router = useRouter();
  if (vendors.length === 0) return null;

  return (
    <View style={styles.block}>
      <SectionTitle>{title}</SectionTitle>
      <ListSection>
        {vendors.map((linked) => {
          const name = localized(linked.name);
          return (
            <ListRow
              key={linked.id}
              title={name}
              subtitle={linked.city}
              accessibilityLabel={`${name}, ${linked.city}`}
              onPress={() => router.push({ pathname: '/v/[slug]', params: { slug: linked.slug } })}
            />
          );
        })}
      </ListSection>
    </View>
  );
}

/**
 * Story highlights, as on an Instagram profile: all the photos, then one
 * circle per event they were taken at (Jaago, Reception...). Each opens the
 * full-screen story viewer at that photo.
 */
export function Highlights({
  slug,
  photos,
  name,
}: {
  slug: string;
  photos: VendorPhoto[];
  name: string;
}) {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useLocale();
  const events = useHomeEvents();
  const eventNames = new Map(
    (events.data ?? []).flatMap((section) => section.events).map((e) => [e.slug, e.name]),
  );
  const byEvent = new Map<string, VendorPhoto>();
  for (const photo of photos) {
    if (photo.eventSlug && !byEvent.has(photo.eventSlug)) byEvent.set(photo.eventSlug, photo);
  }
  // A lone "All photos" ring repeats the cover and the grid: only with event highlights
  if (byEvent.size === 0) return null;
  const open = (photoId?: string) =>
    router.push({
      pathname: '/story',
      params: photoId ? { vendor: slug, photo: photoId } : { vendor: slug },
    });

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.highlightStrip}
      contentContainerStyle={styles.highlights}
    >
      <StoryRing
        photoUrl={photos[0].url.small}
        label={t('vendor.allPhotos')}
        size={62}
        accessibilityLabel={t('discover.openStory', { name })}
        onPress={() => open()}
      />
      {[...byEvent.entries()].map(([eventSlug, photo]) => {
        const eventName = eventNames.get(eventSlug);
        const label = eventName ? localized(eventName) : eventSlug;
        return (
          <StoryRing
            key={eventSlug}
            photoUrl={photo.url.small}
            label={label}
            size={62}
            accessibilityLabel={t('vendor.highlightSpoken', { name, event: label })}
            onPress={() => open(photo.id)}
          />
        );
      })}
    </ScrollView>
  );
}

/** Three square photos per row (vision doc S9 item 10), with credits read out. */
export function PhotoGrid({ vendorId, photos }: { vendorId: string; photos: VendorPhoto[] }) {
  const styles = useStyles();
  const { t } = useLocale();
  const router = useRouter();
  const rows: VendorPhoto[][] = [];
  for (let i = 0; i < photos.length; i += 3) rows.push(photos.slice(i, i + 3));

  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row[0].id} style={styles.gridRow}>
          {row.map((photo) => {
            const index = photos.indexOf(photo);
            return (
              <Pressable
                key={photo.id}
                accessibilityRole="imagebutton"
                accessibilityLabel={t('gallery.open', {
                  number: index + 1,
                  total: photos.length,
                })}
                onPress={() =>
                  router.push({ pathname: '/gallery', params: { vendorId, index: String(index) } })
                }
                style={({ pressed }) => [styles.gridPhoto, pressed && styles.dimmed]}
              >
                <Image
                  source={{ uri: photo.url.small }}
                  placeholder={photo.blurhash ? { blurhash: photo.blurhash } : undefined}
                  contentFit="cover"
                  transition={200}
                  accessible={false}
                  style={styles.gridImage}
                />
              </Pressable>
            );
          })}
          {Array.from({ length: 3 - row.length }, (_, i) => (
            <View key={`gap-${i}`} style={styles.gridGap} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** What they charge, as a line, with their note and the caption for a "from" price. */
export function PriceSection({ price, note }: { price: VendorPrice; note: string | null }) {
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <View style={styles.block}>
      <SectionTitle>{t('vendor.price')}</SectionTitle>
      <Card style={styles.priceCard}>
        <AppText variant="section" style={styles.tabular}>
          {priceLine(price, t)}
        </AppText>
        {note && <AppText>{note}</AppText>}
        {(price.kind === 'starting_at' || price.kind === 'range') && (
          <AppText variant="label" weight={400} color="text2">
            {t('vendor.priceCaption')}
          </AppText>
        )}
      </Card>
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
      <SectionTitle>{t('menus.title')}</SectionTitle>
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

/** "Good to know": the vendor's facts as pills with a tick. Nothing when empty. */
export function GoodToKnow({ facts }: { facts: string[] }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  if (facts.length === 0) return null;
  return (
    <View style={styles.block}>
      <SectionTitle>{t('vendor.goodToKnow')}</SectionTitle>
      <View style={styles.pills}>
        {facts.map((fact) => (
          <View key={fact} style={styles.pill}>
            <Icon name="checkmark-circle" size={17} color={Colors.success} />
            <AppText variant="label">{fact}</AppText>
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
      <SectionTitle>{t('vendor.realWeddings')}</SectionTitle>
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
            <Card
              key={photo.id}
              onPress={() =>
                router.push({ pathname: '/v/[slug]', params: { slug: photo.vendor.slug } })
              }
              accessibilityLabel={t('vendor.photoBy', { name: by })}
              style={styles.realWedding}
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
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

export type ContactLine = { label: string; value: string; onPress?: () => void };

/**
 * Printed out as well as behind buttons: elders often read a number aloud to
 * someone else (vision S9 item 12). Each line also does what its button
 * would. Nothing when empty.
 */
export function ContactList({ contacts }: { contacts: ContactLine[] }) {
  const styles = useStyles();
  const { t } = useLocale();
  if (contacts.length === 0) return null;
  return (
    <View style={styles.block}>
      <SectionTitle>{t('vendor.contact')}</SectionTitle>
      <ListSection>
        {contacts.map((line) => (
          <Pressable
            key={line.label}
            accessibilityRole={line.onPress ? 'button' : undefined}
            disabled={!line.onPress}
            onPress={line.onPress}
            style={({ pressed }) => [styles.contact, pressed && styles.contactPressed]}
          >
            <AppText variant="label" weight={400} color="text2">
              {line.label}
            </AppText>
            <AppText variant="bodyLg" selectable style={styles.tabular}>
              {line.value}
            </AppText>
          </Pressable>
        ))}
      </ListSection>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  highlightStrip: {
    marginHorizontal: -Sizes.pageGutter,
  },
  highlights: {
    gap: Spacing.xs,
    paddingHorizontal: Sizes.pageGutter - 6,
  },
  block: {
    gap: Spacing.lg,
  },
  priceCard: {
    gap: Spacing.xs,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.chip,
    backgroundColor: Colors.surface,
  },
  grid: {
    gap: 3,
    borderRadius: Radius.photo,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 3,
  },
  gridPhoto: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: Colors.skeleton,
  },
  gridGap: {
    flex: 1,
    aspectRatio: 1,
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
    padding: 0,
  },
  realWeddingPhoto: {
    width: '100%',
    aspectRatio: 3 / 2,
    backgroundColor: Colors.skeleton,
  },
  realWeddingCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  grow: {
    flex: 1,
  },
  contact: {
    gap: 2,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  contactPressed: {
    backgroundColor: Colors.rowPressed,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
}));
