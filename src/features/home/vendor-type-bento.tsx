import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText, useFontScale } from '@/components/app-text';
import { groupIcon } from '@/components/group-icon';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Spacing, useColors, type Palette } from '@/constants/theme';
import type { FeedPost } from '@/data/feed';
import type { CategoryGroup } from '@/data/reference';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { Motion } from '@/lib/motion';

import { Aurora } from './aurora';

/** How many kinds of vendor get a tile; the rest are behind "See all". */
export const BENTO_TILES = 6;

type Look = 'maroon' | 'kesari' | 'rose' | 'light';
// The big tile is maroon silk; the others alternate colour and white so the
// grid reads as a pattern, not a list
const LOOKS: Look[] = ['maroon', 'kesari', 'light', 'light', 'rose', 'light'];

const fill = (Colors: Palette, look: Look) => {
  const [from, to] =
    look === 'maroon'
      ? [Colors.heroFrom, Colors.heroTo]
      : look === 'kesari'
        ? [Colors.kesari, Colors.heroFrom]
        : [Colors.heroTo, Colors.pink];
  const image = `linear-gradient(150deg, ${from} 0%, ${to} 100%)`;
  return (
    Platform.OS === 'web' ? { backgroundImage: image } : { experimental_backgroundImage: image }
  ) as ViewStyle;
};

const scrim = (
  Platform.OS === 'web'
    ? { backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0.05))' }
    : {
        experimental_backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0.05))',
      }
) as ViewStyle;

/**
 * "What do you need?" as a bento grid: one big tile and five smaller ones for
 * the first kinds of vendor (in the founders' order), each with its icon and
 * how many vendors there are, on maroon, saffron, rose or white. A vendor's
 * photo takes over a tile once that kind has one. At very large text sizes it
 * becomes an even two-column grid so nothing is cut off.
 */
export function VendorTypeBento({
  groups,
  counts,
  posts,
}: {
  groups: CategoryGroup[];
  /** Published vendors per category slug. */
  counts: Record<string, number>;
  /** The feed, for a photo per kind of vendor. */
  posts: FeedPost[];
}) {
  const styles = useStyles();
  const roomy = useFontScale() >= 1.3;
  const shown = groups.slice(0, BENTO_TILES);

  const tile = (group: CategoryGroup, index: number, style: ViewStyle | ViewStyle[]) => (
    <Tile
      key={group.slug}
      group={group}
      index={index}
      look={LOOKS[index] ?? 'light'}
      big={index === 0 && !roomy}
      count={group.categories.reduce((sum, c) => sum + (counts[c.slug] ?? 0), 0)}
      photo={photoFor(group.slug, posts)}
      style={style}
    />
  );

  if (roomy || shown.length < BENTO_TILES) {
    return (
      <View style={styles.wrapGrid}>{shown.map((group, i) => tile(group, i, styles.half))}</View>
    );
  }

  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        {tile(shown[0], 0, [styles.flex, styles.tall])}
        <View style={[styles.flex, styles.column]}>
          {tile(shown[1], 1, styles.short)}
          {tile(shown[2], 2, styles.short)}
        </View>
      </View>
      <View style={styles.row}>
        {shown.slice(3).map((group, i) => tile(group, i + 3, [styles.flex, styles.short]))}
      </View>
    </View>
  );
}

/** The cover (or first) photo of the first vendor of that kind, if any. */
function photoFor(groupSlug: string, posts: FeedPost[]): string | null {
  const post = posts.find((p) => p.category?.groupSlug === groupSlug && p.photos.length > 0);
  if (!post) return null;
  const photo = post.photos.find((p) => p.isCover) ?? post.photos[0];
  return photo.url.small;
}

function Tile({
  group,
  index,
  look,
  big,
  count,
  photo,
  style,
}: {
  group: CategoryGroup;
  index: number;
  look: Look;
  big: boolean;
  count: number;
  photo: string | null;
  style: ViewStyle | ViewStyle[];
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t, locale } = useLocale();
  const name = localized(group.name, locale);
  const onColour = look !== 'light' || photo !== null;
  const ink = onColour ? 'onHero' : 'text';
  const subtle = onColour ? 'onHero2' : 'text2';

  return (
    <Animated.View entering={Motion.stagger(index)} style={style}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${t('counts.vendors', { count })}`}
        onPress={() => router.push({ pathname: '/g/[group]', params: { group: group.slug } })}
        style={[
          styles.tile,
          photo ? styles.photoTile : look === 'light' ? styles.lightTile : fill(Colors, look),
        ]}
      >
        {photo ? (
          <>
            <Image source={{ uri: photo }} contentFit="cover" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, scrim]} />
          </>
        ) : (
          look === 'maroon' && <Aurora size={200} />
        )}
        <View style={[styles.iconWrap, onColour ? styles.iconOnColour : styles.iconOnLight]}>
          <Icon
            name={groupIcon(group.slug)}
            size={big ? 30 : 24}
            color={onColour ? Colors.onHero : Colors.primary}
          />
        </View>
        <View style={styles.words}>
          <AppText
            variant={big ? 'heading' : 'body'}
            weight={700}
            color={ink}
            numberOfLines={big ? 3 : 2}
          >
            {name}
          </AppText>
          <AppText variant="caption" weight={500} color={subtle} numberOfLines={1}>
            {t('counts.vendors', { count })}
          </AppText>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const SHORT = 128;

const useStyles = makeStyles((Colors) => ({
  grid: {
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  column: {
    gap: Spacing.md,
  },
  flex: {
    flex: 1,
  },
  tall: {
    height: SHORT * 2 + Spacing.md,
  },
  short: {
    height: SHORT,
  },
  wrapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  half: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: SHORT,
  },
  tile: {
    flex: 1,
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  lightTile: {
    backgroundColor: Colors.surface,
  },
  photoTile: {
    backgroundColor: Colors.heroFrom,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOnColour: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  iconOnLight: {
    backgroundColor: Colors.primaryTint,
  },
  words: {
    gap: 2,
  },
}));
