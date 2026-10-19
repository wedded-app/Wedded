import { File, Paths } from 'expo-file-system';

import { vaultMediaUrl } from '@/data/memory-vault';
import { saveToPhotos } from '@/lib/save-to-photos';

import { savedName } from './vault-helpers';

/** Download a vault photo or video and keep it in the phone's Photos. False if that didn't work. */
export async function saveMediaToPhotos(item: {
  id: string;
  path: string;
  kind: 'photo' | 'video';
}): Promise<boolean> {
  const file = new File(Paths.cache, savedName(item.id, item.path, item.kind));
  try {
    await File.downloadFileAsync(await vaultMediaUrl(item.path), file, { idempotent: true });
    return await saveToPhotos(file.uri);
  } catch {
    return false;
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {}
  }
}
