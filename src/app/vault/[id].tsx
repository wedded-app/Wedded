import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { FieldError } from '@/components/field-error';
import { GlassButton } from '@/components/glass-button';
import { Icon } from '@/components/icon';
import { ListRow, ListSection } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { ProgressBar } from '@/components/progress-bar';
import { StateView } from '@/components/state-view';
import { VaultIcon } from '@/components/vault-icon';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import {
  useAddVaultItems,
  useVault,
  useVaultItems,
  useVaultVendors,
  type AddVaultItemsResult,
  type MemoryVault,
  type VaultItem,
} from '@/data/memory-vault';
import { useCategories } from '@/data/reference';
import { shareInvite, useMyWeddings } from '@/data/wedding';
import { useSession } from '@/features/auth/session';
import { useStartPlanning } from '@/features/onboarding/start';
import { askMediaAccess } from '@/features/reels/media-access';
import { saveMediaToPhotos } from '@/features/vault/save-media';
import { useVaultLink } from '@/features/vault/use-vault-link';
import { todaysEvent, videoLength } from '@/features/vault/vault-helpers';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';
import { readSetting, StorageKeys, writeSetting } from '@/lib/storage';

// Enough for a whole evening's camera roll in one go, with the progress showing.
const PICK_LIMIT = 50;

type Progress = { done: number; total: number };

/**
 * The Memory Vault (#307): the photos and videos everyone at the wedding
 * took, by event. Everyone in it adds theirs (several at once, with "Adding 3
 * of 10") and saves any to their phone; the couple also hides any, changes
 * the settings and invites guests. /vault/{id}, with ?event= to open on one
 * event and ?add=1 to go straight to adding (a guest who just joined).
 */
export default function VaultScreen() {
  const { t } = useLocale();
  const { status, requireSignIn } = useSession();
  const params = useLocalSearchParams<{ id: string; event?: string; add?: string }>();
  const vault = useVault(params.id ?? '');

  let body;
  if (status !== 'signedIn' && status !== 'loading') {
    body = (
      <StateView
        state="empty"
        icon="lock-closed-outline"
        message={t('memoryVault.signIn')}
        action={{ label: t('profile.account.signIn'), onPress: () => requireSignIn(() => {}) }}
      />
    );
  } else if (vault.isPending) {
    body = <StateView state="loading" />;
  } else if (vault.isError) {
    body = <StateView state="error" onRetry={() => void vault.refetch()} />;
  } else if (!vault.data) {
    body = (
      <StateView
        state="empty"
        icon="lock-closed-outline"
        message={t('memoryVault.notFound')}
        action={{ label: t('common.goHome'), onPress: () => router.replace('/') }}
      />
    );
  }
  if (body || !vault.data) return <NavScreen title={t('memoryVault.title')}>{body}</NavScreen>;

  return <Vault vault={vault.data} startEvent={params.event} startAdding={params.add === '1'} />;
}

function Vault({
  vault,
  startEvent,
  startAdding,
}: {
  vault: MemoryVault;
  startEvent?: string;
  startAdding: boolean;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const couple = vault.role === 'couple';
  const canAdd = vault.canAdd;

  // Opens on the event asked for, else the one on today's date, else All
  const [chosenEvent, setChosenEvent] = useState<string | null | undefined>(
    startEvent || undefined,
  );
  const eventSlug =
    chosenEvent === undefined ? (todaysEvent(vault.events)?.slug ?? null) : chosenEvent;
  const event = vault.events.find((e) => e.slug === eventSlug);
  const items = useVaultItems(vault.id, eventSlug);
  const list = items.data?.pages.flat() ?? [];

  const add = useAddVaultItems(vault.id);
  const [adding, setAdding] = useState<Progress | null>(null);
  const [added, setAdded] = useState<AddVaultItemsResult | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [saving, setSaving] = useState<Progress | null>(null);
  const [saved, setSaved] = useState<{ saved: number; failed: number } | null>(null);
  const getLink = useVaultLink(vault.id);
  const [linkProblem, setLinkProblem] = useState<'failed' | 'copied' | null>(null);

  // A guest's first upload: once ever, a quiet invitation to plan their own
  const weddings = useMyWeddings();
  const [planCard, setPlanCard] = useState(false);
  const firstUpload = () => {
    if (couple || (weddings.data?.length ?? 0) > 0) return;
    if (readSetting(StorageKeys.vaultPlanCard)) return;
    setPlanCard(true);
    void writeSetting(StorageKeys.vaultPlanCard, 'shown');
  };

  const pick = async () => {
    setAdded(null);
    if (Platform.OS !== 'web') {
      const access = await askMediaAccess('library');
      setBlocked(access === 'blocked');
      if (access !== 'granted') return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: PICK_LIMIT,
      exif: true,
      quality: 1,
    });
    if (picked.canceled || picked.assets.length === 0) return;
    const chosen = picked.assets.slice(0, PICK_LIMIT);
    setAdding({ done: 0, total: chosen.length });
    try {
      const outcome = await add.mutateAsync({
        items: chosen,
        eventSlug,
        onProgress: (done, total) => setAdding({ done, total }),
      });
      if (outcome.added > 0) {
        successHaptic();
        firstUpload();
      }
      setAdded(outcome);
    } catch {
      setAdded({ added: 0, failed: chosen.length, problem: 'failed' });
    } finally {
      setAdding(null);
    }
  };

  // A guest who just joined goes straight to picking, once
  const startedAdding = useRef(false);
  useEffect(() => {
    if (!startAdding || !canAdd || startedAdding.current) return;
    startedAdding.current = true;
    void pick();
    // pick reads the latest state when it runs; this only needs to fire once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startAdding, canAdd]);

  const saveAll = async () => {
    setSaved(null);
    // Every page first, so "Save all" means all of them, not the ones scrolled to
    let result = items;
    while (result.hasNextPage && !result.isError) result = await result.fetchNextPage();
    const all = result.data?.pages.flat() ?? [];
    let done = 0;
    let failed = 0;
    setSaving({ done: 0, total: all.length });
    for (const item of all) {
      if (!(await saveMediaToPhotos(item))) failed++;
      done++;
      setSaving({ done, total: all.length });
    }
    setSaving(null);
    setSaved({ saved: done - failed, failed });
    if (done > failed) successHaptic();
  };

  const invite = async () => {
    setLinkProblem(null);
    const link = await getLink();
    if (!link) return setLinkProblem('failed');
    const outcome = await shareInvite(link, t, 'memoryVault.inviteMessage');
    if (outcome === 'copied') setLinkProblem('copied');
  };

  const count = t('memoryVault.count', { count: vault.itemCount });

  return (
    <NavScreen
      title={t('memoryVault.title')}
      subtitle={vault.title ? `${vault.title} · ${count}` : count}
      trailing={
        couple && (
          <GlassButton
            icon="settings-outline"
            accessibilityLabel={t('memoryVault.settings.title')}
            onPress={() => router.push({ pathname: '/vault-settings', params: { id: vault.id } })}
            size={44}
          />
        )
      }
    >
      <View style={styles.actions}>
        {adding ? (
          <View style={styles.progress} accessibilityLiveRegion="polite">
            <AppText weight={600}>
              {t('memoryVault.adding', {
                done: Math.min(adding.done + 1, adding.total),
                total: adding.total,
              })}
            </AppText>
            <ProgressBar
              value={adding.total > 0 ? adding.done / adding.total : 0}
              color={Colors.primary}
              trackColor={Colors.fill}
              height={8}
            />
          </View>
        ) : canAdd ? (
          <Button
            icon="images-outline"
            label={
              event
                ? t('memoryVault.addTo', { event: localized(event.name) })
                : t('memoryVault.add')
            }
            disabled={!!saving}
            onPress={() => void pick()}
          />
        ) : (
          <View style={styles.locked}>
            <Icon name="lock-closed-outline" size={20} color={Colors.text2} />
            <AppText color="text2" style={styles.grow}>
              {t('memoryVault.locked')}
            </AppText>
          </View>
        )}
        {added && added.added > 0 && (
          <AppText weight={600} color="success" accessibilityLiveRegion="polite">
            {t('memoryVault.added', { count: added.added })}
          </AppText>
        )}
        {added && added.failed > 0 && (
          <FieldError
            message={t(`memoryVault.problems.${added.problem ?? 'failed'}`, {
              count: added.failed,
            })}
          />
        )}
        {blocked && (
          <View style={styles.blocked}>
            <AppText color="text2">{t('memoryVault.blocked')}</AppText>
            <Button
              variant="secondary"
              label={t('business.photos.openSettings')}
              onPress={() => void Linking.openSettings()}
            />
          </View>
        )}
        {couple && (
          <Button
            variant="secondary"
            icon="share-outline"
            label={t('memoryVault.invite')}
            onPress={() => void invite()}
          />
        )}
        {linkProblem && (
          <AppText color={linkProblem === 'copied' ? 'success' : 'error'} weight={600}>
            {t(`memoryVault.link.${linkProblem}`)}
          </AppText>
        )}
        {!couple && !vault.guestsSeeAll && (
          <AppText variant="label" weight={400} color="text2">
            {t('memoryVault.onlyYours')}
          </AppText>
        )}
      </View>

      {planCard && <PlanCard />}

      {vault.events.length > 0 && (
        <View style={styles.chips} accessibilityRole="radiogroup">
          <Chip
            role="radio"
            label={t('memoryVault.allEvents')}
            selected={eventSlug === null}
            onPress={() => setChosenEvent(null)}
          />
          {vault.events.map((e) => (
            <Chip
              key={e.slug}
              role="radio"
              label={`${localized(e.name)} · ${e.count}`}
              selected={eventSlug === e.slug}
              onPress={() => setChosenEvent(e.slug)}
            />
          ))}
        </View>
      )}

      {items.isPending ? (
        <StateView state="loading" />
      ) : items.isError ? (
        <StateView state="error" onRetry={() => void items.refetch()} />
      ) : list.length === 0 ? (
        <StateView
          state="empty"
          icon="images-outline"
          message={
            event
              ? t('memoryVault.emptyEvent', { event: localized(event.name) })
              : t('memoryVault.empty')
          }
        />
      ) : (
        <View style={styles.block}>
          <View style={styles.grid}>
            {list.map((item, index) => (
              <Tile
                key={item.id}
                item={item}
                spoken={t(
                  item.kind === 'video' ? 'memoryVault.videoLabel' : 'memoryVault.photoLabel',
                  { number: index + 1, name: item.addedByName ?? t('memoryVault.someone') },
                )}
                onPress={() =>
                  router.push({
                    pathname: '/vault-viewer',
                    params: { id: vault.id, event: eventSlug ?? '', index: String(index) },
                  })
                }
              />
            ))}
          </View>
          {items.hasNextPage && (
            <Button
              variant="text"
              label={t('memoryVault.showMore')}
              loading={items.isFetchingNextPage}
              onPress={() => void items.fetchNextPage()}
            />
          )}
          {Platform.OS !== 'web' &&
            (saving ? (
              <View style={styles.progress} accessibilityLiveRegion="polite">
                <AppText weight={600}>
                  {t('memoryVault.saving', {
                    done: Math.min(saving.done + 1, saving.total),
                    total: saving.total,
                  })}
                </AppText>
                <ProgressBar
                  value={saving.total > 0 ? saving.done / saving.total : 0}
                  color={Colors.primary}
                  trackColor={Colors.fill}
                  height={8}
                />
              </View>
            ) : (
              <Button
                variant="secondary"
                icon="arrow-down-circle-outline"
                label={t('memoryVault.saveAll')}
                disabled={!!adding}
                onPress={() => void saveAll()}
              />
            ))}
          {saved && saved.saved > 0 && (
            <AppText weight={600} color="success" accessibilityLiveRegion="polite">
              {t('memoryVault.savedAll', { count: saved.saved })}
            </AppText>
          )}
          {saved && saved.failed > 0 && (
            <FieldError message={t('memoryVault.saveFailed', { count: saved.failed })} />
          )}
        </View>
      )}

      {/* The wedding's own people always see them, guests when the couple allows: the server decides */}
      {!couple && <Vendors vaultId={vault.id} />}
    </NavScreen>
  );
}

/** One square of the grid; videos show their length. */
function Tile({ item, spoken, onPress }: { item: VaultItem; spoken: string; onPress: () => void }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[spoken, item.hidden ? t('memoryVault.hiddenTag') : null]
        .filter(Boolean)
        .join(', ')}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      {item.thumbUrl ? (
        <Image
          source={{ uri: item.thumbUrl }}
          contentFit="cover"
          recyclingKey={item.id}
          style={[styles.image, item.hidden && styles.hidden]}
          accessible={false}
        />
      ) : (
        // A clip whose still couldn't be made
        <View style={[styles.image, styles.noThumb]}>
          <Icon name="film-outline" size={28} color={Colors.text2} />
        </View>
      )}
      {item.kind === 'video' && item.durationMs != null && (
        <View style={styles.badge}>
          <Icon name="play" size={11} color={Colors.onPrimary} />
          <AppText variant="caption" weight={600} color="onPrimary" style={styles.tabular}>
            {videoLength(item.durationMs / 1000)}
          </AppText>
        </View>
      )}
      {item.hidden && (
        <View style={styles.hiddenMark}>
          <Icon name="eye-off-outline" size={16} color={Colors.onPrimary} />
        </View>
      )}
    </Pressable>
  );
}

/** "The vendors who made this day": the vendors the family booked, each opening its page. */
function Vendors({ vaultId }: { vaultId: string }) {
  const { t } = useLocale();
  const vendors = useVaultVendors(vaultId);
  const categories = useCategories();
  if (!vendors.data?.length) return null;
  const categoryName = (slug: string) => {
    const category = categories.data?.find((c) => c.slug === slug);
    return category ? localized(category.name) : null;
  };
  return (
    <ListSection inset header={t('memoryVault.vendors')}>
      {vendors.data.map((vendor) => (
        <ListRow
          key={vendor.id}
          icon="storefront-outline"
          title={vendor.name}
          subtitle={[...vendor.categorySlugs.map(categoryName), vendor.city]
            .filter(Boolean)
            .join(' · ')}
          accessibilityRole="link"
          onPress={() => router.push({ pathname: '/v/[slug]', params: { slug: vendor.slug } })}
        />
      ))}
    </ListSection>
  );
}

/** After a guest's first upload, once: planning their own wedding starts here. */
function PlanCard() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const startPlanning = useStartPlanning();
  return (
    <Animated.View entering={Motion.rise} style={styles.planCard}>
      <View style={styles.planIcon}>
        <VaultIcon size={24} color={Colors.primary} />
      </View>
      <View style={styles.grow}>
        <AppText weight={700}>{t('memoryVault.planTitle')}</AppText>
        <AppText variant="label" weight={400} color="text2">
          {t('memoryVault.planBody')}
        </AppText>
        <Button
          variant="text"
          label={t('planner.startPlanning')}
          onPress={startPlanning}
          style={styles.planButton}
        />
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((Colors) => ({
  actions: {
    gap: Spacing.md,
  },
  progress: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  locked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  blocked: {
    gap: Spacing.sm,
  },
  grow: {
    flex: 1,
    gap: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  block: {
    gap: Spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  tile: {
    width: '33.333%',
    aspectRatio: 1,
    padding: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  image: {
    flex: 1,
    backgroundColor: Colors.fill,
  },
  hidden: {
    opacity: 0.4,
  },
  noThumb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: Spacing.xs,
    bottom: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.chip,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  hiddenMark: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    padding: 4,
    borderRadius: Radius.chip,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  planCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  planIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  // A text button's own padding would indent it from the words above
  planButton: {
    alignSelf: 'flex-start',
    marginLeft: -Spacing.lg,
  },
}));
