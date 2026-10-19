import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { FlatList, Platform, Pressable, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, useFontScale } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useVendorPhotos } from '@/data/vendor-media';
import { useLocale } from '@/i18n/locale-context';

/**
 * S10 photo viewer: a vendor's photos full screen on black, swipe sideways,
 * "3 / 12" and the credit. The Close button is always visible, so nobody
 * needs to know a gesture to get out. /gallery?vendorId=…&index=…
 */
export default function GalleryScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { vendorId = '', index = '0' } = useLocalSearchParams<{
    vendorId: string;
    index?: string;
  }>();
  const router = useRouter();
  const { t } = useLocale();
  const scale = Math.min(useFontScale('body'), 1.4);
  const photos = useVendorPhotos(vendorId);
  const start = Math.max(0, Number(index) || 0);
  const [current, setCurrent] = useState(start);
  // Pages are the size of the viewer itself, measured once it lays out: on
  // the web a sideways list doesn't stretch its pages, and the window can be
  // wider than the app (the desktop preview frame).
  const [page, setPage] = useState({ width: 0, height: 0 });
  const width = page.width;

  const close = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  const list = photos.data ?? [];
  const photo = list[current];

  return (
    // Insets from the root: SafeAreaView reads none inside a full-screen modal
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('gallery.close')}
          onPress={close}
          style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
        >
          <Icon
            name="close"
            size={Sizes.iconSmall * scale}
            color={Colors.onPrimary}
            weight="bold"
          />
          <AppText variant="button" color="onPrimary">
            {t('gallery.close')}
          </AppText>
        </Pressable>
        {list.length > 0 && (
          <AppText color="onPrimary" weight={600} style={styles.counter}>
            {`${current + 1} / ${list.length}`}
          </AppText>
        )}
      </View>

      <View
        style={styles.list}
        onLayout={(event) => {
          const { width: w, height: h } = event.nativeEvent.layout;
          setPage({ width: w, height: h });
        }}
      >
        {photos.isPending ? (
          <StateView state="loading" />
        ) : list.length === 0 ? (
          <StateView state="error" onRetry={() => void photos.refetch()} />
        ) : width === 0 ? null : (
          <FlatList
            data={list}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(start, list.length - 1)}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            keyExtractor={(item) => item.id}
            onMomentumScrollEnd={(event) =>
              setCurrent(Math.round(event.nativeEvent.contentOffset.x / width))
            }
            renderItem={({ item, index: i }) => (
              <View style={{ width, height: page.height }}>
                <Image
                  source={{ uri: item.url.large }}
                  placeholder={item.blurhash ? { blurhash: item.blurhash } : undefined}
                  contentFit="contain"
                  accessible
                  accessibilityLabel={
                    item.credit ?? t('gallery.photoOf', { number: i + 1, total: list.length })
                  }
                  style={styles.photo}
                />
              </View>
            )}
            style={styles.list}
          />
        )}
      </View>

      {photo?.credit && (
        <View style={styles.caption}>
          <AppText color="onPrimary">{photo.credit}</AppText>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  screen: {
    flex: 1,
    backgroundColor: Colors.viewer,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: Sizes.pageGutter,
    paddingVertical: Spacing.sm,
  },
  // Dark glass: a light, blurred capsule over the black viewer.
  close: {
    minHeight: Sizes.tapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.lg,
    borderRadius: Radius.chip,
    backgroundColor: 'rgba(120, 120, 128, 0.36)',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(20px)' } as ViewStyle) : null),
  },
  closePressed: {
    backgroundColor: 'rgba(120, 120, 128, 0.56)',
  },
  counter: {
    fontVariant: ['tabular-nums'],
  },
  list: {
    flex: 1,
  },
  photo: {
    flex: 1,
  },
  caption: {
    paddingHorizontal: Sizes.pageGutter,
    paddingVertical: Spacing.md,
  },
}));
