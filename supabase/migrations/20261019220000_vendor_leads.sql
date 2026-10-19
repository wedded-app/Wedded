-- Vendor leads, to the database design (vendor_leads): sign-ups and claims
-- take the design's kinds and names, a lead remembers who sent it (when they
-- were signed in) and the listing it is for or became, the founders get the
-- design's stages and a follow-up date, and the language is gone (English
-- only).
--
-- Kept from today though the design leaves them out: the contact's name, and
-- the business's type and town in their own words (the form takes free text;
-- the founders match them to a vendor type and a city when they list them).

alter table public.vendor_leads
  drop constraint vendor_leads_claim_has_vendor,
  drop constraint vendor_leads_kind_check,
  drop constraint vendor_leads_status_check;
update public.vendor_leads set kind = 'signup' where kind = 'new_listing';

alter table public.vendor_leads rename column claimed_vendor_id to vendor_id;
alter table public.vendor_leads rename constraint vendor_leads_claimed_vendor_id_fkey to vendor_leads_vendor_id_fkey;
alter index public.vendor_leads_claimed_vendor_id_idx rename to vendor_leads_vendor_id_idx;
alter table public.vendor_leads rename column instagram_handle to instagram;
alter table public.vendor_leads rename constraint vendor_leads_instagram_handle_check to vendor_leads_instagram_check;
alter table public.vendor_leads rename column status to stage;

alter table public.vendor_leads
  alter column kind set default 'signup',
  add constraint vendor_leads_kind_check check (kind in ('signup', 'claim')),
  add constraint vendor_leads_claim_has_vendor check (kind <> 'claim' or vendor_id is not null),
  add constraint vendor_leads_stage_check
    check (stage in ('new', 'contacted', 'call_booked', 'signed', 'declined', 'listed')),
  add column submitted_by uuid default auth.uid() references auth.users (id) on delete set null,
  add column next_follow_up_on date,
  drop column language;

create index vendor_leads_submitted_by_idx on public.vendor_leads (submitted_by) where submitted_by is not null;

comment on column public.vendor_leads.vendor_id is
  'The listing a claim is for; for a sign-up, the listing it became.';
comment on column public.vendor_leads.stage is
  'Where the founders are with it: new, contacted, call_booked, signed, declined or listed. Only the founders change it.';
comment on column public.vendor_leads.submitted_by is
  'Who sent it, when they were signed in (the form also works logged out).';
comment on column public.vendor_leads.next_follow_up_on is 'When the founders call back.';
