-- Permission before Wed shares personal data with an AI service (App Store
-- rule 5.1.2(i)). Wed is scripted today and shares nothing; this is the stored
-- answer its gate reads once it does. The tables are the database design's
-- legal_documents and consents, with only the columns this needs: the e-sign
-- columns come with vendor consent, and a document has no url until there's
-- a website. Two departures: the kind ai_sharing, and withdrawn_at, because
-- this permission can be taken back.

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'terms', 'privacy', 'refund', 'vendor_consent', 'ordering_policy', 'community_rules', 'ai_sharing'
  )),
  version text not null check (length(btrim(version)) between 1 and 40),
  url text,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint legal_documents_kind_version_key unique (kind, version)
);

comment on table public.legal_documents is
  'Every version of what people agree to (terms, privacy, sharing with an AI service...). Everyone can read them; migrations write them.';

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null references public.legal_documents (id) on delete restrict,
  accepted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.consents is
  'Who accepted which document version, and when they took it back. Each person reads their own; written only by set_ai_consent().';

-- One live yes per person and document
create unique index consents_live_key on public.consents (user_id, document_id)
  where withdrawn_at is null;
create index consents_document_idx on public.consents (document_id);

alter table public.legal_documents enable row level security;
alter table public.consents enable row level security;

create policy "Everyone reads the documents" on public.legal_documents
  for select to anon, authenticated
  using (true);
create policy "People read their own consents" on public.consents
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.legal_documents, public.consents from anon, authenticated;
grant select on public.legal_documents to anon, authenticated;
grant select on public.consents to authenticated;

-- Version 1 is what the app's consent page says today. A change to what Wed
-- shares, or with whom, is a new version here, and everyone is asked again.
insert into public.legal_documents (kind, version) values ('ai_sharing', '1');

-- The newest ai_sharing document: the one a yes has to be for
create function private.ai_sharing_document()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.legal_documents
  where kind = 'ai_sharing'
  order by published_at desc, version desc
  limit 1;
$$;

create function private.has_ai_consent()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.consents c
    where c.user_id = (select auth.uid())
      and c.document_id = private.ai_sharing_document()
      and c.withdrawn_at is null
  );
$$;

create function public.has_ai_consent()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.has_ai_consent();
$$;

comment on function public.has_ai_consent is
  'Whether the caller has said yes to the newest version of sharing with an AI service, and not taken it back. False when signed out.';

create function private.set_ai_consent(p_allowed boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_allowed then
    insert into public.consents (user_id, document_id)
    values (caller, private.ai_sharing_document())
    on conflict (user_id, document_id) where withdrawn_at is null do nothing;
  else
    -- Every version they said yes to, so an old yes can't come back
    update public.consents c
    set withdrawn_at = now()
    from public.legal_documents d
    where d.id = c.document_id and d.kind = 'ai_sharing'
      and c.user_id = caller and c.withdrawn_at is null;
  end if;
end;
$$;

create function public.set_ai_consent(p_allowed boolean)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_ai_consent(p_allowed);
$$;

comment on function public.set_ai_consent is
  'Say yes (true) to sharing with an AI service as the newest version describes it, or take it back (false). Errors: not_signed_in.';

revoke all on function
  private.ai_sharing_document, private.has_ai_consent, private.set_ai_consent
  from public;
grant execute on function private.has_ai_consent to anon, authenticated;
grant execute on function private.set_ai_consent to authenticated;
revoke all on function public.has_ai_consent, public.set_ai_consent from public;
grant execute on function public.has_ai_consent to anon, authenticated;
grant execute on function public.set_ai_consent to authenticated;
