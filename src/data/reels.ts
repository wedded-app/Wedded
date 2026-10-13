/**
 * Reels (DECISIONS.md, 2026-10-05): wedding clips from families and vendors,
 * in a Following and a For you feed, with vendor tags, likes, comments,
 * follows, blocking and reports. Videos stream straight from the public
 * `reels` bucket.
 */
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useSession } from '@/features/auth/session';
import type { ReelLink, ReelPlatform } from '@/features/reels/reel-link';
import { supabase } from '@/lib/supabase';

export type FeedMode = 'for_you' | 'following';

export type ReelTag = {
  vendorId: string;
  slug: string;
  name: string;
  /** Pending until the vendor approves it. */
  approved: boolean;
};

export type Reel = {
  id: string;
  /** Null for a pasted link: it plays in TikTok's or Instagram's own player. */
  videoPath: string | null;
  thumbPath: string | null;
  videoUrl: string | null;
  thumbUrl: string | null;
  durationS: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  eventSlug: string | null;
  createdAt: string;
  authorId: string;
  /** "Asha K." for a family's clip. */
  authorName: string | null;
  /** Set when a vendor posted it: shown as the business. */
  vendor: { id: string; slug: string; name: string } | null;
  tags: ReelTag[];
  likeCount: number;
  commentCount: number;
  liked: boolean;
  following: boolean;
  isMine: boolean;
  /** Uploaded here, imported from a linked account, or a pasted link. */
  source: 'upload' | 'import' | 'link';
  /** Where an import or link came from, its address and who made it ("@gabrudhol"). */
  platform: ReelPlatform | null;
  sourceUrl: string | null;
  creditName: string | null;
};

/** A public file in the reels bucket. */
export function reelFileUrl(path: string): string {
  return supabase.storage.from('reels').getPublicUrl(path).data.publicUrl;
}

type FeedRow = {
  id: string;
  video_path: string | null;
  thumb_path: string | null;
  duration_s: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  event_slug: string | null;
  created_at: string;
  author_id: string;
  author_name: string | null;
  vendor_id: string | null;
  vendor_slug: string | null;
  vendor_name: string | null;
  tags: unknown;
  like_count: number;
  comment_count: number;
  liked: boolean;
  following: boolean;
  is_mine: boolean;
  source?: string | null;
  platform?: string | null;
  source_url?: string | null;
  credit_name?: string | null;
};

function toTags(value: unknown): ReelTag[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
    .map((t) => ({
      vendorId: String(t.vendor_id ?? ''),
      slug: String(t.slug ?? ''),
      name: String(t.name ?? ''),
      approved: t.status === 'approved',
    }))
    .filter((t) => t.slug.length > 0);
}

export function toReel(row: FeedRow): Reel {
  return {
    id: row.id,
    videoPath: row.video_path,
    thumbPath: row.thumb_path,
    videoUrl: row.video_path ? reelFileUrl(row.video_path) : null,
    thumbUrl: row.thumb_path ? reelFileUrl(row.thumb_path) : null,
    durationS: row.duration_s === null ? null : Number(row.duration_s),
    width: row.width,
    height: row.height,
    caption: row.caption,
    eventSlug: row.event_slug,
    createdAt: row.created_at,
    authorId: row.author_id,
    authorName: row.author_name,
    vendor:
      row.vendor_id && row.vendor_slug && row.vendor_name
        ? { id: row.vendor_id, slug: row.vendor_slug, name: row.vendor_name }
        : null,
    tags: toTags(row.tags),
    likeCount: Number(row.like_count),
    commentCount: Number(row.comment_count),
    liked: row.liked,
    following: row.following,
    isMine: row.is_mine,
    source: row.source === 'import' || row.source === 'link' ? row.source : 'upload',
    platform: row.platform === 'tiktok' || row.platform === 'instagram' ? row.platform : null,
    sourceUrl: row.source_url ?? null,
    creditName: row.credit_name ?? null,
  };
}

export type ReelVendor = { id: string; slug: string; name: string };

/** The vendors a family can book from a reel: the one who posted it, then the ones tagged. */
export function reelVendors(reel: Pick<Reel, 'vendor' | 'tags'>): ReelVendor[] {
  const all = [
    ...(reel.vendor ? [reel.vendor] : []),
    ...reel.tags.map((tag) => ({ id: tag.vendorId, slug: tag.slug, name: tag.name })),
  ];
  return all.filter((v, i) => all.findIndex((other) => other.slug === v.slug) === i);
}

/** "2.4K", "12K", "1.2M": counts as people read them under a reel. */
export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  if (n < 1_000_000) return `${Math.floor(n / 1000)}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

const PAGE = 8;

export const reelKeys = {
  all: ['reels'] as const,
  feed: (mode: string, userId: string, target = '') =>
    ['reels', 'feed', mode, userId, target] as const,
  comments: (reelId: string) => ['reels', 'comments', reelId] as const,
  person: (userId: string) => ['reels', 'person', userId] as const,
};

type Feed =
  /** `eventSlug` shows only the reels of that event (Jaago, Mehndi…). */
  | { mode: FeedMode; eventSlug?: string | null }
  | { mode: 'person'; userId: string }
  | { mode: 'vendor'; vendorId: string };

/** Pages of reels, newest first; load more with fetchNextPage. */
export function useReelsFeed(feed: Feed) {
  const { session } = useSession();
  const me = session?.user.id ?? '';
  const eventSlug = 'eventSlug' in feed ? (feed.eventSlug ?? null) : null;
  const target =
    feed.mode === 'person'
      ? feed.userId
      : feed.mode === 'vendor'
        ? feed.vendorId
        : (eventSlug ?? '');
  return useInfiniteQuery({
    queryKey: reelKeys.feed(feed.mode, me, target),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<Reel[]> => {
      const { data, error } = await supabase.rpc('reels_feed', {
        p_mode: feed.mode,
        p_before: pageParam ?? undefined,
        p_limit: PAGE,
        p_user_id: feed.mode === 'person' ? feed.userId : undefined,
        p_vendor_id: feed.mode === 'vendor' ? feed.vendorId : undefined,
        p_event_slug: eventSlug ?? undefined,
      });
      if (error) throw error;
      return (data as FeedRow[]).map(toReel);
    },
    getNextPageParam: (last) => (last.length < PAGE ? null : last[last.length - 1].createdAt),
    // Following needs an account; For you works for everyone
    enabled: feed.mode !== 'following' || me.length > 0,
  });
}

type FeedCache = InfiniteData<Reel[], string | null>;

/** Change one reel everywhere it's cached, for instant likes and follows. */
function patchReels(
  queryClient: ReturnType<typeof useQueryClient>,
  match: (reel: Reel) => boolean,
  change: (reel: Reel) => Reel,
) {
  queryClient.setQueriesData<FeedCache>({ queryKey: ['reels', 'feed'] }, (old) =>
    old
      ? { ...old, pages: old.pages.map((page) => page.map((r) => (match(r) ? change(r) : r))) }
      : old,
  );
}

/** Like or unlike, shown at once and undone if it fails. */
export function useToggleLike() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  return useMutation({
    mutationFn: async ({ reelId, like }: { reelId: string; like: boolean }) => {
      const { error } = like
        ? await supabase.from('reel_likes').insert({ reel_id: reelId })
        : await supabase
            .from('reel_likes')
            .delete()
            .eq('reel_id', reelId)
            .eq('user_id', session?.user.id ?? '');
      // Already liked (a double tap racing a tap) is fine
      if (error && error.code !== '23505') throw error;
    },
    onMutate: ({ reelId, like }) =>
      patchReels(
        queryClient,
        (r) => r.id === reelId,
        (r) =>
          r.liked === like ? r : { ...r, liked: like, likeCount: r.likeCount + (like ? 1 : -1) },
      ),
    onError: (_e, { reelId, like }) =>
      patchReels(
        queryClient,
        (r) => r.id === reelId,
        (r) => ({ ...r, liked: !like, likeCount: r.likeCount + (like ? -1 : 1) }),
      ),
  });
}

export type FollowTarget = { userId: string } | { vendorId: string };

/** Follow or unfollow a person or a vendor, shown at once. */
export function useToggleFollow() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const isTarget = (t: FollowTarget) => (r: Reel) =>
    'vendorId' in t ? r.vendor?.id === t.vendorId : !r.vendor && r.authorId === t.userId;
  return useMutation({
    mutationFn: async ({ target, follow }: { target: FollowTarget; follow: boolean }) => {
      const column = 'vendorId' in target ? 'vendor_id' : 'user_id';
      const value = 'vendorId' in target ? target.vendorId : target.userId;
      const { error } = follow
        ? await supabase.from('follows').insert({ [column]: value })
        : await supabase
            .from('follows')
            .delete()
            .eq('follower_id', session?.user.id ?? '')
            .eq(column, value);
      if (error && error.code !== '23505') throw error;
    },
    onMutate: ({ target, follow }) =>
      patchReels(queryClient, isTarget(target), (r) => ({ ...r, following: follow })),
    onError: (_e, { target, follow }) =>
      patchReels(queryClient, isTarget(target), (r) => ({ ...r, following: !follow })),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['reels', 'feed', 'following'] });
      void queryClient.invalidateQueries({ queryKey: ['reels', 'person'] });
    },
  });
}

export type ReelComment = {
  id: string;
  userId: string;
  name: string | null;
  body: string;
  createdAt: string;
  isMine: boolean;
};

export function useReelComments(reelId: string) {
  return useQuery({
    queryKey: reelKeys.comments(reelId),
    queryFn: async (): Promise<ReelComment[]> => {
      const { data, error } = await supabase.rpc('reel_comments_list', { p_reel_id: reelId });
      if (error) throw error;
      return data.map((c) => ({
        id: c.id,
        userId: c.user_id,
        name: c.name,
        body: c.body,
        createdAt: c.created_at,
        isMine: c.is_mine,
      }));
    },
    enabled: reelId.length > 0,
  });
}

function countComments(queryClient: ReturnType<typeof useQueryClient>, reelId: string, by: number) {
  patchReels(
    queryClient,
    (r) => r.id === reelId,
    (r) => ({ ...r, commentCount: Math.max(0, r.commentCount + by) }),
  );
}

export function useAddComment(reelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.rpc('add_reel_comment', { p_reel_id: reelId, p_body: body });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      countComments(queryClient, reelId, 1);
      void queryClient.invalidateQueries({ queryKey: reelKeys.comments(reelId) });
    },
  });
}

/** Delete your own comment, or (as the reel's poster) hide someone's. */
export function useRemoveComment(reelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, mine }: { id: string; mine: boolean }) => {
      const { error } = mine
        ? await supabase.from('reel_comments').delete().eq('id', id)
        : await supabase.rpc('hide_reel_comment', { p_comment_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      countComments(queryClient, reelId, -1);
      void queryClient.invalidateQueries({ queryKey: reelKeys.comments(reelId) });
    },
  });
}

export type ReportReason =
  'inappropriate' | 'not_mine' | 'privacy' | 'spam' | 'harassment' | 'other';
export type ReportTarget = { reelId: string } | { commentId: string } | { userId: string };

export function useReport() {
  return useMutation({
    mutationFn: async ({
      target,
      reason,
      note,
    }: {
      target: ReportTarget;
      reason: ReportReason;
      note?: string;
    }) => {
      const { error } = await supabase.rpc('report_reel_content', {
        p_reel_id: 'reelId' in target ? target.reelId : undefined,
        p_comment_id: 'commentId' in target ? target.commentId : undefined,
        p_user_id: 'userId' in target ? target.userId : undefined,
        p_reason: reason,
        p_note: note?.trim() || undefined,
      });
      if (error) throw new Error(error.message);
    },
  });
}

/** Block or unblock a person: their reels and comments disappear both ways. */
export function useToggleBlock() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  return useMutation({
    mutationFn: async ({ userId, block }: { userId: string; block: boolean }) => {
      const { error } = block
        ? await supabase.from('user_blocks').insert({ blocked_id: userId })
        : await supabase
            .from('user_blocks')
            .delete()
            .eq('blocker_id', session?.user.id ?? '')
            .eq('blocked_id', userId);
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reelKeys.all }),
  });
}

export type ReelPerson = {
  name: string | null;
  reelCount: number;
  followerCount: number;
  followingCount: number;
  following: boolean;
  blocked: boolean;
};

/** A person's page header. Null when they're gone or have blocked you. */
export function useReelPerson(userId: string) {
  const { session } = useSession();
  return useQuery({
    queryKey: [...reelKeys.person(userId), session?.user.id ?? ''],
    queryFn: async (): Promise<ReelPerson | null> => {
      const { data, error } = await supabase.rpc('reel_person', { p_user_id: userId });
      if (error) throw error;
      const row = data[0];
      return row
        ? {
            name: row.name,
            reelCount: Number(row.reel_count),
            followerCount: Number(row.follower_count),
            followingCount: Number(row.following_count),
            following: row.following,
            blocked: row.blocked,
          }
        : null;
    },
    enabled: userId.length > 0,
  });
}

/** Delete your own reel and its files. */
export function useDeleteReel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reel: Reel) => {
      const { error } = await supabase.from('reels').delete().eq('id', reel.id);
      if (error) throw error;
      // The row is gone either way; leftover files only cost storage. A pasted
      // link has no files of ours.
      const files = [reel.videoPath, reel.thumbPath].filter((path): path is string => !!path);
      if (files.length > 0) await supabase.storage.from('reels').remove(files);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reelKeys.all }),
  });
}

// Posting ----------------------------------------------------------------------------------------

/** Longest clip and biggest file a reel can be (the bucket's limit is 50 MB). */
export const REEL_MAX_SECONDS = 60;
export const REEL_MAX_BYTES = 50 * 1024 * 1024;

export type ClipProblem = 'tooLong' | 'tooBig' | 'notVideo';

/** Why a picked clip can't be posted, or null. Duration in ms, as the picker gives it. */
export function clipProblem(clip: {
  durationMs: number | null;
  fileSize: number | null;
  mimeType: string | null;
}): ClipProblem | null {
  if (clip.mimeType && !clip.mimeType.startsWith('video/')) return 'notVideo';
  if (clip.durationMs && clip.durationMs > (REEL_MAX_SECONDS + 1) * 1000) return 'tooLong';
  if (clip.fileSize && clip.fileSize > REEL_MAX_BYTES) return 'tooBig';
  return null;
}

export type PostError =
  | 'notSignedIn'
  | 'consent'
  | 'tooMany'
  | 'limit'
  | 'vendorGone'
  | 'tooBig'
  | 'unsupportedLink'
  | 'alreadyAdded'
  | 'failed';

/** Which message to show when posting fails (the database's error names). */
export function postErrorKind(error: unknown): PostError {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.includes('not_signed_in')) return 'notSignedIn';
  if (message.includes('consent_required')) return 'consent';
  if (message.includes('too_many_tags')) return 'tooMany';
  if (message.includes('reel_limit')) return 'limit';
  if (message.includes('vendor_not_found')) return 'vendorGone';
  if (message.includes('unsupported_link')) return 'unsupportedLink';
  if (message.includes('already_added')) return 'alreadyAdded';
  if (/maximum allowed size|payload too large|413/i.test(message)) return 'tooBig';
  return 'failed';
}

export type ReelDraft = {
  /** The clip and its first-second thumbnail, as bytes. */
  video: { bytes: ArrayBuffer; mimeType: string };
  thumb: ArrayBuffer | null;
  durationS: number;
  width: number | null;
  height: number | null;
  caption: string;
  eventSlug: string | null;
  vendorIds: string[];
  /** Post as this business (you're one of its people), or null for yourself. */
  asVendorId: string | null;
  consent: boolean;
};

// create_reel takes SQL null for the optional parts; the generated types
// list every argument as required, so null goes through this.
const sqlNull = <T>(value: T | null): T => value as T;

/** Uploads the clip to your own folder, then posts it. Returns the reel's id. */
export function usePostReel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: ReelDraft): Promise<string> => {
      // Read at the moment of posting: it may follow a sign-in started by Post
      const { data: auth } = await supabase.auth.getSession();
      const me = auth.session?.user.id;
      if (!me) throw new Error('not_signed_in');
      const stem = `${me}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const ext = draft.video.mimeType.includes('quicktime') ? 'mov' : 'mp4';
      const videoPath = `${stem}.${ext}`;
      const bucket = supabase.storage.from('reels');
      const upload = await bucket.upload(videoPath, draft.video.bytes, {
        contentType: draft.video.mimeType,
        upsert: false,
      });
      if (upload.error) throw new Error(upload.error.message);
      let thumbPath: string | null = null;
      if (draft.thumb) {
        const thumb = await bucket.upload(`${stem}.jpg`, draft.thumb, {
          contentType: 'image/jpeg',
          upsert: false,
        });
        // A reel without a thumbnail still plays
        if (!thumb.error) thumbPath = `${stem}.jpg`;
      }
      const { data, error } = await supabase.rpc('create_reel', {
        p_video_path: videoPath,
        p_thumb_path: sqlNull(thumbPath),
        p_duration_s: Math.min(90, Math.max(0.1, Math.round(draft.durationS * 100) / 100)),
        p_width: sqlNull(draft.width),
        p_height: sqlNull(draft.height),
        p_caption: sqlNull(draft.caption.trim() || null),
        p_event_slug: sqlNull(draft.eventSlug),
        p_vendor_ids: draft.vendorIds,
        p_vendor_id: sqlNull(draft.asVendorId),
        p_consent: draft.consent,
      });
      if (error) {
        // Don't leave the files behind when the post itself is refused
        await bucket.remove([videoPath, ...(thumbPath ? [thumbPath] : [])]);
        throw new Error(error.message);
      }
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reelKeys.all }),
  });
}

export type LinkedReelDraft = {
  /** A post's full address (resolveReelLink). */
  link: ReelLink;
  caption: string;
  eventSlug: string | null;
  vendorIds: string[];
  asVendorId: string | null;
  consent: boolean;
};

/**
 * Add a reel from a TikTok or Instagram post's address: nothing to upload,
 * it plays in the platform's own player and credits whoever made it.
 */
export function usePostLinkedReel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: LinkedReelDraft): Promise<string> => {
      const { data, error } = await supabase.rpc('create_linked_reel', {
        p_url: draft.link.url,
        p_caption: sqlNull(draft.caption.trim() || null),
        p_event_slug: sqlNull(draft.eventSlug),
        p_vendor_ids: draft.vendorIds,
        p_vendor_id: sqlNull(draft.asVendorId),
        p_consent: draft.consent,
        p_credit_name: sqlNull(draft.link.handle ? `@${draft.link.handle}` : null),
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reelKeys.all }),
  });
}
