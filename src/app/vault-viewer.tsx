import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, useFontScale } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useHideVaultItem, useRemoveVaultItem, useVault, useVaultItems } from '@/data/memory-vault';
import { saveMediaToPhotos } from '@/features/vault/save-media';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

/**
 * A Memory Vault's photos and videos full screen on black: swipe sideways,
 * "3 / 48", who added it, Save to Photos. Whoever added one can delete it;
 * the couple can also hide any from guests. Close is always visible, as in
 * the vendor gallery. /vault-viewer?id={vault}&event={event id or ''}&index=…
 */
export default function VaultViewerScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useLocale();
  const scale = Math.min(useFontScale('body'), 1.4);
  const {
    id = '',
    event = '',
    index = '0',
  } = useLocalSearchParams<{
    id: string;
    event?: string;
    index?: string;
  }>();
  const vault = useVault(id).data;
  const items = useVaultItems(id, event || null);
  const remove = useRemoveVaultItem(id);
  const hide = useHideVaultItem(id);
  const list = items.data?.pages.flat() ?? [];
  const start = Math.max(0, Number(index) || 0);
  const [current, setCurrent] = useState(start);
  const [page, setPage] = useState({ width: 0, height: 0 });
  const [saved, setSaved] = useState<'saving' | 'saved' | 'failed' | null>(null);
  const width = page.width;

  const close = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  const at = Math.min(current, Math.max(0, list.length - 1));
  const item = list[at];
  const couple = vault?.role === 'couple';
  const mine = !!item && item.isMine;

  // Deleting the last one left closes the viewer
  useEffect(() => {
    if (items.isSuccess && list.length === 0) close();
    // close only depends on the router
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.isSuccess, list.length]);

  const save = async () => {
    if (!item) return;
    setSaved('saving');
    const ok = await saveMediaToPhotos(item);
    setSaved(ok ? 'saved' : 'failed');
    if (ok) successHaptic();
  };

  const askDelete = () => {
    if (!item) return;
    const doIt = () => remove.mutate(item.id);
    const body = t(item.kind === 'video' ? 'memoryVault.deleteVideo' : 'memoryVault.deletePhoto');
    if (Platform.OS === 'web') {
      if (globalThis.confirm(body)) doIt();
      return;
    }
    Alert.alert(body, t('memoryVault.deleteBody'), [
      { text: t('memoryVault.cancel'), style: 'cancel' },
      { text: t('memoryVault.delete'), style: 'destructive', onPress: doIt },
    ]);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('gallery.close')}
          onPress={close}
          style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
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
            {`${at + 1} / ${list.length}${items.hasNextPage ? '+' : ''}`}
          </AppText>
        )}
      </View>

      <View
        style={styles.list}
        onLayout={(e) => {
          const { width: w, height: h } = e.nativeEvent.layout;
          setPage({ width: w, height: h });
        }}
      >
        {items.isPending ? (
          <StateView state="loading" />
        ) : items.isError ? (
          <StateView state="error" onRetry={() => void items.refetch()} />
        ) : width === 0 ? null : (
          <FlatList
            data={list}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={at}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            keyExtractor={(it) => it.id}
            onMomentumScrollEnd={(e) => {
              setCurrent(Math.round(e.nativeEvent.contentOffset.x / width));
              setSaved(null);
            }}
            onEndReached={() => {
              if (items.hasNextPage && !items.isFetchingNextPage) void items.fetchNextPage();
            }}
            renderItem={({ item: it, index: i }) => (
              <View style={{ width, height: page.height }}>
                {it.kind === 'video' && Math.abs(i - at) <= 1 ? (
                  <VaultVideo url={it.url} playing={i === at} />
                ) : (
                  <Image
                    source={{ uri: it.kind === 'video' ? it.thumbUrl : it.url }}
                    placeholder={{ uri: it.thumbUrl }}
                    contentFit="contain"
                    accessible
                    accessibilityLabel={t(
                      it.kind === 'video' ? 'memoryVault.videoLabel' : 'memoryVault.photoLabel',
                      { number: i + 1, name: it.addedByName ?? t('memoryVault.someone') },
                    )}
                    style={styles.photo}
                  />
                )}
              </View>
            )}
            style={styles.list}
          />
        )}
      </View>

      {item && (
        <View style={styles.bottom}>
          <AppText color="onPrimary">
            {item.addedByName
              ? t('memoryVault.addedBy', { name: item.addedByName })
              : t('memoryVault.addedBySomeone')}
            {item.hidden ? ` · ${t('memoryVault.hiddenTag')}` : ''}
          </AppText>
          <View style={styles.actions}>
            {Platform.OS !== 'web' && (
              <ViewerAction
                icon={saved === 'saved' ? 'checkmark' : 'arrow-down-circle-outline'}
                label={
                  saved === 'saving'
                    ? t('memoryVault.savingOne')
                    : saved === 'saved'
                      ? t('memoryVault.savedOne')
                      : t('memoryVault.save')
                }
                onPress={() => void save()}
                disabled={saved === 'saving'}
              />
            )}
            {couple && (
              <ViewerAction
                icon={item.hidden ? 'eye-outline' : 'eye-off-outline'}
                label={item.hidden ? t('memoryVault.unhide') : t('memoryVault.hide')}
                onPress={() => hide.mutate({ itemId: item.id, hidden: !item.hidden })}
                disabled={hide.isPending}
              />
            )}
            {(mine || couple) && (
              <ViewerAction
                icon="trash-outline"
                label={t('memoryVault.delete')}
                onPress={askDelete}
                disabled={remove.isPending}
              />
            )}
          </View>
          {saved === 'failed' && (
            <AppText color="onPrimary" weight={600}>
              {t('memoryVault.saveFailed', { count: 1 })}
            </AppText>
          )}
          {(remove.isError || hide.isError) && (
            <AppText color="onPrimary" weight={600}>
              {t('states.error')}
            </AppText>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

/** The video on screen plays (muted until they turn the sound on); the ones beside it wait. */
function VaultVideo({ url, playing }: { url: string; playing: boolean }) {
  const player = useVideoPlayer(url, (p) => {
    p.muted = true;
  });
  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [playing, player]);
  return (
    <VideoView
      player={player}
      style={{ flex: 1 }}
      contentFit="contain"
      nativeControls
      allowsPictureInPicture={false}
    />
  );
}

/** A dark glass capsule with an icon and a word, sized for older fingers. */
function ViewerAction({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, pressed && styles.pillPressed, disabled && styles.dim]}
    >
      <Icon name={icon} size={Sizes.iconSmall} color={Colors.onPrimary} />
      <AppText variant="button" color="onPrimary">
        {label}
      </AppText>
    </Pressable>
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
  pill: {
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
  pillPressed: {
    backgroundColor: 'rgba(120, 120, 128, 0.56)',
  },
  dim: {
    opacity: 0.5,
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
  bottom: {
    gap: Spacing.md,
    paddingHorizontal: Sizes.pageGutter,
    paddingVertical: Spacing.md,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
}));
