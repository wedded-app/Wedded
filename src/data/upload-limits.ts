/** These limits mirror storage.buckets; server limits remain authoritative. */
export const STORAGE_LIMITS = {
  'vendor-media': 5 * 1024 * 1024,
  'chat-media': 5 * 1024 * 1024,
  reels: 50 * 1024 * 1024,
  'vault-media': 50 * 1024 * 1024,
  'site-media': 5 * 1024 * 1024,
} as const;
export const REEL_VIDEO_TYPES = ['video/mp4', 'video/quicktime'] as const;
const MIME_TYPES: Record<keyof typeof STORAGE_LIMITS, readonly string[]> = {
  'vendor-media': ['image/webp', 'image/jpeg'],
  'chat-media': [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/aac',
    'audio/mpeg',
    'audio/webm',
  ],
  reels: [...REEL_VIDEO_TYPES, 'image/jpeg', 'image/webp', 'image/png'],
  'vault-media': ['image/jpeg', ...REEL_VIDEO_TYPES],
  'site-media': ['image/webp', 'image/jpeg'],
};
export function assertUploadFits(
  bucket: keyof typeof STORAGE_LIMITS,
  bytes: ArrayBuffer,
  contentType: string,
): void {
  if (!bytes.byteLength) throw new Error('Empty upload');
  if (bytes.byteLength > STORAGE_LIMITS[bucket])
    throw new Error('Payload too large for storage bucket');
  if (!MIME_TYPES[bucket].includes(contentType)) throw new Error('Unsupported upload content type');
}
