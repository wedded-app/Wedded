-- No password sign-ins: the access token hook refuses password sign-ins and
-- leaves codes, Apple and token refreshes alone. Nobody in the app can call it.

begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

select is(
  public.refuse_password_sign_in(
    '{"user_id": "a1200000-0000-4000-8000-000000000001", "authentication_method": "password", "claims": {"sub": "a1200000-0000-4000-8000-000000000001"}}'
  )->'error'->>'http_code',
  '403',
  'a password sign-in gets no token'
);

select is(
  public.refuse_password_sign_in(
    '{"user_id": "a1200000-0000-4000-8000-000000000001", "authentication_method": "password", "claims": {"sub": "a1200000-0000-4000-8000-000000000001"}}'
  )->'claims',
  null,
  'and no claims come back with the refusal'
);

select is(
  public.refuse_password_sign_in(
    '{"user_id": "a1200000-0000-4000-8000-000000000001", "authentication_method": "otp", "claims": {"sub": "a1200000-0000-4000-8000-000000000001", "role": "authenticated"}}'
  ),
  '{"claims": {"sub": "a1200000-0000-4000-8000-000000000001", "role": "authenticated"}}'::jsonb,
  'a code sign-in keeps its claims unchanged'
);

select is(
  public.refuse_password_sign_in(
    '{"user_id": "a1200000-0000-4000-8000-000000000001", "authentication_method": "oauth", "claims": {"sub": "a1200000-0000-4000-8000-000000000001"}}'
  )->'claims'->>'sub',
  'a1200000-0000-4000-8000-000000000001',
  'Apple sign-in goes through'
);

select is(
  public.refuse_password_sign_in(
    '{"user_id": "a1200000-0000-4000-8000-000000000001", "authentication_method": "token_refresh", "claims": {"sub": "a1200000-0000-4000-8000-000000000001"}}'
  )->'error',
  null,
  'staying signed in goes through'
);

set local role authenticated;
select throws_ok(
  $$ select public.refuse_password_sign_in('{}') $$,
  '42501',
  null,
  'signed-in people cannot call the hook'
);
reset role;

select * from finish();
rollback;
