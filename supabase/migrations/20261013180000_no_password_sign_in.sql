-- No password sign-ins. The app signs people in only with a code sent to
-- their phone or email, or with Apple. Supabase's sign-up endpoint still takes
-- a password from anyone who calls it directly, and with email confirmation
-- off it hands back a signed-in account for any address, unverified. Someone
-- could claim a family's email that way, wait for them to sign in with a code,
-- and keep a back door into their plan and chats with the password.
--
-- refuse_password_sign_in()  Custom Access Token hook: refuses to issue a
--                            token for a password sign-in (or sign-up) and
--                            passes every other kind through unchanged.
--                            Turned on in config.toml locally and under
--                            Authentication → Hooks on the hosted project.

create function public.refuse_password_sign_in(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if event->>'authentication_method' = 'password' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Sign in with a code sent to your phone or email.'
      )
    );
  end if;
  return jsonb_build_object('claims', event->'claims');
end;
$$;

comment on function public.refuse_password_sign_in(jsonb) is
  'Custom Access Token hook: no tokens for password sign-ins; the app uses codes and Apple only.';

revoke execute on function public.refuse_password_sign_in(jsonb) from public, anon, authenticated;
grant execute on function public.refuse_password_sign_in(jsonb) to supabase_auth_admin;
