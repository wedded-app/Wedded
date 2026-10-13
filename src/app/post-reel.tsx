import { useQuery } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Checkbox } from '@/components/checkbox';
import { Chip } from '@/components/chip';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { SheetHeader } from '@/components/sheet-header';
import { TextField } from '@/components/text-field';
import { Radius, Spacing, useColors } from '@/constants/theme';
import { useIsVendor } from '@/data/chat';
import { useHomeEvents } from '@/data/reference';
import {
  clipProblem,
  postErrorKind,
  REEL_MAX_SECONDS,
  usePostLinkedReel,
  usePostReel,
} from '@/data/reels';
import { useVendorSearch } from '@/data/search';
import { useSession } from '@/features/auth/session';
import { askMediaAccess, type MediaSource } from '@/features/reels/media-access';
import { type ReelLink, reelLinkErrorKind, resolveReelLink } from '@/features/reels/reel-link';
import { useDebouncedValue, vendorQuery } from '@/features/search/vendor-query';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';
import { saveToPhotos } from '@/lib/save-to-photos';
import { supabase } from '@/lib/supabase';

type Clip = {
  uri: string;
  mimeType: string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  /** Recorded here and kept in the phone's Photos. */
  savedToPhotos: boolean;
};

const MAX_TAGS = 10;
// Full-quality recordings run about a megabyte a second; uploads stop at 50
const CAMERA_MAX_SECONDS = 30;

/**
 * Post a reel (a sheet, signed in). First a clip: chosen from the camera roll
 * (the phone trims anything over a minute and makes it small enough to send)
 * or recorded here, which also keeps it in Photos. Each asks for access only
 * when tapped, after saying why; after a no, it offers Settings. Or a pasted
 * TikTok or Instagram link (B5): nothing uploads, it plays in the platform's
 * own player and credits whoever made it. Then a
 * caption, the event, the vendors who made the day (searched by name), who
 * it's posted as (vendors), and that everyone in it is okay with it.
 */
export default function PostReelScreen() {
  const Colors = useColors();
  const { t, locale } = useLocale();
  const { requireSignIn } = useSession();
  const events = useHomeEvents();
  const { vendorIds } = useIsVendor();
  const post = usePostReel();
  const postLinked = usePostLinkedReel();
  const [clip, setClip] = useState<Clip | null>(null);
  const [link, setLink] = useState<ReelLink | null>(null);
  const [pasting, setPasting] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [checking, setChecking] = useState(false);
  const [caption, setCaption] = useState('');
  const [eventSlug, setEventSlug] = useState<string | null>(null);
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [query, setQuery] = useState('');
  const [asVendor, setAsVendor] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [consentMissing, setConsentMissing] = useState(false);
  const [blocked, setBlocked] = useState<MediaSource | null>(null);
  const [stage, setStage] = useState<'idle' | 'reading' | 'posting'>('idle');
  const [error, setError] = useState<string>();
  const [allEvents, setAllEvents] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const search = useRef<TextInput>(null);
  const tagsY = useRef(0);
  const busy = stage !== 'idle';
  const chosen = clip !== null || link !== null;

  // Searching for a vendor brings the section to the top, so the matches show
  // above the keyboard. After the keyboard is up, since iOS scrolls on its own
  // to keep the field in view while it opens.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (search.current && TextInput.State.currentlyFocusedInput() === search.current) {
        scroller.current?.scrollTo({ y: tagsY.current - Spacing.sm, animated: true });
      }
    });
    return () => sub.remove();
  }, []);

  const player = useVideoPlayer(clip?.uri ?? null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  // The businesses they belong to, to post as one of them
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

  const typed = vendorQuery(query);
  const needle = useDebouncedValue(typed);
  const found = useVendorSearch(
    { maxMiles: null, query: needle ?? undefined, limit: 6 },
    { enabled: needle !== null, keepPrevious: true },
  );

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace('/discover');
  }

  function close() {
    if (busy) return;
    if (!chosen) {
      leave();
      return;
    }
    if (Platform.OS === 'web') {
      if (globalThis.confirm(`${t('postReel.discardTitle')}\n\n${t('postReel.discardBody')}`))
        leave();
      return;
    }
    Alert.alert(t('postReel.discardTitle'), t('postReel.discardBody'), [
      { text: t('postReel.keepEditing'), style: 'cancel' },
      { text: t('postReel.discard'), style: 'destructive', onPress: leave },
    ]);
  }

  async function pick(source: MediaSource) {
    setError(undefined);
    const access = await askMediaAccess(source);
    if (access !== 'granted') {
      setBlocked(access === 'blocked' ? source : null);
      if (access === 'denied') {
        setError(source === 'library' ? t('postReel.needLibrary') : t('postReel.needCamera'));
      }
      return;
    }
    setBlocked(null);
    let result: ImagePicker.ImagePickerResult;
    try {
      result =
        source === 'library'
          ? await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['videos'],
              // The phone's trimmer; anything longer than the limit must be trimmed
              allowsEditing: true,
              videoMaxDuration: REEL_MAX_SECONDS,
              // 720p H.264: small enough to send, plays on every phone
              videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
            })
          : await ImagePicker.launchCameraAsync({
              mediaTypes: ['videos'],
              allowsEditing: true,
              videoMaxDuration: CAMERA_MAX_SECONDS,
            });
    } catch {
      setError(source === 'library' ? t('postReel.cantOpenLibrary') : t('postReel.cantOpenCamera'));
      return;
    }
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const problem = clipProblem({
      durationMs: asset.duration ?? null,
      fileSize: asset.fileSize ?? null,
      mimeType: asset.mimeType ?? 'video/mp4',
    });
    if (problem) {
      setError(t(`postReel.problems.${problem}`, { seconds: REEL_MAX_SECONDS }));
      return;
    }
    selectionHaptic();
    setClip({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'video/mp4',
      durationMs: asset.duration ?? null,
      width: asset.width || null,
      height: asset.height || null,
      savedToPhotos: false,
    });
    if (source === 'camera') {
      const saved = await saveToPhotos(asset.uri);
      if (saved) setClip((c) => (c?.uri === asset.uri ? { ...c, savedToPhotos: true } : c));
    }
  }

  // A pasted link: the full post address, asking TikTok for short links
  async function takeLink() {
    if (checking) return;
    setError(undefined);
    setChecking(true);
    try {
      const found = await resolveReelLink(linkText);
      selectionHaptic();
      setLink(found);
      setPasting(false);
    } catch (e) {
      setError(t(`postReel.linkErrors.${reelLinkErrorKind(e)}`));
    } finally {
      setChecking(false);
    }
  }

  function tryPost() {
    if (!chosen || busy) return;
    if (!consent) {
      setConsentMissing(true);
      return;
    }
    // Signed out (a shared link), Post signs in first, then posts
    requireSignIn(() => void (link ? sendLink(link) : clip && send(clip)));
  }

  async function sendLink(pasted: ReelLink) {
    setError(undefined);
    setStage('posting');
    try {
      await postLinked.mutateAsync({
        link: pasted,
        caption,
        eventSlug,
        vendorIds: tags.map((v) => v.id),
        asVendorId: asVendor,
        consent,
      });
      successHaptic();
      leave();
    } catch (e) {
      setError(t(`postReel.errors.${postErrorKind(e)}`));
      setStage('idle');
    }
  }

  async function send(picked: Clip) {
    setError(undefined);
    setStage('reading');
    try {
      const bytes = await new File(picked.uri).arrayBuffer();
      let thumb: ArrayBuffer | null = null;
      try {
        const time = Math.min(1000, (picked.durationMs ?? 0) / 2);
        const still = await VideoThumbnails.getThumbnailAsync(picked.uri, { time, quality: 0.7 });
        thumb = await new File(still.uri).arrayBuffer();
      } catch {
        // Without a still the reel shows black until it starts playing
      }
      setStage('posting');
      await post.mutateAsync({
        video: { bytes, mimeType: picked.mimeType },
        thumb,
        durationS: (picked.durationMs ?? 0) / 1000 || 1,
        width: picked.width,
        height: picked.height,
        caption,
        eventSlug,
        vendorIds: tags.map((v) => v.id),
        asVendorId: asVendor,
        consent,
      });
      successHaptic();
      leave();
    } catch (e) {
      setError(t(`postReel.errors.${postErrorKind(e)}`));
      setStage('idle');
    }
  }

  // The family's main events, like Home; the rest behind "More events"
  const everyEvent = (events.data ?? [])
    .filter((section) => section.phase !== 'whole_wedding')
    .flatMap((section) => section.events);
  const mainEvents = everyEvent.filter((event) => event.isCore || event.slug === eventSlug);
  const eventOptions = allEvents ? everyEvent : mainEvents;
  const results = (found.data ?? []).filter((v) => !tags.some((x) => x.id === v.id));

  return (
    <Screen edges={['top', 'bottom']}>
      {/* No swiping the sheet away halfway through an upload */}
      <Stack.Screen options={{ gestureEnabled: !busy && !chosen }} />
      <SheetHeader onClose={close} title={t('postReel.title')} />
      <ScrollView
        ref={scroller}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {!chosen ? (
          <>
            <AppText variant="heading" weight={700}>
              {t('postReel.heading')}
            </AppText>
            <View style={styles.pickers}>
              {(['library', 'camera'] as const).map((source) => (
                <Pressable
                  key={source}
                  accessibilityRole="button"
                  onPress={() => void pick(source)}
                  style={({ pressed }) => [
                    styles.picker,
                    { backgroundColor: Colors.surface },
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon
                    name={source === 'library' ? 'images-outline' : 'videocam-outline'}
                    size={36}
                    color={Colors.primary}
                  />
                  <AppText weight={600} style={styles.centerText}>
                    {source === 'library' ? t('postReel.fromLibrary') : t('postReel.record')}
                  </AppText>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: pasting }}
                onPress={() => {
                  setError(undefined);
                  setPasting((open) => !open);
                }}
                style={({ pressed }) => [
                  styles.picker,
                  { backgroundColor: Colors.surface },
                  pasting && { borderColor: Colors.primary, borderWidth: 2 },
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="link-outline" size={36} color={Colors.primary} />
                <AppText weight={600} style={styles.centerText}>
                  {t('postReel.pasteLink')}
                </AppText>
              </Pressable>
            </View>
            {pasting && (
              <View style={styles.group}>
                <TextField
                  label={t('postReel.linkLabel')}
                  placeholder="https://www.tiktok.com/@…"
                  value={linkText}
                  onChangeText={(text) => {
                    setLinkText(text);
                    setError(undefined);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="go"
                  onSubmitEditing={() => void takeLink()}
                  autoFocus
                />
                <AppText variant="label" weight={400} color="text2">
                  {t('postReel.linkHint')}
                </AppText>
                <Button
                  icon="checkmark-circle"
                  label={checking ? t('postReel.linkChecking') : t('postReel.useLink')}
                  loading={checking}
                  disabled={linkText.trim().length === 0}
                  onPress={() => void takeLink()}
                />
              </View>
            )}
            <AppText color="text2">{t('postReel.privacy')}</AppText>
            <AppText variant="label" weight={400} color="text2">
              {t('postReel.limits', { seconds: REEL_MAX_SECONDS })}
            </AppText>
            {blocked && (
              <View style={[styles.blocked, { backgroundColor: Colors.surface }]}>
                <Icon
                  name={blocked === 'library' ? 'images-outline' : 'videocam-outline'}
                  size={28}
                  color={Colors.text2}
                />
                <AppText weight={600}>
                  {blocked === 'library'
                    ? t('postReel.blockedLibrary')
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
            {link ? (
              <View style={[styles.linkPreview, { backgroundColor: Colors.surface }]}>
                <Icon
                  name={link.platform === 'instagram' ? 'logo-instagram' : 'logo-tiktok'}
                  size={36}
                  color={Colors.text}
                />
                <View style={[styles.grow, styles.previewText]}>
                  <AppText weight={600}>
                    {link.handle
                      ? t('postReel.linkBy', {
                          name: `@${link.handle}`,
                          platform: link.platform === 'instagram' ? 'Instagram' : 'TikTok',
                        })
                      : t('postReel.linkFrom', {
                          platform: link.platform === 'instagram' ? 'Instagram' : 'TikTok',
                        })}
                  </AppText>
                  <AppText variant="label" weight={400} color="text2">
                    {t('postReel.linkCredit')}
                  </AppText>
                  <Button
                    variant="text"
                    label={t('postReel.changeLink')}
                    disabled={busy}
                    onPress={() => {
                      setLink(null);
                      setPasting(true);
                    }}
                  />
                </View>
              </View>
            ) : clip ? (
              <View style={styles.previewRow}>
                <View style={styles.preview}>
                  <VideoView
                    player={player}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    nativeControls={false}
                  />
                </View>
                <View style={[styles.grow, styles.previewText]}>
                  <AppText weight={600}>{t('postReel.chosen')}</AppText>
                  {clip.durationMs ? (
                    <AppText variant="label" weight={400} color="text2">
                      {t('postReel.seconds', {
                        seconds: Math.max(1, Math.round(clip.durationMs / 1000)),
                      })}
                    </AppText>
                  ) : null}
                  {clip.savedToPhotos && (
                    <View style={styles.saved}>
                      <Icon name="checkmark-circle" size={18} color={Colors.success} />
                      <AppText variant="label" weight={400} color="text2">
                        {t('postReel.savedToPhotos')}
                      </AppText>
                    </View>
                  )}
                  <Button
                    variant="text"
                    label={t('postReel.change')}
                    disabled={busy}
                    onPress={() => setClip(null)}
                  />
                </View>
              </View>
            ) : null}

            <TextField
              label={t('postReel.caption')}
              placeholder={t('postReel.captionPlaceholder')}
              value={caption}
              onChangeText={setCaption}
              maxLength={300}
              multiline
            />

            {eventOptions.length > 0 && (
              <View style={styles.group}>
                <AppText weight={600}>{t('postReel.whichEvent')}</AppText>
                <View style={styles.chips} accessibilityRole="radiogroup">
                  {eventOptions.map((event) => (
                    <Chip
                      key={event.slug}
                      role="radio"
                      label={localized(event.name, locale)}
                      selected={eventSlug === event.slug}
                      onPress={() => setEventSlug(eventSlug === event.slug ? null : event.slug)}
                    />
                  ))}
                  {!allEvents && mainEvents.length < everyEvent.length && (
                    <Chip
                      role="button"
                      label={t('postReel.moreEvents')}
                      onPress={() => setAllEvents(true)}
                    />
                  )}
                </View>
              </View>
            )}

            <View
              style={styles.group}
              onLayout={(e) => {
                tagsY.current = e.nativeEvent.layout.y;
              }}
            >
              <AppText weight={600}>{t('postReel.tagTitle')}</AppText>
              <AppText variant="label" weight={400} color="text2">
                {t('postReel.tagHint')}
              </AppText>
              {tags.length > 0 && (
                <View style={styles.chips}>
                  {tags.map((v) => (
                    <Chip
                      key={v.id}
                      selected
                      label={v.name}
                      accessibilityLabel={t('postReel.untag', { name: v.name })}
                      onPress={() => setTags(tags.filter((x) => x.id !== v.id))}
                    />
                  ))}
                </View>
              )}
              {tags.length < MAX_TAGS && (
                <SearchField
                  ref={search}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('postReel.tagSearch')}
                />
              )}
              {tags.length < MAX_TAGS &&
                typed !== null &&
                results.map((v) => (
                  <Pressable
                    key={v.id}
                    accessibilityRole="button"
                    accessibilityLabel={t('postReel.tag', { name: localized(v.name, locale) })}
                    onPress={() => {
                      selectionHaptic();
                      setTags([...tags, { id: v.id, name: localized(v.name, locale) }]);
                      setQuery('');
                    }}
                    style={({ pressed }) => [
                      styles.result,
                      { backgroundColor: Colors.surface },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Icon name="storefront-outline" size={22} color={Colors.primary} />
                    <View style={styles.grow}>
                      <AppText weight={600} numberOfLines={1}>
                        {localized(v.name, locale)}
                      </AppText>
                      <AppText variant="label" weight={400} color="text2" numberOfLines={1}>
                        {[v.category ? localized(v.category, locale) : null, v.city]
                          .filter(Boolean)
                          .join(' · ')}
                      </AppText>
                    </View>
                    <Icon name="add-circle" size={26} color={Colors.primary} />
                  </Pressable>
                ))}
              {tags.length < MAX_TAGS &&
                needle !== null &&
                found.isSuccess &&
                results.length === 0 && (
                  <AppText variant="label" weight={400} color="text2">
                    {t('postReel.noVendorFound')}
                  </AppText>
                )}
            </View>

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
              label={t('postReel.consent')}
              checked={consent}
              onChange={(on) => {
                setConsent(on);
                if (on) setConsentMissing(false);
              }}
              error={consentMissing ? t('postReel.errors.consent') : undefined}
            />
            <AppText variant="label" weight={400} color="text2">
              {t('postReel.rules')}
            </AppText>

            {error && <FieldError message={error} />}
            <Button
              icon="arrow-up-circle"
              label={
                stage === 'reading'
                  ? t('postReel.preparing')
                  : stage === 'posting'
                    ? t('postReel.uploading')
                    : t('postReel.post')
              }
              loading={busy}
              onPress={tryPost}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  linkPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
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
  grow: {
    flex: 1,
  },
  previewText: {
    gap: Spacing.xs,
    alignItems: 'flex-start',
  },
  saved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  group: {
    gap: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 60,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
});
