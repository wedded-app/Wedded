import { photoFiles, photoProblem, photoSizes, uploadVendorPhoto } from './vendor-photos-self';

const mockUpload = jest.fn();
const mockRemove = jest.fn();
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockUpload(...args),
        remove: (...args: unknown[]) => mockRemove(...args),
      }),
    },
  },
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'photo-1' }));
jest.mock('expo-file-system', () => ({
  File: class {
    async arrayBuffer() {
      return new ArrayBuffer(8);
    }
  },
}));
const mockResized: number[] = [];
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { WEBP: 'webp' },
  ImageManipulator: {
    manipulate: () => ({
      resize: ({ width }: { width: number }) => {
        mockResized.push(width);
        return {
          renderAsync: async () => ({
            saveAsync: async () => ({ uri: `file:///${width}.webp`, width, height: width * 0.75 }),
          }),
        };
      },
    }),
  },
}));

beforeEach(() => {
  mockUpload.mockReset().mockResolvedValue({ error: null });
  mockRemove.mockReset().mockResolvedValue({ error: null });
  mockRpc.mockReset().mockResolvedValue({ data: 'media-1', error: null });
  mockResized.length = 0;
});

describe('photoSizes and photoFiles', () => {
  it('makes the three sizes, never wider than the original', () => {
    expect(photoSizes(4000).map((s) => s.width)).toEqual([400, 1080, 1600]);
    expect(photoSizes(900).map((s) => s.width)).toEqual([400, 900, 900]);
    expect(photoSizes(900).map((s) => s.name)).toEqual([400, 1080, 1600]);
  });

  it('names the files in a folder', () => {
    expect(photoFiles('v/p')).toEqual(['v/p/400.webp', 'v/p/1080.webp', 'v/p/1600.webp']);
  });
});

describe('photoProblem', () => {
  it('names the limits and refusals', () => {
    expect(photoProblem(new Error('too_many_photos'))).toBe('tooMany');
    expect(photoProblem(new Error('photo_rate'))).toBe('rate');
    expect(photoProblem(new Error('new row violates row-level security policy'))).toBe(
      'notAllowed',
    );
    expect(photoProblem(new Error('The object exceeded the maximum allowed size'))).toBe('tooBig');
    expect(photoProblem(new Error('Network request failed'))).toBe('offline');
    expect(photoProblem(new Error('boom'))).toBe('failed');
  });
});

describe('uploadVendorPhoto', () => {
  const photo = { uri: 'file:///picked.jpg', width: 3000, height: 2000 };

  it('uploads the three sizes to the vendor folder, then saves the photo', async () => {
    await expect(uploadVendorPhoto('v1', photo, 'jaago')).resolves.toBe('media-1');
    expect(mockResized).toEqual([400, 1080, 1600]);
    expect(mockUpload.mock.calls.map((c) => c[0])).toEqual([
      'v1/photo-1/400.webp',
      'v1/photo-1/1080.webp',
      'v1/photo-1/1600.webp',
    ]);
    expect(mockUpload.mock.calls[0][2]).toEqual({ contentType: 'image/webp', upsert: false });
    expect(mockRpc).toHaveBeenCalledWith('add_vendor_photo', {
      p_vendor_id: 'v1',
      p_photo_id: 'photo-1',
      p_width: 1600,
      p_height: 1200,
      p_event_slug: 'jaago',
    });
  });

  it('deletes what it uploaded when saving is refused', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'too_many_photos' } });
    await expect(uploadVendorPhoto('v1', photo)).rejects.toThrow('too_many_photos');
    expect(mockRemove).toHaveBeenCalledWith([
      'v1/photo-1/400.webp',
      'v1/photo-1/1080.webp',
      'v1/photo-1/1600.webp',
    ]);
  });

  it('stops and cleans up when an upload fails part way', async () => {
    mockUpload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'Network request failed' } });
    await expect(uploadVendorPhoto('v1', photo)).rejects.toThrow('Network request failed');
    expect(mockRemove).toHaveBeenCalledWith(['v1/photo-1/400.webp']);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
