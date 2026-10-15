import { assertUploadFits, STORAGE_LIMITS } from './upload-limits';
describe('storage upload bounds', () => {
  it('allows the bucket boundary and refuses oversized, empty and unsupported uploads', () => {
    for (const bucket of ['vendor-media', 'chat-media', 'reels'] as const) {
      expect(() =>
        assertUploadFits(bucket, new ArrayBuffer(STORAGE_LIMITS[bucket]), 'image/jpeg'),
      ).not.toThrow();
      expect(() =>
        assertUploadFits(bucket, new ArrayBuffer(STORAGE_LIMITS[bucket] + 1), 'image/jpeg'),
      ).toThrow('too large');
      expect(() => assertUploadFits(bucket, new ArrayBuffer(0), 'image/jpeg')).toThrow('Empty');
      expect(() => assertUploadFits(bucket, new ArrayBuffer(10), 'text/html')).toThrow(
        'Unsupported',
      );
    }
  });
  it('accepts supported video and voice formats but rejects other video types', () => {
    expect(() => assertUploadFits('chat-media', new ArrayBuffer(10), 'audio/mp4')).not.toThrow();
    expect(() => assertUploadFits('reels', new ArrayBuffer(10), 'video/quicktime')).not.toThrow();
    expect(() => assertUploadFits('reels', new ArrayBuffer(10), 'video/webm')).toThrow();
  });
});
