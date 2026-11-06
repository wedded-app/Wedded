-- Sign-up asks only the name (Fezy, 2026-11-05; DECISIONS.md): the city and
-- phone are asked the first time a family messages a vendor, since that's when
-- a vendor needs them. Both keep their checks when they're given. 18+ is
-- still stamped by the database when the profile is made; in place of the
-- box, the line under Create account and Sign in says that continuing
-- confirms it.

alter table public.profiles
  alter column city drop not null,
  alter column phone drop not null;

comment on column public.profiles.city is
  'Their town, asked the first time they message a vendor; null until then.';
comment on column public.profiles.phone is
  'E.164, e.g. +15305550101, asked the first time they message a vendor; null until then. Numbers from India, Canada or the UK are allowed.';
comment on column public.profiles.adult_confirmed_at is
  'When they confirmed they are 18 or older, by continuing past the line that says so. Set by the database; the app cannot write it.';
