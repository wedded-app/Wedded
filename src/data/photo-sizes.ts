/**
 * The sizes the app shows a photo at, made on the phone before uploading:
 * 400 wide for grids and cards, 1080 for a page, 1600 for full screen. Each
 * is a .webp named by its width in the photo's folder.
 */

/** A photo picked from the library. */
export type PickedPhoto = { uri: string; width: number; height: number };

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
