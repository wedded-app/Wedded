-- Clearing stories (Kirat, 2026-10-16): a story leaves the feeds after 24
-- hours, and this makes it go for good, with its photo or clip, so nothing a
-- person shared for a day stays in storage. Every hour, when there's
-- something to clear, pg_cron calls the clear-stories function, which removes
-- the files and then the rows. A story with an open report stays until the
-- founders have looked at it. This replaces the app deleting its own poster's
-- expired stories, which missed anyone who never opened the app again.

-- Stories over a day old with no open report, oldest first (service role only)
create function public.expired_stories(p_limit integer default 500)
returns table (id uuid, media_path text, thumb_path text)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, s.media_path, s.thumb_path
  from public.stories s
  where s.created_at < now() - interval '1 day'
    and not exists (
      select 1 from public.reel_reports r where r.story_id = s.id and r.status = 'open'
    )
  order by s.created_at
  limit least(greatest(coalesce(p_limit, 500), 1), 1000);
$$;

comment on function public.expired_stories is
  'Service role only (clear-stories): stories over 24 hours old with no open report, and their files, oldest first.';

revoke all on function public.expired_stories from public, anon, authenticated;
grant execute on function public.expired_stories to service_role;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'clear-stories',
  '17 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/clear-stories',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  where exists (select 1 from public.expired_stories(1));
  $job$
);
