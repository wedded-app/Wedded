-- Stop emails (#228, legal checklist): every email Wedded sends has a signed
-- "Stop these emails" link (the email-unsubscribe function). An address here
-- gets no chat alerts and no copies of its own inquiries; a vendor's address
-- here has its inquiries relayed through the founders instead, so families
-- still reach them. Only the Edge Functions (service role) read or write it.

create table public.email_opt_outs (
  email text primary key check (email = lower(btrim(email)) and email like '%@%'),
  created_at timestamptz not null default now()
);

comment on table public.email_opt_outs is
  'Addresses that asked for no more email from Wedded. Written by the email-unsubscribe function; read by the email senders.';

alter table public.email_opt_outs enable row level security;

revoke all on public.email_opt_outs from anon, authenticated;
grant select, insert, delete on public.email_opt_outs to service_role;
