import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { makeStyles, Spacing, useColors } from '@/constants/theme';
import type { VendorPhoto } from '@/data/vendor-media';
import { useLocale } from '@/i18n/locale-context';

/** The photos the top of the page swipes through; the rest are in Photos and the viewer. */
const MAX_PAGES = 8;

/**
 * The top of a vendor's page (Fezy, 2026-11-11): their photos edge to edge,
 * swiped sideways one at a time, with small dots for where you are. A tap
 * opens the full-screen viewer at that photo. Pages are sized from the
 * width and height they're given (a sideways list on the web doesn't
 * stretch its pages by itself).
 */
export function PhotoPager({
  vendorId,
  photos,
  width,
  height,
  dotsBottom,
}: {
  vendorId: string;
  photos: VendorPhoto[];
  width: number;
  height: number;
  /** How far up from the bottom the dots sit, clear of the page rising over the photo. */
  dotsBottom: number;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useLocale();
  const [at, setAt] = useState(0);
  const shown = photos.slice(0, MAX_PAGES);

  return (
    <View style={{ width, height }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={(event) => {
          const page = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));
          if (page !== at) setAt(page);
        }}
      >
        {shown.map((photo, index) => (
          <Pressable
            key={photo.id}
            accessibilityRole="imagebutton"
            accessibilityLabel={t('gallery.open', { number: index + 1, total: photos.length })}
            onPress={() =>
              router.push({ pathname: '/gallery', params: { vendorId, index: String(index) } })
            }
            style={{ width, height }}
          >
            <Image
              source={{ uri: photo.url.large }}
              placeholder={photo.blurhash ? { blurhash: photo.blurhash } : undefined}
              contentFit="cover"
              transition={250}
              accessible={false}
              style={StyleSheet.absoluteFill}
            />
          </Pressable>
        ))}
      </ScrollView>
      {shown.length > 1 && (
        <View pointerEvents="none" style={[styles.dots, { bottom: dotsBottom }]}>
          {shown.map((photo, index) => (
            <View
              key={photo.id}
              style={[
                styles.dot,
                index === at
                  ? { width: 18, backgroundColor: Colors.onPhoto }
                  : { backgroundColor: Colors.onHero2 },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs + 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)',
  },
}));
