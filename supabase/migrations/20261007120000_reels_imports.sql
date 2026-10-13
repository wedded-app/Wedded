-- Reels from Instagram and TikTok (B1, #134): the data the import and
-- paste-a-link features build on, so B2 (event filters) and B5 (paste a link)
-- need no database work of their own.
--
-- * linked_accounts: a person's (or a vendor's) linked TikTok or Instagram
--   account; its login tokens sit in linked_account_tokens, which the API
--   can't read (Edge Functions only, like vendor_private).
-- * reels gain where each clip came from: source (upload / import / link),
--   platform, the platform's post id, the post's address and who to credit.
--   A pasted link has no video file of ours, so video_path and duration_s
--   become optional for links only.
-- * The same Instagram or TikTok post can be added once, whoever adds it.
-- * create_linked_reel() adds a reel from a pasted post address, with the same
--   consent, tag and daily-limit rules as an upload.
-- * reels_feed() takes an event to filter by and returns where each reel came from.

-- Linked accounts ------------------------------------------------------------------------------------

create table public.linked_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Linked for a business (its members manage it), or null for a person's own account
  vendor_id uuid references public.vendors (id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok')),
  -- The platform's own id for the account; one Wedded App person per account
  external_id text not null check (length(external_id) between 1 and 100),
  handle text check (handle ~ '^[A-Za-z0-9._]{1,30}$'),
  status text not null default 'active' check (status in ('active', 'disconnected')),
  linked_at timestamptz not null default now(),
  last_synced_at timestamptz,
  constraint linked_accounts_one_owner unique (platform, external_id)
);

comment on table public.linked_accounts is
  'A TikTok or Instagram account someone linked to import their reels. Written by Edge Functions; the owner reads and removes it.';

create index linked_accounts_user_idx on public.linked_accounts (user_id);
create index linked_accounts_vendor_idx on public.linked_accounts (vendor_id);

-- The platform's login for an account. RLS on with no policies and no grants:
-- only Edge Functions (the service role) ever read or write it.
create table public.linked_account_tokens (
  account_id uuid primary key references public.linked_accounts (id) on delete cascade,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  updated_at timestamptz not null default now()
);

comment on table public.linked_account_tokens is
  'Login tokens for linked accounts. No API access: Edge Functions only.';

alter table public.linked_accounts enable row level security;
alter table public.linked_account_tokens enable row level security;

create policy "People see their own linked accounts" on public.linked_accounts
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (vendor_id is not null and private.is_vendor_member(vendor_id))
  );
create policy "People remove their own linked accounts" on public.linked_accounts
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.linked_accounts, public.linked_account_tokens from anon, authenticated;
grant select, delete on public.linked_accounts to authenticated;

-- Where a reel came from ------------------------------------------------------------------------------

alter table public.reels
  alter column video_path drop not null,
  alter column duration_s drop not null,
  add column source text not null default 'upload' check (source in ('upload', 'import', 'link')),
  add column platform text check (platform in ('instagram', 'tiktok')),
  -- The platform's id for the post (a TikTok video id, an Instagram shortcode)
  add column source_id text check (source_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  add column source_url text check (source_url ~ '^https://www\.(tiktok|instagram)\.com/'),
  -- Who made it, shown as "@gabrudholcrew on TikTok"
  add column credit_name text check (length(btrim(credit_name)) between 1 and 60),
  add column linked_account_id uuid references public.linked_accounts (id) on delete set null,
  -- Uploads are ours; imports and links point at the original post
  add constraint reels_source_fields check (
    (source = 'upload') = (platform is null)
    and (platform is null) = (source_id is null)
    and (platform is null) = (source_url is null)
  ),
  -- Uploads have a file; a pasted link never does; a file always has its length
  add constraint reels_source_file check (
    (source <> 'upload' or video_path is not null)
    and (source <> 'link' or video_path is null)
    and ((video_path is null) = (duration_s is null))
  );

-- The same post can be added once, however it arrives
create unique index reels_source_unique on public.reels (platform, source_id) where platform is not null;
create index reels_linked_account_idx on public.reels (linked_account_id);
create index reels_event_feed_idx on public.reels (event_slug, created_at desc) where status = 'live';

-- Writing -------------------------------------------------------------------------------------------

-- The checks every new reel goes through, uploaded or linked: signed in,
-- the consent tick, posting as a business only for its members, 15 a day,
-- and at most 10 tags of listed vendors. Returns the tags to add.
create function private.check_new_reel(p_vendor_ids uuid[], p_vendor_id uuid, p_consent boolean)
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  tags uuid[];
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_consent is not true then
    raise exception 'consent_required' using errcode = '22023';
  end if;
  if p_vendor_id is not null and not private.is_vendor_member(p_vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if (select count(*) from public.reels
      where author_id = caller and created_at > now() - interval '1 day') >= 15 then
    raise exception 'reel_limit' using errcode = 'P0001';
  end if;

  tags := array(select distinct unnest(coalesce(p_vendor_ids, '{}'::uuid[])));
  if p_vendor_id is not null then
    tags := array_remove(tags, p_vendor_id);
  end if;
  if cardinality(tags) > 10 then
    raise exception 'too_many_tags' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(tags) as t (id)
    where not exists (select 1 from public.vendors v where v.id = t.id and v.status = 'published')
  ) then
    raise exception 'vendor_not_found' using errcode = 'P0002';
  end if;
  return tags;
end;
$$;

-- Tags a new reel: the posting business (approved) and the vendors tagged (pending)
create function private.tag_new_reel(p_reel_id uuid, p_vendor_id uuid, p_tags uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.reel_vendor_tags (reel_id, vendor_id, status, decided_at)
  select p_reel_id, p_vendor_id, 'approved', now() where p_vendor_id is not null;
  insert into public.reel_vendor_tags (reel_id, vendor_id)
  select p_reel_id, t.id from unnest(p_tags) as t (id);
$$;

-- Posting an upload, now through the shared checks (same rules and errors as before)
create or replace function private.create_reel(
  p_video_path text, p_thumb_path text, p_duration_s numeric, p_width integer, p_height integer,
  p_caption text, p_event_slug text, p_vendor_ids uuid[], p_vendor_id uuid, p_consent boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  folder text := (select auth.uid())::text || '/';
  new_id uuid;
  tags uuid[];
begin
  -- Consent comes first, as before, so the order of errors doesn't change
  if (select auth.uid()) is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_consent is not true then
    raise exception 'consent_required' using errcode = '22023';
  end if;
  if left(p_video_path, length(folder)) <> folder
    or (p_thumb_path is not null and left(p_thumb_path, length(folder)) <> folder) then
    raise exception 'not_your_file' using errcode = '42501';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'reels' and name = p_video_path) then
    raise exception 'video_not_uploaded' using errcode = 'P0002';
  end if;
  tags := private.check_new_reel(p_vendor_ids, p_vendor_id, p_consent);

  insert into public.reels
    (author_id, vendor_id, video_path, thumb_path, duration_s, width, height, caption, event_slug)
  values
    ((select auth.uid()), p_vendor_id, p_video_path, p_thumb_path, p_duration_s, p_width, p_height,
     nullif(btrim(p_caption), ''), nullif(p_event_slug, ''))
  returning id into new_id;

  perform private.tag_new_reel(new_id, p_vendor_id, tags);
  return new_id;
end;
$$;

-- Add a reel from a TikTok or Instagram post's address (B5). Only the full
-- address of one post is accepted:
--   https://www.tiktok.com/@<handle>/video/<id>
--   https://www.instagram.com/reel/<code>/  (or /p/<code>/)
-- Short share links (vm.tiktok.com, instagram.com/share/...) must be opened
-- first; the app does that with the platforms' oEmbed. A post already on
-- Wedded App can't be added again (already_added). p_credit_name defaults to
-- the TikTok handle in the address; Instagram addresses don't carry one.
create function private.create_linked_reel(
  p_url text, p_caption text, p_event_slug text, p_vendor_ids uuid[], p_vendor_id uuid,
  p_consent boolean, p_credit_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  url text := btrim(coalesce(p_url, ''));
  parts text[];
  v_platform text;
  v_source_id text;
  v_url text;
  v_credit text;
  new_id uuid;
  tags uuid[];
begin
  parts := regexp_match(url, '^https://(?:www\.|m\.)?tiktok\.com/@([A-Za-z0-9._]{1,24})/video/([0-9]{5,25})/?(?:[?#].*)?$');
  if parts is not null then
    v_platform := 'tiktok';
    v_source_id := parts[2];
    v_url := 'https://www.tiktok.com/@' || parts[1] || '/video/' || parts[2];
    v_credit := '@' || parts[1];
  else
    parts := regexp_match(url, '^https://(?:www\.)?instagram\.com/(?:reels?|p)/([A-Za-z0-9_-]{5,40})/?(?:[?#].*)?$');
    if parts is null then
      raise exception 'unsupported_link' using errcode = '22023';
    end if;
    v_platform := 'instagram';
    v_source_id := parts[1];
    v_url := 'https://www.instagram.com/reel/' || parts[1] || '/';
  end if;

  tags := private.check_new_reel(p_vendor_ids, p_vendor_id, p_consent);
  if exists (select 1 from public.reels where platform = v_platform and source_id = v_source_id) then
    raise exception 'already_added' using errcode = '23505';
  end if;

  insert into public.reels
    (author_id, vendor_id, source, platform, source_id, source_url, credit_name, caption, event_slug)
  values
    ((select auth.uid()), p_vendor_id, 'link', v_platform, v_source_id, v_url,
     coalesce(nullif(btrim(p_credit_name), ''), v_credit),
     nullif(btrim(p_caption), ''), nullif(p_event_slug, ''))
  returning id into new_id;

  perform private.tag_new_reel(new_id, p_vendor_id, tags);
  return new_id;
end;
$$;

create function public.create_linked_reel(
  p_url text, p_caption text default null, p_event_slug text default null,
  p_vendor_ids uuid[] default '{}', p_vendor_id uuid default null,
  p_consent boolean default false, p_credit_name text default null)
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_linked_reel(p_url, p_caption, p_event_slug, p_vendor_ids, p_vendor_id,
    p_consent, p_credit_name);
$$;

comment on function public.create_linked_reel is
  'Add a reel from a TikTok (https://www.tiktok.com/@handle/video/id) or Instagram (https://www.instagram.com/reel/code/) post. Errors: not_signed_in, consent_required, unsupported_link, already_added, not_allowed, reel_limit, too_many_tags, vendor_not_found.';

-- Reading -------------------------------------------------------------------------------------------

-- The feed, now with an event to filter by (Jaago, Mehndi...) and where each
-- reel came from. The return type changes, so the functions are recreated.
drop function public.reels_feed(text, timestamptz, integer, uuid, uuid);
drop function private.reels_feed(text, timestamptz, integer, uuid, uuid);

create function private.reels_feed(
  p_mode text, p_before timestamptz, p_limit integer, p_user_id uuid, p_vendor_id uuid,
  p_event_slug text)
returns table (
  id uuid, video_path text, thumb_path text, duration_s numeric, width integer, height integer,
  caption text, event_slug text, created_at timestamptz,
  author_id uuid, author_name text, vendor_id uuid, vendor_slug text, vendor_name text,
  tags jsonb, like_count bigint, comment_count bigint, liked boolean, following boolean, is_mine boolean,
  source text, platform text, source_url text, credit_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id, r.video_path, r.thumb_path, r.duration_s, r.width, r.height, r.caption, r.event_slug,
    r.created_at, r.author_id,
    private.short_name(p.full_name),
    r.vendor_id, v.slug, v.name,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'vendor_id', tv.id, 'slug', tv.slug, 'name', tv.name, 'status', t.status)
        order by t.created_at)
      from public.reel_vendor_tags t
      join public.vendors tv on tv.id = t.vendor_id and tv.status = 'published'
      where t.reel_id = r.id and t.status <> 'declined'
        and t.vendor_id is distinct from r.vendor_id
    ), '[]'::jsonb),
    (select count(*) from public.reel_likes l where l.reel_id = r.id),
    (select count(*) from public.reel_comments c
     where c.reel_id = r.id and not c.hidden
       and not private.blocked_between((select auth.uid()), c.user_id)),
    exists (select 1 from public.reel_likes l where l.reel_id = r.id and l.user_id = (select auth.uid())),
    exists (
      select 1 from public.follows f
      where f.follower_id = (select auth.uid())
        and (case when r.vendor_id is not null then f.vendor_id = r.vendor_id else f.user_id = r.author_id end)
    ),
    r.author_id = (select auth.uid()),
    r.source, r.platform, r.source_url, r.credit_name
  from public.reels r
  left join public.profiles p on p.id = r.author_id
  left join public.vendors v on v.id = r.vendor_id
  where r.status = 'live'
    and r.created_at < coalesce(p_before, 'infinity'::timestamptz)
    and not private.blocked_between((select auth.uid()), r.author_id)
    and (r.vendor_id is null or v.status = 'published')
    and (nullif(p_event_slug, '') is null or r.event_slug = p_event_slug)
    and case p_mode
      when 'following' then exists (
        select 1 from public.follows f
        where f.follower_id = (select auth.uid())
          and (f.user_id = r.author_id or (r.vendor_id is not null and f.vendor_id = r.vendor_id)))
      when 'person' then r.author_id = p_user_id and r.vendor_id is null
      when 'vendor' then r.vendor_id = p_vendor_id or exists (
        select 1 from public.reel_vendor_tags t
        where t.reel_id = r.id and t.vendor_id = p_vendor_id and t.status = 'approved')
      else true
    end
  order by r.created_at desc
  limit least(greatest(coalesce(p_limit, 10), 1), 30);
$$;

create function public.reels_feed(
  p_mode text default 'for_you', p_before timestamptz default null, p_limit integer default 10,
  p_user_id uuid default null, p_vendor_id uuid default null, p_event_slug text default null)
returns table (
  id uuid, video_path text, thumb_path text, duration_s numeric, width integer, height integer,
  caption text, event_slug text, created_at timestamptz,
  author_id uuid, author_name text, vendor_id uuid, vendor_slug text, vendor_name text,
  tags jsonb, like_count bigint, comment_count bigint, liked boolean, following boolean, is_mine boolean,
  source text, platform text, source_url text, credit_name text)
language sql stable security invoker set search_path = '' as $$
  select * from private.reels_feed(p_mode, p_before, p_limit, p_user_id, p_vendor_id, p_event_slug);
$$;

comment on function public.reels_feed is
  'A page of reels: for_you, following, person (p_user_id) or vendor (p_vendor_id), newest first before p_before, optionally only one event (p_event_slug). source is upload, import or link; a link has source_url and no video_path.';

-- Access ---------------------------------------------------------------------------------------------

revoke all on function
  private.check_new_reel, private.tag_new_reel, private.create_linked_reel, private.reels_feed,
  public.create_linked_reel, public.reels_feed
  from public;
grant execute on function private.reels_feed, public.reels_feed to anon, authenticated;
-- check_new_reel and tag_new_reel only run inside the posting functions
grant execute on function private.create_linked_reel, public.create_linked_reel to authenticated;
