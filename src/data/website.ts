/**
 * Wedding websites: one page a family shares at /w/{slug} (see the
 * wedding_sites migration). It fills itself from the plan, so a new site
 * already shows the couple and their events; the family picks a design and a
 * cover photo, writes the parts they want and publishes it. Guests read it
 * logged out with site_page(); a guest's own RSVP token shows only their
 * events and skips the password. The wedding's own people see drafts, every
 * event and an `editor` part the builder uses.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

import { shareLink } from '@/constants/links';
import { asLocalizedText, localized } from '@/i18n/localized';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';

import type { Rsvp } from './guests';
import { assertUploadFits } from './upload-limits';
import { photoFiles, photoSizes, type PickedPhoto } from './photo-sizes';

/** The parts of a site under its cover. A new site has all of them, in this order. */
export const SITE_SECTIONS = [
  'family',
  'story',
  'events',
  'rsvp',
  'guide',
  'travel',
  'livestream',
  'faq',
] as const;
export type SiteSection = (typeof SITE_SECTIONS)[number];

/** How many of each list a site can have; the database says the same. */
export const SITE_LIST_LIMITS = { tip: 12, hotel: 6, faq: 20 } as const;
export type SiteListKind = keyof typeof SITE_LIST_LIMITS;

export type SiteItem = { title: string; body: string | null; link: string | null };

export type SiteEvent = {
  slug: string;
  date: string | null;
  /** Local times, "18:00:00". */
  startsAt: string | null;
  endsAt: string | null;
  /** The listed hall or gurdwara's name, or what the family typed. */
  place: string | null;
  city: string | null;
  dressCode: string | null;
  /** Up to three #RRGGBB swatches. */
  dressColors: string[];
  note: string | null;
  /** False: only guests invited to it see it, on their own link. */
  shownPublicly: boolean;
  /** The reader's answer, on a guest's own link; null otherwise. */
  rsvp: Rsvp | null;
  coming: number | null;
};

export type SiteEditor = {
  weddingId: string;
  role: 'owner' | 'editor' | 'suggester';
  canEdit: boolean;
  hasPassword: boolean;
};

export type SitePage = {
  slug: string;
  /** The couple, e.g. "Jaspreet & Amrit" (the wedding's title). */
  title: string;
  weddingDate: string | null;
  design: string;
  palette: string | null;
  /** The cover photo's folder in site-media; see coverUrl(). */
  coverPath: string | null;
  welcome: string | null;
  story: string | null;
  familyTitle: string | null;
  familyLines: string[];
  guideTitle: string | null;
  livestreamUrl: string | null;
  livestreamNote: string | null;
  rsvpBy: string | null;
  sections: SiteSection[];
  searchable: boolean;
  publishedAt: string | null;
  /** The wedding's shared RSVP link token, for Find your invitation; null while it's off. */
  rsvpLink: string | null;
  /** The reader, when they came with their own RSVP link. */
  guest: { name: string; partySize: number; token: string } | null;
  events: SiteEvent[];
  tips: SiteItem[];
  hotels: SiteItem[];
  faq: SiteItem[];
  /** Only for the wedding's own people. */
  editor: SiteEditor | null;
};

export type SiteLock = {
  locked: 'password_required' | 'wrong_password';
  title: string;
  design: string;
  palette: string | null;
};

export type SiteResult = { kind: 'page'; page: SitePage } | { kind: 'locked'; lock: SiteLock };

type Obj = Record<string, unknown>;

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function items(value: unknown): SiteItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    const o = (v ?? {}) as Obj;
    const title = str(o.title);
    return title ? [{ title, body: str(o.body), link: str(o.link) }] : [];
  });
}

function toRsvpAnswer(value: unknown): Rsvp | null {
  return value === 'yes' || value === 'no' || value === 'pending' ? value : null;
}

function toEvent(value: unknown): SiteEvent | null {
  const o = (value ?? {}) as Obj;
  const slug = str(o.slug);
  if (!slug) return null;
  return {
    slug,
    date: str(o.date),
    startsAt: str(o.starts_at),
    endsAt: str(o.ends_at),
    place: str(o.place),
    city: str(o.city),
    dressCode: str(o.dress_code),
    dressColors: strings(o.dress_colors),
    note: str(o.note),
    shownPublicly: o.shown_publicly !== false,
    rsvp: toRsvpAnswer(o.rsvp),
    coming: typeof o.coming === 'number' ? o.coming : null,
  };
}

function isSection(value: string): value is SiteSection {
  return (SITE_SECTIONS as readonly string[]).includes(value);
}

/** site_page()'s JSON as a page or a password box. */
export function toSiteResult(json: Json | null): SiteResult | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const o = json as Obj;
  if (o.locked === 'password_required' || o.locked === 'wrong_password') {
    return {
      kind: 'locked',
      lock: {
        locked: o.locked,
        title: str(o.title) ?? '',
        design: str(o.design) ?? 'classic',
        palette: str(o.palette),
      },
    };
  }
  const slug = str(o.slug);
  if (!slug) return null;
  const guest = (o.guest ?? null) as Obj | null;
  const editor = (o.editor ?? null) as Obj | null;
  return {
    kind: 'page',
    page: {
      slug,
      title: str(o.title) ?? '',
      weddingDate: str(o.wedding_date),
      design: str(o.design) ?? 'classic',
      palette: str(o.palette),
      coverPath: str(o.cover_path),
      welcome: str(o.welcome),
      story: str(o.story),
      familyTitle: str(o.family_title),
      familyLines: strings(o.family_lines),
      guideTitle: str(o.guide_title),
      livestreamUrl: str(o.livestream_url),
      livestreamNote: str(o.livestream_note),
      rsvpBy: str(o.rsvp_by),
      sections: strings(o.sections).filter(isSection),
      searchable: o.searchable === true,
      publishedAt: str(o.published_at),
      rsvpLink: str(o.rsvp_link),
      guest:
        guest && str(guest.token)
          ? {
              name: str(guest.name) ?? '',
              partySize: typeof guest.party_size === 'number' ? guest.party_size : 1,
              token: str(guest.token) ?? '',
            }
          : null,
      events: Array.isArray(o.events)
        ? o.events.map(toEvent).filter((e): e is SiteEvent => e !== null)
        : [],
      tips: items(o.tips),
      hotels: items(o.hotels),
      faq: items(o.faq),
      editor:
        editor && str(editor.wedding_id)
          ? {
              weddingId: str(editor.wedding_id) ?? '',
              role: editor.role === 'owner' || editor.role === 'editor' ? editor.role : 'suggester',
              canEdit: editor.can_edit === true,
              hasPassword: editor.has_password === true,
            }
          : null,
    },
  };
}

/** The changes update_site() takes; only the keys given change, null clears. */
export type SiteChanges = Partial<{
  design: string;
  palette: string | null;
  welcome: string | null;
  story: string | null;
  family_title: string | null;
  family_lines: string[];
  guide_title: string | null;
  livestream_url: string | null;
  livestream_note: string | null;
  rsvp_by: string | null;
  sections: SiteSection[];
  searchable: boolean;
}>;

function trimmed(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

/** The page as it will be once the changes save, for the screen to show at once. */
export function applySiteChanges(page: SitePage, changes: SiteChanges): SitePage {
  const next = { ...page };
  if ('design' in changes) next.design = trimmed(changes.design) ?? 'classic';
  if ('palette' in changes) next.palette = trimmed(changes.palette);
  if ('welcome' in changes) next.welcome = trimmed(changes.welcome);
  if ('story' in changes) next.story = trimmed(changes.story);
  if ('family_title' in changes) next.familyTitle = trimmed(changes.family_title);
  if ('family_lines' in changes) {
    next.familyLines = (changes.family_lines ?? []).map((l) => l.trim()).filter(Boolean);
  }
  if ('guide_title' in changes) next.guideTitle = trimmed(changes.guide_title);
  if ('livestream_url' in changes) next.livestreamUrl = trimmed(changes.livestream_url);
  if ('livestream_note' in changes) next.livestreamNote = trimmed(changes.livestream_note);
  if ('rsvp_by' in changes) next.rsvpBy = trimmed(changes.rsvp_by);
  if ('sections' in changes) next.sections = changes.sections ?? [];
  if ('searchable' in changes) next.searchable = changes.searchable === true;
  return next;
}

export type EventSiteDetails = Partial<{
  dress_code: string | null;
  dress_colors: string[];
  guest_note: string | null;
  shown_publicly: boolean;
}>;

/** The event as it will be once its details save. */
export function applyEventDetails(event: SiteEvent, details: EventSiteDetails): SiteEvent {
  const next = { ...event };
  if ('dress_code' in details) next.dressCode = trimmed(details.dress_code);
  if ('dress_colors' in details) {
    next.dressColors = (details.dress_colors ?? []).map((c) => c.toUpperCase());
  }
  if ('guest_note' in details) next.note = trimmed(details.guest_note);
  if ('shown_publicly' in details) next.shownPublicly = details.shown_publicly !== false;
  return next;
}

/** A link with https:// in front when someone typed "marriott.com/…". */
export function httpsLink(value: string): string | null {
  const t = value.trim();
  if (!t) return null;
  if (/^https:\/\//i.test(t)) return t;
  if (/^http:\/\//i.test(t)) return `https://${t.slice(7)}`;
  return `https://${t}`;
}

/** A refused change, in terms a screen can word. */
export type SiteProblem =
  | 'notFound'
  | 'notAllowed'
  | 'slugTaken'
  | 'invalidSlug'
  | 'invalidPassword'
  | 'passwordLimit'
  | 'tooMany'
  | 'invalid'
  | 'offline'
  | 'failed';

export function siteProblem(error: unknown): SiteProblem {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.includes('site_not_found')) return 'notFound';
  if (message.includes('not_allowed') || /row-level security|403/i.test(message)) {
    return 'notAllowed';
  }
  if (message.includes('slug_taken')) return 'slugTaken';
  if (message.includes('invalid_slug')) return 'invalidSlug';
  if (message.includes('invalid_password')) return 'invalidPassword';
  if (message.includes('password_limit')) return 'passwordLimit';
  if (message.includes('too_many_items')) return 'tooMany';
  if (/check constraint|violates|invalid_/i.test(message)) return 'invalid';
  if (/network request failed|failed to fetch/i.test(message)) return 'offline';
  return 'failed';
}

/** The link guests open; with a guest's own token it shows only their events. */
export function websiteLink(slug: string, guestToken?: string | null): string {
  return shareLink(`/w/${slug}`, guestToken ? { g: guestToken } : undefined);
}

const COVER_WIDTHS = { small: 400, medium: 1080, large: 1600 } as const;

/** Public URL of one size of the cover photo. */
export function coverUrl(path: string, size: keyof typeof COVER_WIDTHS): string {
  return supabase.storage.from('site-media').getPublicUrl(`${path}/${COVER_WIDTHS[size]}.webp`).data
    .publicUrl;
}

export const siteKeys = {
  all: ['site'] as const,
  page: (slug: string, password: string, guestToken: string) =>
    ['site', 'page', slug, password, guestToken] as const,
  mine: (weddingId: string) => ['site', 'mine', weddingId] as const,
  tips: (eventSlugs: string[]) => ['site', 'tips', ...eventSlugs] as const,
};

/**
 * A wedding website as the reader may see it. Works logged out. A password
 * box comes back as `{kind: 'locked'}`; an unknown or unpublished link is an
 * error with site_not_found.
 */
export function useSitePage(slug: string, options?: { password?: string; guestToken?: string }) {
  const password = options?.password ?? '';
  const guestToken = options?.guestToken ?? '';
  return useQuery({
    queryKey: siteKeys.page(slug, password, guestToken),
    queryFn: async (): Promise<SiteResult | null> => {
      const { data, error } = await supabase.rpc('site_page', {
        p_slug: slug,
        p_password: password || undefined,
        p_guest_token: guestToken || undefined,
      });
      if (error) throw new Error(error.message);
      return toSiteResult(data);
    },
    enabled: slug.length > 0,
    retry: (count, error) => siteProblem(error) === 'failed' && count < 2,
  });
}

/** The slug of the wedding's site; null while it has none. Members only. */
export function useMySiteSlug(weddingId: string | null) {
  return useQuery({
    queryKey: siteKeys.mine(weddingId ?? ''),
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('wedding_sites')
        .select('slug')
        .eq('wedding_id', weddingId ?? '')
        .maybeSingle();
      if (error) throw error;
      return data?.slug ?? null;
    },
    enabled: !!weddingId,
  });
}

/**
 * Make the wedding's site (a draft only the family sees), named from the
 * couple; the first time an owner or editor opens Website. Returns its slug.
 */
export function useCreateSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (weddingId: string) => {
      const { data, error } = await supabase.rpc('create_site', { p_wedding_id: weddingId });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (slug, weddingId) => queryClient.setQueryData(siteKeys.mine(weddingId), slug),
  });
}

/** The editor's copy of the page (the member view, no password or guest). */
function editorPageKey(slug: string) {
  return siteKeys.page(slug, '', '');
}

function patchEditorPage(
  queryClient: ReturnType<typeof useQueryClient>,
  slug: string,
  patch: (page: SitePage) => SitePage,
): SiteResult | undefined {
  const key = editorPageKey(slug);
  const before = queryClient.getQueryData<SiteResult | null>(key) ?? undefined;
  if (before?.kind === 'page') {
    const next: SiteResult = { kind: 'page', page: patch(before.page) };
    queryClient.setQueryData(key, next);
  }
  return before;
}

/** Change the site's design, words or parts. Shows the change at once and saves it. */
export function useUpdateSite(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ weddingId, changes }: { weddingId: string; changes: SiteChanges }) => {
      const { error } = await supabase.rpc('update_site', {
        p_wedding_id: weddingId,
        p_changes: changes as Json,
      });
      if (error) throw new Error(error.message);
    },
    onMutate: async ({ changes }) => {
      await queryClient.cancelQueries({ queryKey: editorPageKey(slug) });
      return { before: patchEditorPage(queryClient, slug, (p) => applySiteChanges(p, changes)) };
    },
    onError: (_e, _v, context) => {
      if (context?.before) queryClient.setQueryData(editorPageKey(slug), context.before);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['site', 'page', slug] }),
  });
}

/** One event's details for guests: what to wear, colours, a note, and who sees it. */
export function useSetEventSiteDetails(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      weddingId,
      eventSlug,
      details,
    }: {
      weddingId: string;
      eventSlug: string;
      details: EventSiteDetails;
    }) => {
      const { error } = await supabase.rpc('set_event_site_details', {
        p_wedding_id: weddingId,
        p_event_slug: eventSlug,
        p_details: details as Json,
      });
      if (error) throw new Error(error.message);
    },
    onMutate: async ({ eventSlug, details }) => {
      await queryClient.cancelQueries({ queryKey: editorPageKey(slug) });
      return {
        before: patchEditorPage(queryClient, slug, (p) => ({
          ...p,
          events: p.events.map((e) => (e.slug === eventSlug ? applyEventDetails(e, details) : e)),
        })),
      };
    },
    onError: (_e, _v, context) => {
      if (context?.before) queryClient.setQueryData(editorPageKey(slug), context.before);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['site', 'page', slug] }),
  });
}

const LIST_FIELD = { tip: 'tips', hotel: 'hotels', faq: 'faq' } as const;

/** Replace the guide's tips, the hotels or the questions. */
export function useSetSiteItems(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      weddingId,
      kind,
      list,
    }: {
      weddingId: string;
      kind: SiteListKind;
      list: SiteItem[];
    }) => {
      const { data, error } = await supabase.rpc('set_site_items', {
        p_wedding_id: weddingId,
        p_kind: kind,
        p_items: list as unknown as Json,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onMutate: async ({ kind, list }) => {
      await queryClient.cancelQueries({ queryKey: editorPageKey(slug) });
      const kept = list
        .map((i) => ({ title: i.title.trim(), body: trimmed(i.body), link: trimmed(i.link) }))
        .filter((i) => i.title.length > 0);
      return {
        before: patchEditorPage(queryClient, slug, (p) => ({ ...p, [LIST_FIELD[kind]]: kept })),
      };
    },
    onError: (_e, _v, context) => {
      if (context?.before) queryClient.setQueryData(editorPageKey(slug), context.before);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['site', 'page', slug] }),
  });
}

/** Publish the site, or take it back to a draft. */
export function usePublishSite(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ weddingId, publish }: { weddingId: string; publish: boolean }) => {
      const { data, error } = await supabase.rpc('publish_site', {
        p_wedding_id: weddingId,
        p_publish: publish,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (publishedAt) => {
      patchEditorPage(queryClient, slug, (p) => ({ ...p, publishedAt }));
      void queryClient.invalidateQueries({ queryKey: ['site', 'page', slug] });
    },
  });
}

/** Change the site's link. Returns the new slug. */
export function useSetSiteSlug() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ weddingId, slug }: { weddingId: string; slug: string }) => {
      const { data, error } = await supabase.rpc('set_site_slug', {
        p_wedding_id: weddingId,
        p_slug: slug,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (newSlug, { weddingId }) => {
      queryClient.setQueryData(siteKeys.mine(weddingId), newSlug);
      void queryClient.invalidateQueries({ queryKey: siteKeys.all });
    },
  });
}

/** Set the site's password, or clear it with an empty one. */
export function useSetSitePassword(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ weddingId, password }: { weddingId: string; password: string }) => {
      const { data, error } = await supabase.rpc('set_site_password', {
        p_wedding_id: weddingId,
        p_password: password,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (hasPassword) => {
      patchEditorPage(queryClient, slug, (p) =>
        p.editor ? { ...p, editor: { ...p.editor, hasPassword } } : p,
      );
    },
  });
}

async function readBytes(uri: string): Promise<ArrayBuffer> {
  // Browsers hand back a blob: link, which File can't open
  return Platform.OS === 'web' ? (await fetch(uri)).arrayBuffer() : new File(uri).arrayBuffer();
}

/**
 * Make the three sizes of a picked photo, upload them to
 * site-media/<wedding>/<photo>/ and make it the cover. The old cover's files
 * are deleted after; the new ones if saving fails.
 */
export async function uploadSiteCover(weddingId: string, photo: PickedPhoto): Promise<string> {
  const folder = `${weddingId}/${Crypto.randomUUID()}`;
  const uploaded: string[] = [];
  try {
    for (const size of photoSizes(photo.width)) {
      const rendered = await ImageManipulator.manipulate(photo.uri)
        .resize({ width: size.width })
        .renderAsync();
      const saved = await rendered.saveAsync({ format: SaveFormat.WEBP, compress: 0.82 });
      const path = `${folder}/${size.name}.webp`;
      const bytes = await readBytes(saved.uri);
      assertUploadFits('site-media', bytes, 'image/webp');
      const { error } = await supabase.storage
        .from('site-media')
        .upload(path, bytes, { contentType: 'image/webp', upsert: false });
      if (error) throw new Error(error.message);
      uploaded.push(path);
    }
    const { data: oldFolder, error } = await supabase.rpc('set_site_cover', {
      p_wedding_id: weddingId,
      p_photo_id: folder.split('/')[1],
    });
    if (error) throw new Error(error.message);
    if (oldFolder) {
      await supabase.storage
        .from('site-media')
        .remove(photoFiles(oldFolder))
        .catch(() => undefined);
    }
    return folder;
  } catch (e) {
    if (uploaded.length > 0) {
      await supabase.storage
        .from('site-media')
        .remove(uploaded)
        .catch(() => undefined);
    }
    throw e;
  }
}

/** Upload a new cover photo, or remove it with null. */
export function useSetSiteCover(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ weddingId, photo }: { weddingId: string; photo: PickedPhoto | null }) => {
      if (photo) return uploadSiteCover(weddingId, photo);
      const { data: oldFolder, error } = await supabase.rpc('set_site_cover', {
        p_wedding_id: weddingId,
        // null removes the cover; the generated types don't allow it for a uuid
        p_photo_id: null as unknown as string,
      });
      if (error) throw new Error(error.message);
      if (oldFolder) {
        await supabase.storage
          .from('site-media')
          .remove(photoFiles(oldFolder))
          .catch(() => undefined);
      }
      return null;
    },
    onSuccess: (coverPath) => {
      patchEditorPage(queryClient, slug, (p) => ({ ...p, coverPath }));
      void queryClient.invalidateQueries({ queryKey: ['site', 'page', slug] });
    },
  });
}

export type GuestTip = { eventSlug: string; tip: string };

/** Suggested tips for guests at these events (cover your head, shoes off...). */
export function useGuestTipSuggestions(eventSlugs: string[]) {
  const sorted = [...eventSlugs].sort();
  return useQuery({
    queryKey: siteKeys.tips(sorted),
    queryFn: async (): Promise<GuestTip[]> => {
      const { data, error } = await supabase
        .from('event_guest_tips')
        .select('event_slug, sort_order, tip')
        .in('event_slug', sorted)
        .order('event_slug')
        .order('sort_order');
      if (error) throw error;
      return (data ?? []).flatMap((row) => {
        const text = asLocalizedText(row.tip);
        return text ? [{ eventSlug: row.event_slug, tip: localized(text) }] : [];
      });
    },
    enabled: sorted.length > 0,
    staleTime: Infinity,
  });
}
