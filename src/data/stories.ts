/**
 * Stories (DECISIONS.md, 2026-10-16): photos and short clips from families
 * and vendors that last a day, shown as rings on the Reels tab. Files live
 * in the public `reels` bucket, like reels.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session';
import { supabase } from '@/lib/supabase';

import { reelFileUrl } from './reels';
import { assertUploadFits, REEL_VIDEO_TYPES } from './upload-limits';

export type Story = {
  id: string;
  kind: 'photo' | 'video';
  mediaPath: string;
  thumbPath: string | null;
  url: string;
  /** For the ring: a clip's still, or the photo itself. */
  thumbUrl: string | null;
  durationS: number | null;
  caption: string | null;
  createdAt: string;
};

/** One poster's stories: a business, or a person posting as themselves. */
export type StoryGroup = {
  /** The vendor's id when a business posted them, otherwise the person's. */
  key: string;
  authorId: string;
  /** "Asha K.", or the business's name. */
  name: string | null;
  vendor: { id: string; slug: string; name: string } | null;
  following: boolean;
  isMine: boolean;
  isSample: boolean;
  /** Oldest first, the order they play in. */
  stories: Story[];
};

type FeedRow = {
  id: string;
  kind: string;
  media_path: string;
  thumb_path: string | null;
  duration_s: number | null;
  caption: string | null;
  created_at: string;
  author_id: string;
  author_name: string | null;
  vendor_id: string | null;
  vendor_slug: string | null;
  vendor_name: string | null;
  following: boolean;
  is_mine: boolean;
  is_sample: boolean;
};

/**
 * Rows (oldest first) into one group per poster: your own first, then the
 * ones you follow, then everyone else, most recently posted first.
 */
export function groupStories(rows: FeedRow[]): StoryGroup[] {
  const groups = new Map<string, StoryGroup>();
  for (const row of rows) {
    const vendor =
      row.vendor_id && row.vendor_slug && row.vendor_name
        ? { id: row.vendor_id, slug: row.vendor_slug, name: row.vendor_name }
        : null;
    const key = vendor?.id ?? row.author_id;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        authorId: row.author_id,
        name: vendor?.name ?? row.author_name,
        vendor,
        following: row.following,
        isMine: row.is_mine,
        isSample: row.is_sample,
        stories: [],
      };
      groups.set(key, group);
    }
    const thumbPath = row.thumb_path ?? (row.kind === 'photo' ? row.media_path : null);
    group.stories.push({
      id: row.id,
      kind: row.kind === 'video' ? 'video' : 'photo',
      mediaPath: row.media_path,
      thumbPath: row.thumb_path,
      url: reelFileUrl(row.media_path),
      thumbUrl: thumbPath ? reelFileUrl(thumbPath) : null,
      durationS: row.duration_s === null ? null : Number(row.duration_s),
      caption: row.caption,
      createdAt: row.created_at,
    });
  }
  const latest = (g: StoryGroup) => g.stories[g.stories.length - 1].createdAt;
  return [...groups.values()].sort(
    (a, b) =>
      Number(b.isMine) - Number(a.isMine) ||
      Number(b.following) - Number(a.following) ||
      latest(b).localeCompare(latest(a)),
  );
}

export const storyKeys = { all: ['stories'] as const };

/**
 * Everyone's stories from the last day, one group per poster. Older ones are
 * deleted, files and all, by the hourly clear-stories job.
 */
export function useStories() {
  const { session } = useSession();
  const me = session?.user.id ?? '';
  return useQuery({
    queryKey: [...storyKeys.all, me],
    queryFn: async (): Promise<StoryGroup[]> => {
      const { data, error } = await supabase.rpc('stories_feed');
      if (error) throw error;
      return groupStories(data as FeedRow[]);
    },
  });
}

/** Delete one of your stories and its files. */
export function useDeleteStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (story: Story) => {
      const { error } = await supabase.from('stories').delete().eq('id', story.id);
      if (error) throw error;
      // The row is gone either way; leftover files only cost storage
      await supabase.storage
        .from('reels')
        .remove([story.mediaPath, ...(story.thumbPath ? [story.thumbPath] : [])]);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: storyKeys.all }),
  });
}

export type StoryDraft = {
  kind: 'photo' | 'video';
  file: { bytes: ArrayBuffer; mimeType: string };
  /** A clip's still for its ring. */
  thumb: ArrayBuffer | null;
  durationS: number | null;
  width: number | null;
  height: number | null;
  caption: string;
  /** Post as this business (you're one of its people), or null for yourself. */
  asVendorId: string | null;
  consent: boolean;
};

/** Which message to show when posting fails (the database's error names). */
export function storyErrorKind(
  error: unknown,
): 'notSignedIn' | 'consent' | 'limit' | 'tooBig' | 'failed' {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.includes('not_signed_in')) return 'notSignedIn';
  if (message.includes('consent_required')) return 'consent';
  if (message.includes('story_limit')) return 'limit';
  if (/maximum allowed size|payload too large|413/i.test(message)) return 'tooBig';
  return 'failed';
}

// create_story takes SQL null for the optional parts; the generated types
// list every argument as required, so null goes through this.
const sqlNull = <T>(value: T | null): T => value as T;

/** Uploads the photo or clip to your own folder, then posts it. */
export function usePostStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: StoryDraft): Promise<string> => {
      // Read at the moment of posting: it may follow a sign-in started by Share
      const { data: auth } = await supabase.auth.getSession();
      const me = auth.session?.user.id;
      if (!me) throw new Error('not_signed_in');
      const { mimeType, bytes } = draft.file;
      assertUploadFits('reels', bytes, mimeType);
      if (draft.kind === 'video' && !REEL_VIDEO_TYPES.some((type) => type === mimeType)) {
        throw new Error('Unsupported video content type');
      }
      if (draft.thumb) assertUploadFits('reels', draft.thumb, 'image/jpeg');
      const stem = `${me}/story-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const ext = draft.kind === 'photo' ? 'jpg' : mimeType.includes('quicktime') ? 'mov' : 'mp4';
      const mediaPath = `${stem}.${ext}`;
      const bucket = supabase.storage.from('reels');
      const upload = await bucket.upload(mediaPath, bytes, {
        contentType: mimeType,
        upsert: false,
      });
      if (upload.error) throw new Error(upload.error.message);
      let thumbPath: string | null = null;
      if (draft.thumb) {
        const thumb = await bucket.upload(`${stem}-still.jpg`, draft.thumb, {
          contentType: 'image/jpeg',
          upsert: false,
        });
        // A clip without a still shows its poster's ring plain
        if (!thumb.error) thumbPath = `${stem}-still.jpg`;
      }
      const { data, error } = await supabase.rpc('create_story', {
        p_kind: draft.kind,
        p_media_path: mediaPath,
        p_thumb_path: sqlNull(thumbPath),
        p_duration_s: sqlNull(
          draft.kind === 'video'
            ? Math.min(90, Math.max(0.1, Math.round((draft.durationS ?? 1) * 100) / 100))
            : null,
        ),
        p_width: sqlNull(draft.width),
        p_height: sqlNull(draft.height),
        p_caption: sqlNull(draft.caption.trim() || null),
        p_vendor_id: sqlNull(draft.asVendorId),
        p_consent: draft.consent,
      });
      if (error) {
        // Don't leave the files behind when the post itself is refused
        await bucket.remove([mediaPath, ...(thumbPath ? [thumbPath] : [])]);
        throw new Error(error.message);
      }
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: storyKeys.all }),
  });
}
