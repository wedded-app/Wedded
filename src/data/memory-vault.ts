/**
 * Memory Vault (#306; the screens are #307): a wedding's private shared album.
 * Guests join from a link or the QR card on the tables and add the photos and
 * videos they took; the couple sees everything, sorted by event. The database
 * decides who sees what (see the memory_vault migration): the couple (owner
 * or editor) everything, family (suggesters) everything not hidden, guests
 * their own plus everyone's not hidden when the couple allows it.
 *
 * Adding: the phone shrinks a photo (longest side 2560, JPEG, which also
 * drops its location data) and makes a small thumb, or for a clip takes a
 * still, uploads them to vault-media/<vault>/<me>/<item>/ and then saves the
 * item with add_vault_item. The bucket is private, so files open through
 * signed links that last an hour.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as Linking from 'expo-linking';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Platform } from 'react-native';

import { SITE_URL_IS_PLACEHOLDER, siteLink } from '@/constants/links';
import { useSession } from '@/features/auth/session';
import { fitWithin } from '@/features/chat/chat-photo';
import { asLocalizedText, type LocalizedText } from '@/i18n/localized';
import { supabase } from '@/lib/supabase';

import { assertUploadFits } from './upload-limits';
import type { InviteStatus } from './wedding';

export const vaultKeys = {
  all: ['memory-vault'] as const,
  byWedding: (weddingId: string) => ['memory-vault', 'wedding', weddingId] as const,
  vault: (vaultId: string) => ['memory-vault', 'vault', vaultId] as const,
  items: (vaultId: string, eventSlug: string | null) =>
    ['memory-vault', 'items', vaultId, eventSlug] as const,
  mine: (userId: string) => ['memory-vault', 'mine', userId] as const,
  vendors: (vaultId: string) => ['memory-vault', 'vendors', vaultId] as const,
  invite: (token: string) => ['memory-vault', 'invite', token] as const,
  file: (path: string | null) => ['memory-vault', 'file', path] as const,
};

/** couple: an owner or editor of the wedding; family: a suggester; guest: joined with the link. */
export type VaultRole = 'couple' | 'family' | 'guest';

export type VaultEvent = {
  slug: string;
  name: LocalizedText;
  /** The event's date on the plan (yyyy-mm-dd), if set. */
  date: string | null;
  /** How many photos and videos from it you see. */
  count: number;
};

export type MemoryVault = {
  id: string;
  weddingId: string;
  title: string | null;
  weddingDate: string | null;
  role: VaultRole;
  /** The couple always can; everyone else while uploads are open. */
  canAdd: boolean;
  uploadsOpen: boolean;
  guestsSeeAll: boolean;
  showVendors: boolean;
  /** Photos and videos you see. */
  itemCount: number;
  myItemCount: number;
  guestCount: number;
  /** The wedding's events, by date. */
  events: VaultEvent[];
};

type VaultRow = {
  id: string;
  wedding_id: string;
  title: string | null;
  wedding_date: string | null;
  my_role: string;
  can_add: boolean;
  uploads_open: boolean;
  guests_see_all: boolean;
  show_vendors: boolean;
  item_count: number;
  my_item_count: number;
  guest_count: number;
  events: unknown;
};

function asRole(value: string): VaultRole {
  return value === 'couple' || value === 'family' ? value : 'guest';
}

/** The events of a vault (or of a link's preview) from the database's jsonb. */
export function toVaultEvents(value: unknown): VaultEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: Record<string, unknown> | null) => {
    if (!entry || typeof entry.slug !== 'string') return [];
    return [
      {
        slug: entry.slug,
        name: asLocalizedText(entry.name) ?? { en: entry.slug },
        date: typeof entry.date === 'string' ? entry.date : null,
        count: typeof entry.count === 'number' ? entry.count : 0,
      },
    ];
  });
}

export function toMemoryVault(row: VaultRow): MemoryVault {
  return {
    id: row.id,
    weddingId: row.wedding_id,
    title: row.title,
    weddingDate: row.wedding_date,
    role: asRole(row.my_role),
    canAdd: row.can_add,
    uploadsOpen: row.uploads_open,
    guestsSeeAll: row.guests_see_all,
    showVendors: row.show_vendors,
    itemCount: row.item_count,
    myItemCount: row.my_item_count,
    guestCount: row.guest_count,
    events: toVaultEvents(row.events),
  };
}

async function fetchVault(by: { p_vault_id: string } | { p_wedding_id: string }) {
  const { data, error } = await supabase.rpc('memory_vault', by);
  if (error) throw error;
  return data[0] ? toMemoryVault(data[0]) : null;
}

/** The wedding's vault as you see it, or null until the couple opens it. */
export function useMemoryVault(weddingId: string | null) {
  return useQuery({
    queryKey: vaultKeys.byWedding(weddingId ?? ''),
    queryFn: () => fetchVault({ p_wedding_id: weddingId ?? '' }),
    enabled: !!weddingId,
  });
}

/** A vault by its id (the vault's page), or null when you're not in it. */
export function useVault(vaultId: string) {
  return useQuery({
    queryKey: vaultKeys.vault(vaultId),
    queryFn: () => fetchVault({ p_vault_id: vaultId }),
    enabled: vaultId.length > 0,
  });
}

/** Open the wedding's vault (owners and editors); returns its id. */
export function useOpenMemoryVault() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (weddingId: string): Promise<string> => {
      const { data, error } = await supabase.rpc('open_memory_vault', { p_wedding_id: weddingId });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.all }),
  });
}

/** Change the settings (the couple); leave out what stays the same. */
export function useVaultSettings(vaultId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: {
      uploadsOpen?: boolean;
      guestsSeeAll?: boolean;
      showVendors?: boolean;
    }) => {
      const { error } = await supabase.rpc('set_vault_settings', {
        p_vault_id: vaultId,
        p_uploads_open: settings.uploadsOpen,
        p_guests_see_all: settings.guestsSeeAll,
        p_show_vendors: settings.showVendors,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: vaultKeys.all }),
  });
}

// Photos and videos ---------------------------------------------------------------------

export type VaultItem = {
  id: string;
  /** Who added it (their user id) and their first name. */
  addedBy: string;
  addedByName: string | null;
  isMine: boolean;
  kind: 'photo' | 'video';
  /** The photo or the clip, for vaultMediaUrl. */
  path: string;
  thumbPath: string | null;
  /** A signed link to the thumb (a photo without one: the photo), for the grid. */
  thumbUrl: string | null;
  eventSlug: string | null;
  width: number;
  height: number;
  durationMs: number | null;
  takenAt: string | null;
  /** Hidden by the couple: only they and whoever added it see it. */
  hidden: boolean;
  createdAt: string;
};

type ItemRow = {
  id: string;
  user_id: string;
  added_by_name: string | null;
  is_mine: boolean;
  kind: string;
  path: string;
  thumb_path: string | null;
  event_slug: string | null;
  width: number;
  height: number;
  duration_ms: number | null;
  taken_at: string | null;
  hidden: boolean;
  created_at: string;
};

export function toVaultItem(row: ItemRow, thumbUrl: string | null = null): VaultItem {
  return {
    id: row.id,
    addedBy: row.user_id,
    addedByName: row.added_by_name,
    isMine: row.is_mine,
    kind: row.kind === 'video' ? 'video' : 'photo',
    path: row.path,
    thumbPath: row.thumb_path,
    thumbUrl,
    eventSlug: row.event_slug,
    width: row.width,
    height: row.height,
    durationMs: row.duration_ms,
    takenAt: row.taken_at,
    hidden: row.hidden,
    createdAt: row.created_at,
  };
}

/** Signed links last this long; queries refetch a little before. */
const SIGNED_FOR_S = 60 * 60;
const LINKS_FRESH_MS = 50 * 60 * 1000;

/** How many come in a page of the grid. */
export const VAULT_PAGE = 60;

/** Signed links to vault files, in the order given; null for no path or no access. */
export async function vaultMediaUrls(paths: (string | null)[]): Promise<(string | null)[]> {
  const wanted = paths.filter((path): path is string => !!path);
  if (wanted.length === 0) return paths.map(() => null);
  const { data, error } = await supabase.storage
    .from('vault-media')
    .createSignedUrls(wanted, SIGNED_FOR_S);
  if (error) throw error;
  const byPath = new Map(data.map((link) => [link.path, link.error ? null : link.signedUrl]));
  return paths.map((path) => (path ? (byPath.get(path) ?? null) : null));
}

/** A signed link to one file (the full photo or the clip): the viewer, Save to Photos. */
export async function vaultMediaUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('vault-media')
    .createSignedUrl(path, SIGNED_FOR_S);
  if (error) throw error;
  return data.signedUrl;
}

export function useVaultMediaUrl(path: string | null) {
  return useQuery({
    queryKey: vaultKeys.file(path),
    queryFn: () => vaultMediaUrl(path ?? ''),
    enabled: !!path,
    staleTime: LINKS_FRESH_MS,
  });
}

type PageCursor = { at: string; id: string } | null;

/**
 * The photos and videos you see, newest first, a page at a time
 * (fetchNextPage), each with a link to its thumb. Pass an event's slug for
 * just that event.
 */
export function useVaultItems(vaultId: string, eventSlug?: string | null) {
  return useInfiniteQuery({
    queryKey: vaultKeys.items(vaultId, eventSlug ?? null),
    initialPageParam: null as PageCursor,
    queryFn: async ({ pageParam }): Promise<VaultItem[]> => {
      const { data, error } = await supabase.rpc('vault_items', {
        p_vault_id: vaultId,
        p_event_slug: eventSlug ?? undefined,
        p_before_at: pageParam?.at,
        p_before_id: pageParam?.id,
        p_limit: VAULT_PAGE,
      });
      if (error) throw error;
      const thumbs = await vaultMediaUrls(
        data.map((row) => row.thumb_path ?? (row.kind === 'photo' ? row.path : null)),
      );
      return data.map((row, index) => toVaultItem(row, thumbs[index]));
    },
    getNextPageParam: (last): PageCursor | undefined => {
      const tail = last[last.length - 1];
      return last.length < VAULT_PAGE || !tail ? undefined : { at: tail.createdAt, id: tail.id };
    },
    enabled: vaultId.length > 0,
    staleTime: LINKS_FRESH_MS,
  });
}

/** What a page of the grid is (for leaving a removed item out at once). */
type ItemPages = InfiniteData<VaultItem[], PageCursor>;

/** Delete a photo or video (yours, or any as the couple). */
export function useRemoveVaultItem(vaultId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.rpc('remove_vault_item', { p_item_id: itemId });
      if (error) throw new Error(error.message);
    },
    onMutate: (itemId) => {
      queryClient.setQueriesData<ItemPages>(
        { queryKey: ['memory-vault', 'items', vaultId] },
        (pages) =>
          pages && {
            ...pages,
            pages: pages.pages.map((page) => page.filter((item) => item.id !== itemId)),
          },
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: vaultKeys.all }),
  });
}

/** Hide a photo or video, or show it again (the couple). */
export function useHideVaultItem(vaultId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, hidden }: { itemId: string; hidden: boolean }) => {
      const { error } = await supabase.rpc('hide_vault_item', {
        p_item_id: itemId,
        p_hidden: hidden,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: vaultKeys.all }),
  });
}

// Adding --------------------------------------------------------------------------------

/** The longest side of a saved photo: sharp enough to print, a few hundred KB to send. */
export const VAULT_PHOTO_MAX = 2560;
/** The longest side of the grid's thumbs. */
export const VAULT_THUMB_MAX = 640;
/** The longest clip the vault takes (the database allows a little over a minute). */
export const VAULT_VIDEO_MAX_MS = 60_000;

/** What the image picker hands back; ask it for `exif: true` to keep when photos were taken. */
export type VaultPick = Pick<
  ImagePickerAsset,
  'uri' | 'width' | 'height' | 'type' | 'duration' | 'mimeType' | 'exif'
>;

async function readBytes(uri: string): Promise<ArrayBuffer> {
  // Browsers hand back a blob: link, which File can't open
  return Platform.OS === 'web' ? (await fetch(uri)).arrayBuffer() : new File(uri).arrayBuffer();
}

async function saveJpeg(uri: string, width: number, height: number, max: number, quality: number) {
  const context = ImageManipulator.manipulate(uri);
  const size = fitWithin(width, height, max);
  if (size) context.resize(size);
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/**
 * When a photo was taken, from its EXIF (DateTimeOriginal, with its offset
 * when the camera wrote one; otherwise read as this phone's local time), or
 * null.
 */
export function takenAtFromExif(exif: Record<string, unknown> | null | undefined): string | null {
  if (!exif) return null;
  const nested = (exif['{Exif}'] ?? {}) as Record<string, unknown>;
  const stamp = exif.DateTimeOriginal ?? nested.DateTimeOriginal;
  const offset = exif.OffsetTimeOriginal ?? nested.OffsetTimeOriginal;
  const match =
    typeof stamp === 'string'
      ? /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(stamp)
      : null;
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const date =
    typeof offset === 'string' && /^[+-]\d{2}:\d{2}$/.test(offset)
      ? new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`)
      : new Date(+year, +month - 1, +day, +hour, +minute, +second);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Upload one picked photo or clip to your folder in the vault and save it.
 * If saving fails, the uploaded files are deleted again. Returns the item's id.
 */
export async function uploadVaultItem(
  vaultId: string,
  media: VaultPick,
  eventSlug: string | null,
): Promise<string> {
  // Read at the moment of adding: it may follow a sign-in
  const { data: auth } = await supabase.auth.getSession();
  const me = auth.session?.user.id;
  if (!me) throw new Error('not_signed_in');
  const isVideo = media.type === 'video';
  if (isVideo && (media.duration ?? 0) > VAULT_VIDEO_MAX_MS) throw new Error('video_too_long');

  const itemId = Crypto.randomUUID();
  const folder = `${vaultId}/${me}/${itemId}`;
  const bucket = supabase.storage.from('vault-media');
  const uploaded: string[] = [];
  const put = async (name: string, bytes: ArrayBuffer, contentType: string) => {
    assertUploadFits('vault-media', bytes, contentType);
    const path = `${folder}/${name}`;
    const { error } = await bucket.upload(path, bytes, { contentType, upsert: false });
    if (error) throw new Error(error.message);
    uploaded.push(path);
    return path;
  };

  try {
    let saved: { path: string; thumbPath: string | null; width: number; height: number };
    if (isVideo) {
      const mov = media.mimeType === 'video/quicktime' || /\.mov$/i.test(media.uri);
      const contentType = mov ? 'video/quicktime' : 'video/mp4';
      const bytes = await readBytes(media.uri);
      // Check the size before making the still, so a big clip fails fast
      assertUploadFits('vault-media', bytes, contentType);
      let still: { uri: string; width: number; height: number } | null = null;
      try {
        const frame = await VideoThumbnails.getThumbnailAsync(media.uri, {
          time: Math.min(1000, (media.duration ?? 0) / 2),
          quality: 0.7,
        });
        still = await saveJpeg(frame.uri, frame.width, frame.height, VAULT_THUMB_MAX, 0.7);
      } catch {
        // Without a still the grid shows the clip's placeholder
      }
      const path = await put(mov ? 'video.mov' : 'video.mp4', bytes, contentType);
      const thumbPath = still
        ? await put('thumb.jpg', await readBytes(still.uri), 'image/jpeg')
        : null;
      saved = {
        path,
        thumbPath,
        width: media.width || still?.width || 1,
        height: media.height || still?.height || 1,
      };
    } else {
      // Also turns an iPhone's HEIC into a JPEG every phone can show, without its location
      const photo = await saveJpeg(media.uri, media.width, media.height, VAULT_PHOTO_MAX, 0.85);
      const thumb = await saveJpeg(photo.uri, photo.width, photo.height, VAULT_THUMB_MAX, 0.7);
      saved = {
        path: await put('photo.jpg', await readBytes(photo.uri), 'image/jpeg'),
        thumbPath: await put('thumb.jpg', await readBytes(thumb.uri), 'image/jpeg'),
        width: photo.width,
        height: photo.height,
      };
    }
    const { error } = await supabase.rpc('add_vault_item', {
      p_vault_id: vaultId,
      p_item_id: itemId,
      p_kind: isVideo ? 'video' : 'photo',
      p_path: saved.path,
      p_thumb_path: saved.thumbPath ?? undefined,
      p_event_slug: eventSlug ?? undefined,
      p_width: Math.round(saved.width),
      p_height: Math.round(saved.height),
      p_duration_ms: isVideo && media.duration ? Math.round(media.duration) : undefined,
      p_taken_at: isVideo ? undefined : (takenAtFromExif(media.exif) ?? undefined),
    });
    if (error) throw new Error(error.message);
    return itemId;
  } catch (e) {
    if (uploaded.length > 0) await bucket.remove(uploaded).catch(() => undefined);
    throw e;
  }
}

/**
 * Why adding (or joining) failed, as something to tell the person: locked
 * (the couple closed the vault), tooMany (300 each for guests), full,
 * tooLong (a clip over a minute), tooBig (over 50 MB), notAllowed, offline
 * (no signal: try again), the link's revoked / expired / usedUp / notFound,
 * tooManyVaults, or failed.
 */
export type VaultProblem =
  | 'locked'
  | 'tooMany'
  | 'full'
  | 'tooLong'
  | 'tooBig'
  | 'notAllowed'
  | 'offline'
  | 'revoked'
  | 'expired'
  | 'usedUp'
  | 'notFound'
  | 'tooManyVaults'
  | 'failed';

export function vaultProblem(error: unknown): VaultProblem {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.includes('uploads_locked')) return 'locked';
  if (message.includes('too_many_items')) return 'tooMany';
  if (message.includes('vault_full')) return 'full';
  if (message.includes('video_too_long')) return 'tooLong';
  if (/exceeded the maximum|too large|413/i.test(message)) return 'tooBig';
  if (message.includes('invite_revoked')) return 'revoked';
  if (message.includes('invite_expired')) return 'expired';
  if (message.includes('invite_used_up')) return 'usedUp';
  if (message.includes('invite_not_found')) return 'notFound';
  if (message.includes('too_many_vaults')) return 'tooManyVaults';
  if (/not_allowed|not_signed_in|row-level security|Unauthorized|403/i.test(message)) {
    return 'notAllowed';
  }
  if (/network request failed|failed to fetch/i.test(message)) return 'offline';
  return 'failed';
}

export type AddVaultItemsResult = { added: number; failed: number; problem: VaultProblem | null };

/**
 * Add several picked photos and clips one after another, all tagged with one
 * event (or none). `onProgress(done, total)` after each, for "Adding 3 of
 * 10". Stops at a problem that would stop the rest too (locked, the limits,
 * not allowed); other failures skip that one.
 */
export function useAddVaultItems(vaultId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      items,
      eventSlug,
      onProgress,
    }: {
      items: VaultPick[];
      eventSlug?: string | null;
      onProgress?: (done: number, total: number) => void;
    }): Promise<AddVaultItemsResult> => {
      let added = 0;
      let failed = 0;
      let problem: VaultProblem | null = null;
      for (const [index, media] of items.entries()) {
        try {
          await uploadVaultItem(vaultId, media, eventSlug ?? null);
          added += 1;
        } catch (e) {
          failed += 1;
          problem = vaultProblem(e);
          if (['locked', 'tooMany', 'full', 'notAllowed'].includes(problem)) {
            failed += items.length - index - 1;
            break;
          }
        }
        onProgress?.(index + 1, items.length);
      }
      return { added, failed, problem };
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: vaultKeys.all }),
  });
}

// The link ------------------------------------------------------------------------------

/**
 * The link guests open (and the QR card prints): the website's /join-vault
 * page once there's a domain, until then a link into the app (in Expo Go,
 * the development server's address).
 */
export function vaultInviteLink(token: string): string {
  return SITE_URL_IS_PLACEHOLDER
    ? Linking.createURL(`/join-vault/${token}`)
    : siteLink(`/join-vault/${token}`);
}

/**
 * Make a link to the vault (the couple). Only a hash of each token is kept, so
 * every call makes a new one; earlier links, printed ones too, keep working
 * until stopped or 180 days old.
 */
export function useCreateVaultInvite() {
  return useMutation({
    mutationFn: async (vaultId: string): Promise<string> => {
      const { data, error } = await supabase.rpc('create_vault_invite', { p_vault_id: vaultId });
      if (error) throw new Error(error.message);
      return vaultInviteLink(data);
    },
  });
}

/** Stop the link (the couple), say when it reached the wrong people; the next one is new. */
export function useRevokeVaultInvite() {
  return useMutation({
    mutationFn: async (vaultId: string) => {
      const { error } = await supabase.rpc('revoke_vault_invite', { p_vault_id: vaultId });
      if (error) throw new Error(error.message);
    },
  });
}

export type VaultInvitePreview = {
  status: InviteStatus;
  /** Only for a valid link. */
  vaultId: string | null;
  title: string | null;
  inviterName: string | null;
  events: { slug: string; name: LocalizedText }[];
  itemCount: number;
};

/** What a guest sees before joining. Works logged out. */
export function useVaultInvitePreview(token: string) {
  return useQuery({
    queryKey: vaultKeys.invite(token),
    queryFn: async (): Promise<VaultInvitePreview> => {
      const { data, error } = await supabase.rpc('vault_invite_preview', { p_token: token });
      if (error) throw error;
      const row = data[0];
      return {
        status: (row?.status ?? 'not_found') as InviteStatus,
        vaultId: row?.vault_id ?? null,
        title: row?.title ?? null,
        inviterName: row?.inviter_name ?? null,
        events: toVaultEvents(row?.events).map(({ slug, name }) => ({ slug, name })),
        itemCount: row?.item_count ?? 0,
      };
    },
    enabled: token.length > 0,
  });
}

/** Join with the link (signed in); returns the vault's id. vaultProblem() says why it failed. */
export function useAcceptVaultInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string): Promise<string> => {
      const { data, error } = await supabase.rpc('accept_vault_invite', { p_token: token });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.all }),
  });
}

/** Leave a vault (your own id), or remove a guest as the couple. What they added stays. */
export function useRemoveVaultGuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ vaultId, userId }: { vaultId: string; userId: string }) => {
      const { error } = await supabase.rpc('remove_vault_guest', {
        p_vault_id: vaultId,
        p_user_id: userId,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: vaultKeys.all }),
  });
}

// Lists ---------------------------------------------------------------------------------

export type MyVault = {
  id: string;
  weddingId: string;
  title: string | null;
  weddingDate: string | null;
  role: VaultRole;
  uploadsOpen: boolean;
  itemCount: number;
  myItemCount: number;
  lastItemAt: string | null;
};

/** The vaults you're in (your wedding's and the ones you joined), latest first. Empty signed out. */
export function useMyVaults() {
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  return useQuery({
    queryKey: vaultKeys.mine(userId),
    queryFn: async (): Promise<MyVault[]> => {
      const { data, error } = await supabase.rpc('my_vaults');
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        weddingId: row.wedding_id,
        title: row.title,
        weddingDate: row.wedding_date,
        role: asRole(row.my_role),
        uploadsOpen: row.uploads_open,
        itemCount: row.item_count,
        myItemCount: row.my_item_count,
        lastItemAt: row.last_item_at,
      }));
    },
    enabled: userId.length > 0,
  });
}

export type VaultVendor = {
  id: string;
  slug: string;
  name: string;
  city: string;
  isSample: boolean;
  categorySlugs: string[];
  eventSlugs: string[];
};

/**
 * "The vendors who made this day": the published vendors the family booked.
 * Guests get them only when the couple shows them; useVendors(slugs) has their
 * full profiles.
 */
export function useVaultVendors(vaultId: string) {
  return useQuery({
    queryKey: vaultKeys.vendors(vaultId),
    queryFn: async (): Promise<VaultVendor[]> => {
      const { data, error } = await supabase.rpc('vault_vendors', { p_vault_id: vaultId });
      if (error) throw error;
      return data.map((row) => ({
        id: row.vendor_id,
        slug: row.slug,
        name: row.name,
        city: row.city,
        isSample: row.is_sample,
        categorySlugs: row.category_slugs ?? [],
        eventSlugs: row.event_slugs ?? [],
      }));
    },
    enabled: vaultId.length > 0,
  });
}
