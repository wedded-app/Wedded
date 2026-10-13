import {
  embedUrl,
  firstUrl,
  parseReelLink,
  postIdFromUrl,
  reelLinkErrorKind,
  resolveReelLink,
} from './reel-link';

const answer = (status: number, body: unknown) =>
  jest.fn(async () => ({ ok: status < 400, status, json: async () => body }));

describe('firstUrl', () => {
  it('finds the link in whatever was pasted', () => {
    expect(firstUrl('Look at this!! https://vm.tiktok.com/ZMabc12/ so good')).toBe(
      'https://vm.tiktok.com/ZMabc12/',
    );
    expect(firstUrl('(https://www.instagram.com/reel/C9xYz_Ab12/).')).toBe(
      'https://www.instagram.com/reel/C9xYz_Ab12/',
    );
    expect(firstUrl('no link here')).toBeNull();
  });
});

describe('parseReelLink', () => {
  it('tidies a TikTok post and keeps its handle for the credit', () => {
    expect(
      parseReelLink('https://www.tiktok.com/@gabrudhol/video/7412345678901234567?is_from_webapp=1'),
    ).toEqual({
      kind: 'post',
      link: {
        platform: 'tiktok',
        url: 'https://www.tiktok.com/@gabrudhol/video/7412345678901234567',
        postId: '7412345678901234567',
        handle: 'gabrudhol',
      },
    });
  });

  it('reads Instagram reels and posts as one tidy reel address', () => {
    for (const pasted of [
      'https://www.instagram.com/reel/C9xYz_Ab12/?igsh=abc',
      'https://instagram.com/reels/C9xYz_Ab12',
      'https://www.instagram.com/p/C9xYz_Ab12/',
    ]) {
      expect(parseReelLink(pasted)).toEqual({
        kind: 'post',
        link: {
          platform: 'instagram',
          url: 'https://www.instagram.com/reel/C9xYz_Ab12/',
          postId: 'C9xYz_Ab12',
          handle: null,
        },
      });
    }
  });

  it('sends TikTok short links to be opened first', () => {
    expect(parseReelLink('https://vm.tiktok.com/ZMabc12/')).toEqual({
      kind: 'tiktokShort',
      url: 'https://vm.tiktok.com/ZMabc12/',
    });
    expect(parseReelLink('https://www.tiktok.com/t/ZTabc12/').kind).toBe('tiktokShort');
  });

  it('asks for the full reel link for other Instagram links, and refuses everything else', () => {
    expect(parseReelLink('https://www.instagram.com/share/reel/BAabc/')).toEqual({
      kind: 'error',
      error: 'openInApp',
    });
    expect(parseReelLink('https://www.youtube.com/watch?v=abc')).toEqual({
      kind: 'error',
      error: 'notALink',
    });
    expect(parseReelLink('dhol at our jaago')).toEqual({ kind: 'error', error: 'notALink' });
  });
});

describe('resolveReelLink', () => {
  it('opens a TikTok short link with TikTok oEmbed', async () => {
    const fetchImpl = answer(200, {
      author_unique_id: 'gabrudhol',
      embed_product_id: '7412345678901234567',
    });
    await expect(resolveReelLink('https://vm.tiktok.com/ZMabc12/', fetchImpl)).resolves.toEqual({
      platform: 'tiktok',
      url: 'https://www.tiktok.com/@gabrudhol/video/7412345678901234567',
      postId: '7412345678901234567',
      handle: 'gabrudhol',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://www.tiktok.com/oembed?url=https%3A%2F%2Fvm.tiktok.com%2FZMabc12%2F',
    );
  });

  it('needs no network for full addresses', async () => {
    const fetchImpl = answer(500, null);
    await expect(
      resolveReelLink('https://www.instagram.com/reel/C9xYz_Ab12/', fetchImpl),
    ).resolves.toMatchObject({ platform: 'instagram', postId: 'C9xYz_Ab12' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('says what went wrong', async () => {
    const kind = (promise: Promise<unknown>) => promise.catch((e: unknown) => reelLinkErrorKind(e));
    await expect(
      kind(resolveReelLink('https://vm.tiktok.com/gone/', answer(400, {}))),
    ).resolves.toBe('notFound');
    await expect(
      kind(resolveReelLink('https://vm.tiktok.com/x/', answer(503, null))),
    ).resolves.toBe('offline');
    const offline = jest.fn(async () => {
      throw new Error('Network request failed');
    });
    await expect(kind(resolveReelLink('https://vm.tiktok.com/x/', offline))).resolves.toBe(
      'offline',
    );
    await expect(kind(resolveReelLink('hello', answer(200, {})))).resolves.toBe('notALink');
  });
});

describe('the platform player', () => {
  it('finds the post id in the stored address', () => {
    expect(
      postIdFromUrl('tiktok', 'https://www.tiktok.com/@gabrudhol/video/7412345678901234567'),
    ).toBe('7412345678901234567');
    expect(postIdFromUrl('instagram', 'https://www.instagram.com/reel/C9xYz_Ab12/')).toBe(
      'C9xYz_Ab12',
    );
  });

  it("uses TikTok's player and Instagram's embed page", () => {
    expect(
      embedUrl('tiktok', 'https://www.tiktok.com/@gabrudhol/video/7412345678901234567'),
    ).toMatch(/^https:\/\/www\.tiktok\.com\/player\/v1\/7412345678901234567\?autoplay=1&loop=1/);
    expect(embedUrl('instagram', 'https://www.instagram.com/reel/C9xYz_Ab12/')).toBe(
      'https://www.instagram.com/reel/C9xYz_Ab12/embed/',
    );
    expect(embedUrl('tiktok', 'https://www.tiktok.com/@x')).toBeNull();
  });
});
