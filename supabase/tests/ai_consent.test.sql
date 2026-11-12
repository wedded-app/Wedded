-- Permission to share with an AI service: off until they say yes, theirs to
-- take back, and asked again when what's shared changes.

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a6000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'consent-one@example.com'),
  ('a6000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'consent-two@example.com');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role anon;
select is(public.has_ai_consent(), false, 'Signed out, there is no yes');
reset role;

set local role authenticated;
select pg_temp.as_user('a6000000-0000-4000-8000-000000000001');
select is(public.has_ai_consent(), false, 'Nobody has said yes until they do');
select lives_ok($$ select public.set_ai_consent(true) $$, 'They say yes');
select lives_ok($$ select public.set_ai_consent(true) $$, 'Saying yes twice is fine');
select is(public.has_ai_consent(), true, 'Now they have');

select pg_temp.as_user('a6000000-0000-4000-8000-000000000002');
select is(
  public.has_ai_consent() or exists (select 1 from public.consents),
  false,
  'One person''s yes isn''t another''s, and they can''t see it'
);

select pg_temp.as_user('a6000000-0000-4000-8000-000000000001');
select public.set_ai_consent(false);
select is(public.has_ai_consent(), false, 'They take it back');
select public.set_ai_consent(true);
reset role;

insert into public.legal_documents (kind, version, published_at)
values ('ai_sharing', '2', now() + interval '1 minute');
set local role authenticated;
select pg_temp.as_user('a6000000-0000-4000-8000-000000000001');
select is(public.has_ai_consent(), false, 'A new version of what''s shared asks again');
reset role;

select * from finish();
rollback;
