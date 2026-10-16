import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Checkbox } from '@/components/checkbox';
import { Chip } from '@/components/chip';
import { FieldError } from '@/components/field-error';
import { Icon, type IconName } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { TextField } from '@/components/text-field';
import { Radius, Spacing, useColors } from '@/constants/theme';
import { useIsVendor } from '@/data/chat';
import { clipProblem, REEL_MAX_SECONDS } from '@/data/reels';
import { storyErrorKind, usePostStory } from '@/data/stories';
import { useSession } from '@/features/auth/session';
import { preparePhoto } from '@/features/chat/chat-photo';
import { askMediaAccess, type MediaSource } from '@/features/reels/media-access';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';
import { saveToPhotos } from '@/lib/save-to-photos';
import { supabase } from '@/lib/supabase';

type Picked = {
  kind: 'photo' | 'video';
  uri: string;
  mimeType: string;
  durationMs: number | null;
  width: number;
  height: number;
};

type Pick = 'photo' | 'video' | 'camera';
const PICKS: { pick: Pick; icon: IconName }[] = [
  { pick: 'photo', icon: 'images-outline' },
  { pick: 'video', icon: 'film-outline' },
  { pick: 'camera', icon: 'camera-outline' },
];

// Full-quality recordings run about a megabyte a second; uploads stop at 50
const CAMERA_MAX_SECONDS = 30;

/**
 * Add to your story (a sheet, signed in): a photo or a clip of up to a
 * minute from the camera roll, or one taken now (also kept in Photos). Each
 * asks for access only when tapped; after a no, it offers Settings. Then an
 * optional caption, who it's from (vendors), and that everyone in it is okay
 * with it. It shows on Reels for 24 hours.
 */
export default function PostStoryScreen() {
  const Colors = useColors();
  const { t } = useLocale();
  const { requireSignIn } = useSession();
  const { vendorIds } = useIsVendor();
  const post = usePostStory();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [caption, setCaption] = useState('');
  const [asVendor, setAsVendor] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [consentMissing, setConsentMissing] = useState(false);
  const [blocked, setBlocked] = useState<MediaSource | null>(null);
  const [stage, setStage] = useState<'idle' | 'reading' | 'posting'>('idle');
  const [error, setError] = useState<string>();
  const busy = stage !== 'idle';

  const player = useVideoPlayer(picked?.kind === 'video' ? picked.uri : null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  // The businesses they belong to, to post as one of them (as post-reel does)
  const businesses = useQuery({
    queryKey: ['reels', 'my-businesses', vendorIds.join(',')],
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from('vendors')
        .select('id, name')
        .in('id', vendorIds);
      if (e) throw e;
      return data;
    },
    enabled: vendorIds.length > 0,
  });

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace('/discover');
  }

  function close() {
    if (busy) return;
    if (!picked) {
      leave();
      return;
    }
    if (Platform.OS === 'web') {
      if (globalThis.confirm(`${t('postStory.discardTitle')}\n\n${t('postStory.discardBody')}`))
        leave();
      return;
    }
    Alert.alert(t('postStory.discardTitle'), t('postStory.discardBody'), [
      { text: t('postReel.keepEditing'), style: 'cancel' },
      { text: t('postReel.discard'), style: 'destructive', onPress: leave },
    ]);
  }

  async function pick(choice: Pick) {
    setError(undefined);
    const source: MediaSource = choice === 'camera' ? 'camera' : 'library';
    const access = await askMediaAccess(source);
    if (access !== 'granted') {
      setBlocked(access === 'blocked' ? source : null);
      if (access === 'denied') {
        setError(source === 'library' ? t('postStory.needLibrary') : t('postStory.needCamera'));
      }
      return;
    }
    setBlocked(null);
    let result: ImagePicker.ImagePickerResult;
    try {
      result =
        choice === 'photo'
          ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] })
          : choice === 'video'
            ? await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['videos'],
                // The phone's trimmer; anything longer than the limit must be trimmed
                allowsEditing: true,
                videoMaxDuration: REEL_MAX_SECONDS,
                // 720p H.264: small enough to send, plays on every phone
                videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
              })
            : // No editing: on iPhones it would crop a photo square
              await ImagePicker.launchCameraAsync({
                mediaTypes: ['images', 'videos'],
                videoMaxDuration: CAMERA_MAX_SECONDS,
              });
    } catch {
      setError(
        source === 'library' ? t('postStory.cantOpenLibrary') : t('postReel.cantOpenCamera'),
      );
      return;
    }
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const kind = asset.type === 'video' ? 'video' : 'photo';
    if (kind === 'video') {
      const problem = clipProblem({
        durationMs: asset.duration ?? null,
        fileSize: asset.fileSize ?? null,
        mimeType: asset.mimeType ?? 'video/mp4',
      });
      if (problem) {
        setError(t(`postReel.problems.${problem}`, { seconds: REEL_MAX_SECONDS }));
        return;
      }
    }
    selectionHaptic();
    setPicked({
      kind,
      uri: asset.uri,
      mimeType: asset.mimeType ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
      durationMs: asset.duration ?? null,
      width: asset.width,
      height: asset.height,
    });
    if (choice === 'camera') void saveToPhotos(asset.uri);
  }

  function tryShare() {
    if (!picked || busy) return;
    if (!consent) {
      setConsentMissing(true);
      return;
    }
    requireSignIn(() => void send(picked));
  }

  async function send(chosen: Picked) {
    setError(undefined);
    setStage('reading');
    try {
      let file: { bytes: ArrayBuffer; mimeType: string };
      let thumb: ArrayBuffer | null = null;
      let size = { width: chosen.width || null, height: chosen.height || null };
      if (chosen.kind === 'photo') {
        // Shrunk and saved as a JPEG, which also turns an iPhone's HEIC into one
        const photo = await preparePhoto(chosen);
        file = { bytes: photo.bytes, mimeType: 'image/jpeg' };
        size = { width: photo.width, height: photo.height };
      } else {
        file = { bytes: await new File(chosen.uri).arrayBuffer(), mimeType: chosen.mimeType };
        try {
          const time = Math.min(1000, (chosen.durationMs ?? 0) / 2);
          const still = await VideoThumbnails.getThumbnailAsync(chosen.uri, { time, quality: 0.7 });
          thumb = await new File(still.uri).arrayBuffer();
        } catch {
          // Without a still the ring shows the poster's initials
        }
      }
      setStage('posting');
      await post.mutateAsync({
        kind: chosen.kind,
        file,
        thumb,
        durationS: chosen.kind === 'video' ? (chosen.durationMs ?? 0) / 1000 || 1 : null,
        ...size,
        caption,
        asVendorId: asVendor,
        consent,
      });
      successHaptic();
      leave();
    } catch (e) {
      setError(t(`postStory.errors.${storyErrorKind(e)}`));
      setStage('idle');
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      {/* No swiping the sheet away halfway through an upload */}
      <Stack.Screen options={{ gestureEnabled: !busy && !picked }} />
      <SheetHeader onClose={close} title={t('postStory.title')} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {!picked ? (
          <>
            <AppText variant="heading" weight={700}>
              {t('postStory.heading')}
            </AppText>
            <View style={styles.pickers}>
              {PICKS.map(({ pick: choice, icon }) => (
                <Pressable
                  key={choice}
                  accessibilityRole="button"
                  onPress={() => void pick(choice)}
                  style={({ pressed }) => [
                    styles.picker,
                    { backgroundColor: Colors.surface },
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon name={icon} size={36} color={Colors.primary} />
                  <AppText weight={600} style={styles.centerText}>
                    {t(`postStory.${choice}`)}
                  </AppText>
                </Pressable>
              ))}
            </View>
            <AppText color="text2">{t('postStory.lasts')}</AppText>
            <AppText variant="label" weight={400} color="text2">
              {t('postStory.privacy', { seconds: REEL_MAX_SECONDS })}
            </AppText>
            {blocked && (
              <View style={[styles.blocked, { backgroundColor: Colors.surface }]}>
                <Icon
                  name={blocked === 'library' ? 'images-outline' : 'camera-outline'}
                  size={28}
                  color={Colors.text2}
                />
                <AppText weight={600}>
                  {blocked === 'library'
                    ? t('postStory.blockedLibrary')
                    : t('postReel.blockedCamera')}
                </AppText>
                <Button
                  variant="secondary"
                  icon="settings-outline"
                  label={t('postReel.openSettings')}
                  onPress={() => void Linking.openSettings()}
                />
              </View>
            )}
            {error && <FieldError message={error} />}
          </>
        ) : (
          <>
            <View style={styles.previewRow}>
              <View style={styles.preview}>
                {picked.kind === 'video' ? (
                  <VideoView
                    player={player}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    nativeControls={false}
                  />
                ) : (
                  <Image
                    source={{ uri: picked.uri }}
                    contentFit="cover"
                    accessible={false}
                    style={StyleSheet.absoluteFill}
                  />
                )}
              </View>
              <View style={styles.previewText}>
                <AppText weight={600}>
                  {picked.kind === 'video' ? t('postStory.yourClip') : t('postStory.yourPhoto')}
                </AppText>
                <AppText variant="label" weight={400} color="text2">
                  {t('postStory.showsFor')}
                </AppText>
                <Button
                  variant="text"
                  label={t('postStory.change')}
                  disabled={busy}
                  onPress={() => setPicked(null)}
                />
              </View>
            </View>

            <TextField
              label={t('postReel.caption')}
              placeholder={t('postStory.captionPlaceholder')}
              value={caption}
              onChangeText={setCaption}
              maxLength={200}
              multiline
            />

            {(businesses.data ?? []).length > 0 && (
              <View style={styles.group}>
                <AppText weight={600}>{t('postReel.postAs')}</AppText>
                <View style={styles.chips} accessibilityRole="radiogroup">
                  <Chip
                    role="radio"
                    label={t('postReel.myself')}
                    selected={asVendor === null}
                    onPress={() => setAsVendor(null)}
                  />
                  {(businesses.data ?? []).map((b) => (
                    <Chip
                      key={b.id}
                      role="radio"
                      label={b.name}
                      selected={asVendor === b.id}
                      onPress={() => setAsVendor(b.id)}
                    />
                  ))}
                </View>
              </View>
            )}

            <Checkbox
              label={t('postStory.consent')}
              checked={consent}
              onChange={(on) => {
                setConsent(on);
                if (on) setConsentMissing(false);
              }}
              error={consentMissing ? t('postStory.errors.consent') : undefined}
            />
            <AppText variant="label" weight={400} color="text2">
              {t('postStory.rules')}
            </AppText>

            {error && <FieldError message={error} />}
            <Button
              icon="arrow-up-circle"
              label={
                stage === 'reading'
                  ? t('postStory.preparing')
                  : stage === 'posting'
                    ? t('postReel.uploading')
                    : t('postStory.share')
              }
              loading={busy}
              onPress={tryShare}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  pickers: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  picker: {
    flex: 1,
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  pressed: {
    opacity: 0.6,
  },
  centerText: {
    textAlign: 'center',
  },
  blocked: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  previewRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    alignItems: 'center',
  },
  preview: {
    width: 108,
    height: 192,
    borderRadius: Radius.photo,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  previewText: {
    flex: 1,
    gap: Spacing.xs,
    alignItems: 'flex-start',
  },
  group: {
    gap: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
});
