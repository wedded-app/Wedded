import {
  clipProblem,
  compactCount,
  postErrorKind,
  REEL_MAX_BYTES,
  reelVendors,
  toReel,
} from './reels';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/reels/${path}` } }),
      }),
    },
  },
}));

const row = {
  id: 'r1',
  video_path: 'u1/jaago.mp4',
  thumb_path: 'u1/jaago.jpg',
  duration_s: 5,
  width: 720,
  height: 1280,
  caption: 'Our jaago',
  event_slug: 'jaago',
  created_at: '2026-10-05T10:00:00Z',
  author_id: 'u1',
  author_name: 'Simran K.',
  vendor_id: null,
  vendor_slug: null,
  vendor_name: null,
  tags: [
    { vendor_id: 'v1', slug: 'gabru-dhol', name: 'Gabru Dhol Crew', status: 'approved' },
    { vendor_id: 'v2', slug: 'golden-moments', name: 'Golden Moments', status: 'pending' },
    { vendor_id: 'v3', name: 'No slug' },
    'nonsense',
  ],
  like_count: 12,
  comment_count: 3,
  liked: true,
  following: false,
  is_mine: false,
};

describe('reels', () => {
  it('turns a feed row into a reel with playable links', () => {
    const reel = toReel(row);
    expect(reel.videoUrl).toBe('https://cdn.test/reels/u1/jaago.mp4');
    expect(reel.thumbUrl).toBe('https://cdn.test/reels/u1/jaago.jpg');
    expect(reel.vendor).toBeNull();
    expect(reel.likeCount).toBe(12);
  });

  it('says an upload came from here', () => {
    const reel = toReel(row);
    expect(reel.source).toBe('upload');
    expect(reel.platform).toBeNull();
    expect(reel.durationS).toBe(5);
  });

  it('turns a pasted link into a reel with no file of ours, crediting its maker', () => {
    const reel = toReel({
      ...row,
      video_path: null,
      thumb_path: null,
      duration_s: null,
      source: 'link',
      platform: 'tiktok',
      source_url: 'https://www.tiktok.com/@gabrudhol/video/7412345678901234567',
      credit_name: '@gabrudhol',
    });
    expect(reel.videoUrl).toBeNull();
    expect(reel.durationS).toBeNull();
    expect(reel.source).toBe('link');
    expect(reel.platform).toBe('tiktok');
    expect(reel.sourceUrl).toBe('https://www.tiktok.com/@gabrudhol/video/7412345678901234567');
    expect(reel.creditName).toBe('@gabrudhol');
  });

  it('names the link errors', () => {
    expect(postErrorKind(new Error('unsupported_link'))).toBe('unsupportedLink');
    expect(postErrorKind(new Error('already_added'))).toBe('alreadyAdded');
  });

  it('keeps only usable tags, approved or still pending', () => {
    expect(toReel(row).tags).toEqual([
      { vendorId: 'v1', slug: 'gabru-dhol', name: 'Gabru Dhol Crew', approved: true },
      { vendorId: 'v2', slug: 'golden-moments', name: 'Golden Moments', approved: false },
    ]);
  });

  it('shows a vendor post as the business', () => {
    const reel = toReel({
      ...row,
      vendor_id: 'v9',
      vendor_slug: 'rang-mehndi',
      vendor_name: 'Rang Mehndi',
      thumb_path: null,
    });
    expect(reel.vendor).toEqual({ id: 'v9', slug: 'rang-mehndi', name: 'Rang Mehndi' });
    expect(reel.thumbUrl).toBeNull();
  });

  it('lists the posting vendor first, then the tagged ones, once each', () => {
    const reel = toReel({
      ...row,
      vendor_id: 'v1',
      vendor_slug: 'gabru-dhol',
      vendor_name: 'Gabru Dhol Crew',
    });
    expect(reelVendors(reel).map((v) => v.slug)).toEqual(['gabru-dhol', 'golden-moments']);
    expect(reelVendors({ vendor: null, tags: [] })).toEqual([]);
    expect(reelVendors(toReel(row))[0]).toEqual({
      id: 'v1',
      slug: 'gabru-dhol',
      name: 'Gabru Dhol Crew',
    });
  });

  it('writes counts the way people read them under a reel', () => {
    expect(compactCount(0)).toBe('0');
    expect(compactCount(999)).toBe('999');
    expect(compactCount(1000)).toBe('1K');
    expect(compactCount(2450)).toBe('2.5K');
    expect(compactCount(12_400)).toBe('12K');
    expect(compactCount(1_200_000)).toBe('1.2M');
  });

  it('turns away clips that are too long, too big or not videos', () => {
    const ok = { durationMs: 30_000, fileSize: 20_000_000, mimeType: 'video/mp4' };
    expect(clipProblem(ok)).toBeNull();
    // The trimmer can land a few frames over the minute
    expect(clipProblem({ ...ok, durationMs: 60_400 })).toBeNull();
    expect(clipProblem({ ...ok, durationMs: 75_000 })).toBe('tooLong');
    expect(clipProblem({ ...ok, fileSize: REEL_MAX_BYTES + 1 })).toBe('tooBig');
    expect(clipProblem({ ...ok, mimeType: 'image/jpeg' })).toBe('notVideo');
    expect(
      clipProblem({ durationMs: null, fileSize: null, mimeType: 'video/quicktime' }),
    ).toBeNull();
  });

  it('explains a refused post in words', () => {
    expect(postErrorKind(new Error('consent_required'))).toBe('consent');
    expect(postErrorKind(new Error('reel_limit'))).toBe('limit');
    expect(postErrorKind(new Error('too_many_tags'))).toBe('tooMany');
    expect(postErrorKind(new Error('vendor_not_found'))).toBe('vendorGone');
    expect(postErrorKind(new Error('The object exceeded the maximum allowed size'))).toBe('tooBig');
    expect(postErrorKind(new Error('not_signed_in'))).toBe('notSignedIn');
    expect(postErrorKind(new Error('Network request failed'))).toBe('failed');
    expect(postErrorKind(undefined)).toBe('failed');
  });
});
