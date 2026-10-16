import { groupStories, storyErrorKind } from './stories';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/reels/${path}` } }),
      }),
    },
  },
}));

const row = (over: Record<string, unknown>) => ({
  id: 's1',
  kind: 'photo',
  media_path: 'u1/story-1.jpg',
  thumb_path: null,
  duration_s: null,
  caption: null,
  created_at: '2026-10-16T10:00:00Z',
  author_id: 'u1',
  author_name: 'Asha K.',
  vendor_id: null,
  vendor_slug: null,
  vendor_name: null,
  following: false,
  is_mine: false,
  is_sample: false,
  ...over,
});

describe('groupStories', () => {
  it('puts one poster per group, in the order the stories were posted', () => {
    const groups = groupStories([
      row({ id: 'a1' }),
      row({ id: 'h1', author_id: 'u2', vendor_id: 'v1', vendor_slug: 'hall', vendor_name: 'Hall' }),
      row({
        id: 'a2',
        kind: 'video',
        media_path: 'u1/c.mp4',
        thumb_path: 'u1/c.jpg',
        duration_s: 12,
      }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['u1', 'v1']);
    expect(groups[0].stories.map((s) => s.id)).toEqual(['a1', 'a2']);
    expect(groups[1]).toMatchObject({ name: 'Hall', vendor: { slug: 'hall' }, authorId: 'u2' });
  });

  it('rings a photo with itself and a clip with its still', () => {
    const [group] = groupStories([
      row({ id: 'p' }),
      row({
        id: 'c',
        kind: 'video',
        media_path: 'u1/c.mp4',
        thumb_path: 'u1/c.jpg',
        duration_s: 12,
      }),
      row({ id: 'n', kind: 'video', media_path: 'u1/n.mp4', duration_s: 3 }),
    ]);
    expect(group.stories.map((s) => s.thumbUrl)).toEqual([
      'https://cdn.test/reels/u1/story-1.jpg',
      'https://cdn.test/reels/u1/c.jpg',
      null,
    ]);
    expect(group.stories[1]).toMatchObject({ kind: 'video', durationS: 12 });
  });

  it('keeps a person posting as themselves apart from their business', () => {
    const groups = groupStories([
      row({ id: 'me' }),
      row({ id: 'biz', vendor_id: 'v1', vendor_slug: 'hall', vendor_name: 'Hall' }),
    ]);
    expect(groups.map((g) => g.key).sort()).toEqual(['u1', 'v1']);
  });

  it('orders yours, then the ones you follow, then the newest', () => {
    const groups = groupStories([
      row({ id: '1', author_id: 'old', created_at: '2026-10-16T08:00:00Z' }),
      row({ id: '2', author_id: 'followed', following: true, created_at: '2026-10-16T09:00:00Z' }),
      row({ id: '3', author_id: 'new', created_at: '2026-10-16T11:00:00Z' }),
      row({ id: '4', author_id: 'me', is_mine: true, created_at: '2026-10-16T07:00:00Z' }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['me', 'followed', 'new', 'old']);
  });
});

describe('storyErrorKind', () => {
  it('names the database errors', () => {
    expect(storyErrorKind(new Error('story_limit'))).toBe('limit');
    expect(storyErrorKind(new Error('consent_required'))).toBe('consent');
    expect(storyErrorKind(new Error('The object exceeded the maximum allowed size'))).toBe(
      'tooBig',
    );
    expect(storyErrorKind(new Error('network'))).toBe('failed');
  });
});
