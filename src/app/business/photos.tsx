import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { NavScreen } from '@/components/nav';
import { ProgressBar } from '@/components/progress-bar';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import type { VendorPhoto } from '@/data/vendor-media';
import {
  MAX_VENDOR_PHOTOS,
  type AddPhotosResult,
  useAddVendorPhotos,
  useMyVendorPhotos,
} from '@/data/vendor-photos-self';
import { useEventNames } from '@/features/business/business-parts';
import { useCurrentBusiness } from '@/features/business/use-current-business';
import { askMediaAccess } from '@/features/reels/media-access';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

/**
 * My business → Photos (#212): the photos families see, in that order, the
 * cover first and marked. "Add photos" picks several from the phone (Photos
 * access is asked only then); each photo opens its own page to make it the
 * cover, say which event it's from, move it or remove it.
 */
export default function BusinessPhotosScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const business = useCurrentBusiness();
  const photos = useMyVendorPhotos(business.vendorId);
  const add = useAddVendorPhotos(business.vendorId);
  const eventName = useEventNames();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<AddPhotosResult | null>(null);
  const [blocked, setBlocked] = useState(false);

  const count = photos.data?.length ?? 0;
  const room = MAX_VENDOR_PHOTOS - count;

  const pick = async () => {
    setResult(null);
    if (Platform.OS !== 'web') {
      const access = await askMediaAccess('library');
      setBlocked(access === 'blocked');
      if (access !== 'granted') return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: room,
      quality: 1,
    });
    if (picked.canceled || picked.assets.length === 0) return;
    const chosen = picked.assets
      .slice(0, room)
      .map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
    setProgress({ done: 0, total: chosen.length });
    try {
      const outcome = await add.mutateAsync({
        photos: chosen,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      if (outcome.added > 0) successHaptic();
      setResult(outcome);
    } catch {
      setResult({ added: 0, failed: chosen.length, problem: 'failed' });
    } finally {
      setProgress(null);
    }
  };

  let content;
  if (business.isPending || photos.isPending) {
    content = <StateView state="loading" />;
  } else if (!business.isVendor) {
    content = (
      <StateView state="empty" icon="storefront-outline" message={t('business.notVendor')} />
    );
  } else if (photos.isError) {
    content = <StateView state="error" onRetry={() => void photos.refetch()} />;
  } else {
    content = (
      <View style={styles.grid}>
        {photos.data.map((photo, index) => (
          <PhotoTile
            key={photo.id}
            photo={photo}
            label={photo.eventSlug ? eventName(photo.eventSlug) : t('business.photos.noEvent')}
            spoken={t('business.photos.tileLabel', {
              number: index + 1,
              total: count,
            })}
          />
        ))}
      </View>
    );
  }

  return (
    <NavScreen title={t('business.photos.title')} subtitle={t('business.photos.subtitle')}>
      <View style={styles.top}>
        {progress ? (
          <View style={styles.progress} accessibilityLiveRegion="polite">
            <AppText weight={600}>
              {t('business.photos.adding', {
                done: Math.min(progress.done + 1, progress.total),
                total: progress.total,
              })}
            </AppText>
            <ProgressBar
              value={progress.total > 0 ? progress.done / progress.total : 0}
              color={Colors.primary}
              trackColor={Colors.fill}
              height={8}
            />
          </View>
        ) : (
          <Button
            label={t('business.photos.add')}
            icon="images-outline"
            disabled={room <= 0 || photos.isPending}
            onPress={() => void pick()}
          />
        )}
        <AppText variant="label" weight={400} color="text2">
          {room > 0
            ? t('business.photos.count', { count, max: MAX_VENDOR_PHOTOS })
            : t('business.photos.full', { max: MAX_VENDOR_PHOTOS })}
        </AppText>
        {result && result.added > 0 && (
          <AppText weight={600} color="success" accessibilityLiveRegion="polite">
            {t('business.photos.added', { count: result.added })}
          </AppText>
        )}
        {result && result.failed > 0 && (
          <FieldError
            message={t(`business.photos.problems.${result.problem ?? 'failed'}`, {
              count: result.failed,
              max: MAX_VENDOR_PHOTOS,
            })}
          />
        )}
        {blocked && (
          <View style={styles.blocked}>
            <AppText color="text2">{t('business.photos.blocked')}</AppText>
            <Button
              variant="secondary"
              label={t('business.photos.openSettings')}
              onPress={() => void Linking.openSettings()}
            />
          </View>
        )}
      </View>
      {count === 0 && !photos.isPending && business.isVendor ? (
        <StateView state="empty" icon="images-outline" message={t('business.photos.empty')} />
      ) : (
        content
      )}
    </NavScreen>
  );
}

function PhotoTile({
  photo,
  label,
  spoken,
}: {
  photo: VendorPhoto;
  label: string;
  spoken: string;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[spoken, photo.isCover ? t('business.photos.cover') : null, label]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint={t('business.photos.tileHint')}
      onPress={() => router.push({ pathname: '/business/photo', params: { id: photo.id } })}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={styles.frame}>
        <Image
          source={{ uri: photo.url.small }}
          placeholder={photo.blurhash ? { blurhash: photo.blurhash } : undefined}
          contentFit="cover"
          style={styles.image}
          accessible={false}
        />
        {photo.isCover && (
          <View style={styles.coverBadge}>
            <Icon name="star" size={14} color={Colors.onPrimary} />
            <AppText variant="caption" weight={700} color="onPrimary">
              {t('business.photos.cover')}
            </AppText>
          </View>
        )}
      </View>
      <AppText variant="label" weight={500} color="text2" numberOfLines={2}>
        {label}
      </AppText>
    </Pressable>
  );
}

const useStyles = makeStyles((Colors) => ({
  top: {
    gap: Spacing.sm,
  },
  progress: {
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  blocked: {
    gap: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  tile: {
    width: '47%',
    flexGrow: 1,
    maxWidth: '48.5%',
    gap: Spacing.xs,
  },
  frame: {
    aspectRatio: 1,
    borderRadius: Radius.photo,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: Colors.skeleton,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  coverBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.chip,
    backgroundColor: Colors.primaryFill,
  },
  pressed: {
    opacity: 0.7,
  },
}));
