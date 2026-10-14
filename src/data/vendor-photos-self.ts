/**
 * Vendors add and arrange their own photos (C6d, #212). The phone makes the
 * three sizes the app shows (400, 1080 and 1600 wide, WebP), uploads them to
 * vendor-media/<vendor id>/<photo id>/ and saves the photo with
 * add_vendor_photo() (see the vendor_photos_self migration). Free: Supabase
 * Storage, no AWS. Only the vendor's people can do any of it.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

import { insightKeys } from './business-insights';
import { PHOTO_COLUMNS, toPhoto, type PhotoRow, type VendorPhoto } from './vendor-media';

export const myPhotoKeys = {
  mine: (vendorId: string) => ['my-vendor-photos', vendorId] as const,
};

/** The most photos a vendor can have; the database says the same. */
export const MAX_VENDOR_PHOTOS = 60;

/** The sizes the app shows, as files named by width. */
export const PHOTO_WIDTHS = [400, 1080, 1600] as const;

/**
 * How wide to make each size from a photo this wide: never wider than the
 * original, so a small photo isn't blown up.
 */
export function photoSizes(originalWidth: number): { name: number; width: number }[] {
  return PHOTO_WIDTHS.map((name) => ({ name, width: Math.min(name, Math.max(1, originalWidth)) }));
}

/** The files of a photo in its folder. */
export function photoFiles(folder: string): string[] {
  return PHOTO_WIDTHS.map((width) => `${folder}/${width}.webp`);
}

export type PhotoProblem =
  'tooMany' | 'rate' | 'notAllowed' | 'tooBig' | 'invalidEvent' | 'offline' | 'failed';

/** A refused upload or change, in terms a screen can word. */
export function photoProblem(error: unknown): PhotoProblem {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.includes('too_many_photos')) return 'tooMany';
  if (message.includes('photo_rate')) return 'rate';
  if (message.includes('not_allowed') || /row-level security|Unauthorized|403/i.test(message)) {
    return 'notAllowed';
  }
  if (/exceeded the maximum|too large|413/i.test(message)) return 'tooBig';
  if (message.includes('invalid_event')) return 'invalidEvent';
  if (/network request failed|failed to fetch/i.test(message)) return 'offline';
  return 'failed';
}

/** The vendor's photos in the order families see them, drafts included. */
export function useMyVendorPhotos(vendorId: string) {
  return useQuery({
    queryKey: myPhotoKeys.mine(vendorId),
    queryFn: async (): Promise<VendorPhoto[]> => {
      const { data, error } = await supabase
        .from('vendor_media')
        .select(PHOTO_COLUMNS)
        .eq('vendor_id', vendorId)
        .order('sort_order')
        .order('created_at');
      if (error) throw error;
      return (data as unknown as PhotoRow[]).map(toPhoto);
    },
    enabled: vendorId.length > 0,
  });
}

/** Refresh everywhere a vendor's photos show. */
function refreshPhotos(queryClient: ReturnType<typeof useQueryClient>, vendorId: string) {
  void queryClient.invalidateQueries({ queryKey: myPhotoKeys.mine(vendorId) });
  void queryClient.invalidateQueries({ queryKey: ['vendor-photos', vendorId] });
  void queryClient.invalidateQueries({ queryKey: insightKeys.checklist(vendorId) });
  // Search results and profiles show the cover
  void queryClient.invalidateQueries({ queryKey: ['vendors'] });
  void queryClient.invalidateQueries({ queryKey: ['vendor-search'] });
}

async function readBytes(uri: string): Promise<ArrayBuffer> {
  // Browsers hand back a blob: link, which File can't open
  return Platform.OS === 'web' ? (await fetch(uri)).arrayBuffer() : new File(uri).arrayBuffer();
}

export type PickedPhoto = { uri: string; width: number; height: number };

/**
 * Make the three sizes of one picked photo, upload them and save it. If saving
 * fails, the uploaded files are deleted again.
 */
export async function uploadVendorPhoto(
  vendorId: string,
  photo: PickedPhoto,
  eventSlug?: string | null,
): Promise<string> {
  const photoId = Crypto.randomUUID();
  const folder = `${vendorId}/${photoId}`;
  const uploaded: string[] = [];
  try {
    let largest = { width: photo.width, height: photo.height };
    for (const size of photoSizes(photo.width)) {
      const rendered = await ImageManipulator.manipulate(photo.uri)
        .resize({ width: size.width })
        .renderAsync();
      const saved = await rendered.saveAsync({ format: SaveFormat.WEBP, compress: 0.8 });
      const path = `${folder}/${size.name}.webp`;
      const { error } = await supabase.storage
        .from('vendor-media')
        .upload(path, await readBytes(saved.uri), { contentType: 'image/webp', upsert: false });
      if (error) throw new Error(error.message);
      uploaded.push(path);
      if (size.name === 1600) largest = { width: saved.width, height: saved.height };
    }
    const { data, error } = await supabase.rpc('add_vendor_photo', {
      p_vendor_id: vendorId,
      p_photo_id: photoId,
      p_width: largest.width,
      p_height: largest.height,
      p_event_slug: eventSlug ?? undefined,
    });
    if (error) throw new Error(error.message);
    return data;
  } catch (e) {
    if (uploaded.length > 0) {
      await supabase.storage
        .from('vendor-media')
        .remove(uploaded)
        .catch(() => undefined);
    }
    throw e;
  }
}

export type AddPhotosResult = { added: number; failed: number; problem: PhotoProblem | null };

/**
 * Add several picked photos one after another. `onProgress(done, total)` after
 * each, for "Adding 2 of 5". Stops at the first limit (too many, or the daily
 * cap); other failures skip that photo.
 */
export function useAddVendorPhotos(vendorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      photos,
      eventSlug,
      onProgress,
    }: {
      photos: PickedPhoto[];
      eventSlug?: string | null;
      onProgress?: (done: number, total: number) => void;
    }): Promise<AddPhotosResult> => {
      let added = 0;
      let failed = 0;
      let problem: PhotoProblem | null = null;
      for (const [index, photo] of photos.entries()) {
        try {
          await uploadVendorPhoto(vendorId, photo, eventSlug);
          added += 1;
        } catch (e) {
          failed += 1;
          problem = photoProblem(e);
          if (problem === 'tooMany' || problem === 'rate' || problem === 'notAllowed') {
            failed += photos.length - index - 1;
            break;
          }
        }
        onProgress?.(index + 1, photos.length);
      }
      return { added, failed, problem };
    },
    onSettled: () => refreshPhotos(queryClient, vendorId),
  });
}

/** Make one photo the cover. */
export function useSetVendorCover(vendorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mediaId: string) => {
      const { error } = await supabase.rpc('set_vendor_cover', { p_media_id: mediaId });
      if (error) throw new Error(error.message);
    },
    onSettled: () => refreshPhotos(queryClient, vendorId),
  });
}

/** Save the order (all the ids, first to last). Shows the new order at once. */
export function useReorderVendorPhotos(vendorId: string) {
  const queryClient = useQueryClient();
  const key = myPhotoKeys.mine(vendorId);
  return useMutation({
    mutationFn: async (mediaIds: string[]) => {
      const { error } = await supabase.rpc('reorder_vendor_photos', {
        p_vendor_id: vendorId,
        p_media_ids: mediaIds,
      });
      if (error) throw new Error(error.message);
    },
    onMutate: async (mediaIds) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<VendorPhoto[]>(key);
      if (before) {
        const byId = new Map(before.map((p) => [p.id, p]));
        const named = mediaIds.map((id) => byId.get(id)).filter((p): p is VendorPhoto => !!p);
        const rest = before.filter((p) => !mediaIds.includes(p.id));
        queryClient.setQueryData(key, [...named, ...rest]);
      }
      return { before };
    },
    onError: (_error, _ids, context) => {
      if (context?.before) queryClient.setQueryData(key, context.before);
    },
    onSettled: () => refreshPhotos(queryClient, vendorId),
  });
}

/** Say which event a photo is from (null for none). */
export function useTagVendorPhoto(vendorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ mediaId, eventSlug }: { mediaId: string; eventSlug: string | null }) => {
      const { error } = await supabase.rpc('tag_vendor_photo', {
        p_media_id: mediaId,
        p_event_slug: eventSlug ?? undefined,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: () => refreshPhotos(queryClient, vendorId),
  });
}

/** Take a photo off the page and delete its files. */
export function useRemoveVendorPhoto(vendorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mediaId: string) => {
      const { data: folder, error } = await supabase.rpc('remove_vendor_photo', {
        p_media_id: mediaId,
      });
      if (error) throw new Error(error.message);
      // The photo is already off the page; leftover files only cost space
      await supabase.storage
        .from('vendor-media')
        .remove(photoFiles(folder))
        .catch(() => undefined);
    },
    onSettled: () => refreshPhotos(queryClient, vendorId),
  });
}
