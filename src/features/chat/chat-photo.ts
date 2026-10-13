import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

/** The longest side of a sent photo: sharp on any phone, a few hundred KB to send. */
export const CHAT_PHOTO_MAX = 1600;

/** How to resize a photo so its longest side fits `max`, or null when it already does. */
export function fitWithin(
  width: number,
  height: number,
  max = CHAT_PHOTO_MAX,
): { width: number } | { height: number } | null {
  if (!width || !height || Math.max(width, height) <= max) return null;
  return width >= height ? { width: max } : { height: max };
}

export type ReadyPhoto = { uri: string; width: number; height: number; bytes: ArrayBuffer };

/**
 * A picked photo made ready to send: shrunk to CHAT_PHOTO_MAX and saved as a
 * JPEG, which also turns an iPhone's HEIC into something every phone and
 * browser can show.
 */
export async function preparePhoto(photo: {
  uri: string;
  width: number;
  height: number;
}): Promise<ReadyPhoto> {
  const context = ImageManipulator.manipulate(photo.uri);
  const size = fitWithin(photo.width, photo.height);
  if (size) context.resize(size);
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  // Browsers hand back a blob: link, which File can't open
  const bytes =
    Platform.OS === 'web'
      ? await (await fetch(saved.uri)).arrayBuffer()
      : await new File(saved.uri).arrayBuffer();
  return { uri: saved.uri, width: saved.width, height: saved.height, bytes };
}

// Photos sent from this phone, by storage path: shown from the phone at once
// instead of waiting for the link to the uploaded copy.
const sentFromHere = new Map<string, string>();

export function rememberSentPhoto(path: string, localUri: string) {
  sentFromHere.set(path, localUri);
}

export function sentPhotoUri(path: string | null): string | null {
  return path ? (sentFromHere.get(path) ?? null) : null;
}
