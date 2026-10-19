import {
  takenAtFromExif,
  toMemoryVault,
  toVaultEvents,
  uploadVaultItem,
  vaultInviteLink,
  vaultProblem,
} from './memory-vault';

const mockUpload = jest.fn();
const mockRemove = jest.fn();
const mockRpc = jest.fn();
const mockSession = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: { getSession: () => mockSession() },
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockUpload(...args),
        remove: (...args: unknown[]) => mockRemove(...args),
      }),
    },
  },
}));
jest.mock('@/features/auth/session', () => ({ useSession: () => ({ session: null }) }));
jest.mock('expo-linking', () => ({ createURL: (path: string) => `exp://dev${path}` }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'item-1' }));
jest.mock('expo-file-system', () => ({
  File: class {
    async arrayBuffer() {
      return new ArrayBuffer(8);
    }
  },
}));
// Each render comes out the size it was resized to (100 x 75 when it wasn't)
const mockResized: unknown[] = [];
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => {
      let size = { width: 100, height: 75 };
      return {
        resize: (to: { width?: number; height?: number }) => {
          mockResized.push(to);
          size = to.width ? { width: to.width, height: to.width * 0.75 } : { width: 1, height: 1 };
        },
        renderAsync: async () => ({
          saveAsync: async () => ({ uri: `file:///${size.width}.jpg`, ...size }),
        }),
      };
    },
  },
}));
jest.mock('expo-video-thumbnails', () => ({
  getThumbnailAsync: async () => ({ uri: 'file:///still.jpg', width: 1280, height: 720 }),
}));

beforeEach(() => {
  mockUpload.mockReset().mockResolvedValue({ error: null });
  mockRemove.mockReset().mockResolvedValue({ error: null });
  mockRpc.mockReset().mockResolvedValue({ data: 'item-1', error: null });
  mockSession.mockReset().mockResolvedValue({ data: { session: { user: { id: 'me' } } } });
  mockResized.length = 0;
});

describe('toVaultEvents and toMemoryVault', () => {
  it('reads the events, skipping anything malformed', () => {
    expect(
      toVaultEvents([
        { slug: 'jaago', name: { en: 'Jaago' }, date: '2027-06-11', count: 4 },
        { slug: 'reception', name: null, date: null, count: 0 },
        { name: { en: 'No slug' } },
        null,
      ]),
    ).toEqual([
      { slug: 'jaago', name: { en: 'Jaago' }, date: '2027-06-11', count: 4 },
      { slug: 'reception', name: { en: 'reception' }, date: null, count: 0 },
    ]);
    expect(toVaultEvents(null)).toEqual([]);
  });

  it('turns the API row into the vault', () => {
    const vault = toMemoryVault({
      id: 'v1',
      wedding_id: 'w1',
      title: 'Jaspreet & Amrit',
      wedding_date: '2027-06-12',
      my_role: 'family',
      can_add: true,
      uploads_open: true,
      guests_see_all: false,
      show_vendors: true,
      item_count: 12,
      my_item_count: 2,
      guest_count: 30,
      events: [],
    });
    expect(vault).toMatchObject({
      id: 'v1',
      weddingId: 'w1',
      role: 'family',
      guestsSeeAll: false,
      itemCount: 12,
      guestCount: 30,
    });
  });
});

describe('takenAtFromExif', () => {
  it("reads when a photo was taken, with the camera's offset", () => {
    expect(
      takenAtFromExif({ DateTimeOriginal: '2027:06:12 21:43:10', OffsetTimeOriginal: '-07:00' }),
    ).toBe('2027-06-13T04:43:10.000Z');
    expect(
      takenAtFromExif({
        '{Exif}': { DateTimeOriginal: '2027:06:12 21:43:10', OffsetTimeOriginal: '+05:30' },
      }),
    ).toBe('2027-06-12T16:13:10.000Z');
  });

  it("falls back to this phone's time, and to null", () => {
    expect(takenAtFromExif({ DateTimeOriginal: '2027:06:12 21:43:10' })).toBe(
      new Date(2027, 5, 12, 21, 43, 10).toISOString(),
    );
    expect(takenAtFromExif({ DateTimeOriginal: 'yesterday' })).toBeNull();
    expect(takenAtFromExif(null)).toBeNull();
  });
});

describe('vaultProblem', () => {
  it('names what went wrong', () => {
    expect(vaultProblem(new Error('uploads_locked'))).toBe('locked');
    expect(vaultProblem(new Error('too_many_items'))).toBe('tooMany');
    expect(vaultProblem(new Error('vault_full'))).toBe('full');
    expect(vaultProblem(new Error('video_too_long'))).toBe('tooLong');
    expect(vaultProblem(new Error('The object exceeded the maximum allowed size'))).toBe('tooBig');
    expect(vaultProblem(new Error('new row violates row-level security policy'))).toBe(
      'notAllowed',
    );
    expect(vaultProblem(new Error('Network request failed'))).toBe('offline');
    expect(vaultProblem(new Error('invite_revoked'))).toBe('revoked');
    expect(vaultProblem(new Error('invite_used_up'))).toBe('usedUp');
    expect(vaultProblem(new Error('too_many_vaults'))).toBe('tooManyVaults');
    expect(vaultProblem(new Error('boom'))).toBe('failed');
  });
});

describe('vaultInviteLink', () => {
  it('points into the app until there is a website', () => {
    expect(vaultInviteLink('abc')).toBe('exp://dev/join-vault/abc');
  });
});

describe('uploadVaultItem', () => {
  const photo = {
    uri: 'file:///picked.heic',
    width: 4032,
    height: 3024,
    type: 'image' as const,
    exif: { DateTimeOriginal: '2027:06:12 21:43:10', OffsetTimeOriginal: '-07:00' },
  };

  it('uploads the shrunk photo and its thumb to your folder, then saves it', async () => {
    await expect(uploadVaultItem('v1', photo, 'reception')).resolves.toBe('item-1');
    expect(mockResized).toEqual([{ width: 2560 }, { width: 640 }]);
    expect(mockUpload.mock.calls.map((c) => [c[0], c[2].contentType])).toEqual([
      ['v1/me/item-1/photo.jpg', 'image/jpeg'],
      ['v1/me/item-1/thumb.jpg', 'image/jpeg'],
    ]);
    expect(mockRpc).toHaveBeenCalledWith('add_vault_item', {
      p_vault_id: 'v1',
      p_item_id: 'item-1',
      p_kind: 'photo',
      p_path: 'v1/me/item-1/photo.jpg',
      p_thumb_path: 'v1/me/item-1/thumb.jpg',
      p_event_slug: 'reception',
      p_width: 2560,
      p_height: 1920,
      p_duration_ms: undefined,
      p_taken_at: '2027-06-13T04:43:10.000Z',
    });
  });

  it('uploads a clip as it is, with a still', async () => {
    await uploadVaultItem(
      'v1',
      {
        uri: 'file:///clip.mov',
        width: 1920,
        height: 1080,
        type: 'video',
        duration: 42_300,
        mimeType: 'video/quicktime',
      },
      null,
    );
    expect(mockUpload.mock.calls.map((c) => [c[0], c[2].contentType])).toEqual([
      ['v1/me/item-1/video.mov', 'video/quicktime'],
      ['v1/me/item-1/thumb.jpg', 'image/jpeg'],
    ]);
    expect(mockRpc.mock.calls[0][1]).toMatchObject({
      p_kind: 'video',
      p_path: 'v1/me/item-1/video.mov',
      p_width: 1920,
      p_height: 1080,
      p_duration_ms: 42_300,
      p_event_slug: undefined,
    });
  });

  it('refuses a clip over a minute before uploading anything', async () => {
    await expect(
      uploadVaultItem('v1', { ...photo, type: 'video', duration: 75_000 }, null),
    ).rejects.toThrow('video_too_long');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('deletes the uploaded files when saving is refused', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'uploads_locked' } });
    await expect(uploadVaultItem('v1', photo, null)).rejects.toThrow('uploads_locked');
    expect(mockRemove).toHaveBeenCalledWith(['v1/me/item-1/photo.jpg', 'v1/me/item-1/thumb.jpg']);
  });

  it('needs you signed in', async () => {
    mockSession.mockResolvedValue({ data: { session: null } });
    await expect(uploadVaultItem('v1', photo, null)).rejects.toThrow('not_signed_in');
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
