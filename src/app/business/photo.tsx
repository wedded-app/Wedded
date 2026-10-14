import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useTraditions } from '@/data/reference';
import {
  photoProblem,
  useMyVendorPhotos,
  useRemoveVendorPhoto,
  useReorderVendorPhotos,
  useSetVendorCover,
  useTagVendorPhoto,
} from '@/data/vendor-photos-self';
import { useCurrentBusiness } from '@/features/business/use-current-business';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/**
 * One of a vendor's photos (#212), opened from My business → Photos: the
 * photo large, then plain buttons for elders instead of dragging: Make it
 * the cover, which event it's from, Move earlier / Move later, Remove (asked
 * first). /business/photo?id={media id}
 */
export default function BusinessPhotoSheet() {
  const Colors = useColors();
  const styles = useStyles();
  const { t, locale } = useLocale();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { vendorId } = useCurrentBusiness();
  const photos = useMyVendorPhotos(vendorId);
  const cover = useSetVendorCover(vendorId);
  const tag = useTagVendorPhoto(vendorId);
  const reorder = useReorderVendorPhotos(vendorId);
  const remove = useRemoveVendorPhoto(vendorId);
  const traditions = useTraditions();

  // The main events of every tradition, once each: a vendor's families can be from any
  const events = useMemo(() => {
    const seen = new Map<string, string>();
    for (const tradition of traditions.data ?? []) {
      for (const event of tradition.events) {
        if (event.isCore && !seen.has(event.slug)) {
          seen.set(event.slug, localized(event.name, locale));
        }
      }
    }
    return [...seen].map(([slug, name]) => ({ slug, name }));
  }, [traditions.data, locale]);

  const list = photos.data ?? [];
  const index = list.findIndex((p) => p.id === id);
  const photo = index >= 0 ? list[index] : null;
  const close = () => router.canGoBack() && router.back();

  const move = (by: -1 | 1) => {
    const ids = list.map((p) => p.id);
    const to = index + by;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    reorder.mutate(ids);
  };

  const askRemove = () => {
    const removeIt = () => remove.mutate(id, { onSuccess: close });
    if (Platform.OS === 'web') {
      if (globalThis.confirm(t('business.photos.removeConfirm'))) removeIt();
      return;
    }
    Alert.alert(t('business.photos.removeTitle'), t('business.photos.removeConfirm'), [
      { text: t('business.photos.keep'), style: 'cancel' },
      { text: t('business.photos.remove'), style: 'destructive', onPress: removeIt },
    ]);
  };

  const failed = [cover, tag, reorder, remove].find((m) => m.isError);

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader onClose={close} />
      {photos.isPending ? (
        <StateView state="loading" />
      ) : !photo ? (
        <StateView state="empty" icon="images-outline" message={t('business.photos.gone')} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Image
            source={{ uri: photo.url.medium }}
            placeholder={photo.blurhash ? { blurhash: photo.blurhash } : undefined}
            contentFit="contain"
            style={[styles.photo, { aspectRatio: photo.width / Math.max(photo.height, 1) }]}
            accessibilityLabel={t('business.photos.tileLabel', {
              number: index + 1,
              total: list.length,
            })}
          />
          <AppText variant="label" weight={500} color="text2" style={styles.center}>
            {t('business.photos.position', { number: index + 1, total: list.length })}
          </AppText>

          {photo.isCover ? (
            <View style={styles.isCover}>
              <Icon name="star" size={20} color={Colors.primary} />
              <AppText weight={600} color="primary">
                {t('business.photos.isCover')}
              </AppText>
            </View>
          ) : (
            <Button
              icon="star-outline"
              label={t('business.photos.makeCover')}
              loading={cover.isPending}
              onPress={() => cover.mutate(id)}
            />
          )}

          <View style={styles.row}>
            <Button
              variant="secondary"
              icon="arrow-back"
              label={t('business.photos.earlier')}
              disabled={index === 0}
              onPress={() => move(-1)}
              style={styles.half}
            />
            <Button
              variant="secondary"
              icon="arrow-forward"
              label={t('business.photos.later')}
              disabled={index === list.length - 1}
              onPress={() => move(1)}
              style={styles.half}
            />
          </View>

          <View style={styles.section}>
            <AppText variant="heading" accessibilityRole="header">
              {t('business.photos.whichEvent')}
            </AppText>
            <AppText color="text2">{t('business.photos.whichEventHint')}</AppText>
            <View style={styles.chips}>
              <Chip
                role="radio"
                label={t('business.photos.noEvent')}
                selected={photo.eventSlug === null}
                onPress={() => tag.mutate({ mediaId: id, eventSlug: null })}
              />
              {events.map((event) => (
                <Chip
                  key={event.slug}
                  role="radio"
                  label={event.name}
                  selected={photo.eventSlug === event.slug}
                  onPress={() => tag.mutate({ mediaId: id, eventSlug: event.slug })}
                />
              ))}
            </View>
          </View>

          {failed?.error && (
            <FieldError
              message={t(`business.photos.problems.${photoProblem(failed.error)}`, {
                count: 1,
                max: 60,
              })}
            />
          )}

          <Button
            variant="danger"
            icon="trash-outline"
            label={t('business.photos.remove')}
            loading={remove.isPending}
            onPress={askRemove}
          />
        </ScrollView>
      )}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  content: {
    gap: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  photo: {
    width: '100%',
    maxHeight: 420,
    borderRadius: Radius.photo,
    borderCurve: 'continuous',
  },
  center: {
    textAlign: 'center',
  },
  isCover: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 48,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  half: {
    flexGrow: 1,
    flexBasis: 140,
  },
  section: {
    gap: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
}));
