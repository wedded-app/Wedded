/**
 * Adding a reel by pasting a TikTok or Instagram link (B5). People paste
 * whatever the app's Share → Copy link gave them, sometimes with words around
 * it ("Look at this https://vm.tiktok.com/ZMabc/"), so the first link in the
 * text is used. The database takes only a post's full address and tidies it
 * (create_linked_reel); a TikTok short link is opened here first with
 * TikTok's oEmbed, which needs no key. Instagram's oEmbed needs a Meta app
 * token, so an Instagram link must be the full reel address, which is what
 * Instagram's Copy link gives.
 */

export type ReelPlatform = 'tiktok' | 'instagram';

/** A post's full address, ready for create_linked_reel. */
export type ReelLink = {
  platform: ReelPlatform;
  url: string;
  postId: string;
  handle: string | null;
};

export type ReelLinkError =
  /** Not a TikTok or Instagram post link. */
  | 'notALink'
  /** A link we can't open without the platform's help (an Instagram share link). */
  | 'openInApp'
  /** TikTok didn't recognise the short link (deleted, private or mistyped). */
  | 'notFound'
  /** No internet, or TikTok didn't answer. */
  | 'offline';

const TIKTOK_POST =
  /^https?:\/\/(?:www\.|m\.)?tiktok\.com\/@([A-Za-z0-9._]{1,24})\/video\/(\d{5,25})/i;
const TIKTOK_SHORT =
  /^https?:\/\/(?:vm\.tiktok\.com|vt\.tiktok\.com|(?:www\.)?tiktok\.com\/t)\/[A-Za-z0-9]+/i;
const INSTAGRAM_POST = /^https?:\/\/(?:www\.)?instagram\.com\/(?:reels?|p)\/([A-Za-z0-9_-]{5,40})/i;
const INSTAGRAM_OTHER = /^https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\//i;

/** The first web address in some pasted text, without trailing punctuation. */
export function firstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0].replace(/[).,!?]+$/, '') : null;
}

export type ParsedLink =
  | { kind: 'post'; link: ReelLink }
  | { kind: 'tiktokShort'; url: string }
  | { kind: 'error'; error: ReelLinkError };

/** What a pasted text points to, without going online. */
export function parseReelLink(text: string): ParsedLink {
  const url = firstUrl(text.trim());
  if (!url) return { kind: 'error', error: 'notALink' };
  const tiktok = url.match(TIKTOK_POST);
  if (tiktok) {
    return {
      kind: 'post',
      link: {
        platform: 'tiktok',
        url: `https://www.tiktok.com/@${tiktok[1]}/video/${tiktok[2]}`,
        postId: tiktok[2],
        handle: tiktok[1],
      },
    };
  }
  if (TIKTOK_SHORT.test(url)) return { kind: 'tiktokShort', url };
  const instagram = url.match(INSTAGRAM_POST);
  if (instagram) {
    return {
      kind: 'post',
      link: {
        platform: 'instagram',
        url: `https://www.instagram.com/reel/${instagram[1]}/`,
        postId: instagram[1],
        handle: null,
      },
    };
  }
  if (INSTAGRAM_OTHER.test(url)) return { kind: 'error', error: 'openInApp' };
  return { kind: 'error', error: 'notALink' };
}

type Fetch = (
  input: string,
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/**
 * A pasted text as a post's full address, asking TikTok for short links.
 * Throws a ReelLinkError name.
 */
export async function resolveReelLink(text: string, fetchImpl: Fetch = fetch): Promise<ReelLink> {
  const parsed = parseReelLink(text);
  if (parsed.kind === 'post') return parsed.link;
  if (parsed.kind === 'error') throw new Error(parsed.error);

  let response: Awaited<ReturnType<Fetch>>;
  try {
    response = await fetchImpl(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(parsed.url)}`,
    );
  } catch {
    throw new Error('offline');
  }
  if (!response.ok) throw new Error(response.status >= 500 ? 'offline' : 'notFound');
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const handle = typeof data?.author_unique_id === 'string' ? data.author_unique_id : null;
  const postId = typeof data?.embed_product_id === 'string' ? data.embed_product_id : null;
  if (!handle || !postId || !/^\d{5,25}$/.test(postId)) throw new Error('notFound');
  return {
    platform: 'tiktok',
    url: `https://www.tiktok.com/@${handle}/video/${postId}`,
    postId,
    handle,
  };
}

/** Which ReelLinkError a thrown error is, for the message to show. */
export function reelLinkErrorKind(error: unknown): ReelLinkError {
  const message = error instanceof Error ? error.message : '';
  return message === 'openInApp' || message === 'notFound' || message === 'offline'
    ? message
    : 'notALink';
}

/** The post's id from the address the database stored (its tidy form). */
export function postIdFromUrl(platform: ReelPlatform, url: string): string | null {
  const match =
    platform === 'tiktok'
      ? url.match(/\/video\/(\d{5,25})/)
      : url.match(/instagram\.com\/reel\/([A-Za-z0-9_-]{5,40})/);
  return match ? match[1] : null;
}

/**
 * The platform's own player for a post, to show inside the app: TikTok's
 * embed player (looping, without its music and caption bars, which our reel
 * shows itself) or Instagram's embed page.
 */
export function embedUrl(platform: ReelPlatform, url: string): string | null {
  const id = postIdFromUrl(platform, url);
  if (!id) return null;
  return platform === 'tiktok'
    ? `https://www.tiktok.com/player/v1/${id}?autoplay=1&loop=1&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0`
    : `https://www.instagram.com/reel/${id}/embed/`;
}
