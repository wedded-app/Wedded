begin;
create extension if not exists pgtap with schema extensions;
select plan(7);
select is_empty($$ select n.nspname || '.' || c.relname from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public', 'private') and c.relkind in ('r','p')
  and not c.relrowsecurity $$, 'All application tables have RLS');
select is_empty($$ select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('claim_chat_notifications','claim_push_messages',
  'deposit_for_payment','attach_payment_intent','record_deposit_payment','save_payment_account',
  'update_payment_account','create_inquiry','inquiry_emails_left_today','claim_wed_asks','post_wed_reply','claim_group_push','claim_group_notifications')
  and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute')) $$,
  'Privileged mail, push, payment and Wed RPCs stay service-only');
select is_empty($$ select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  join pg_class c on c.reltype=p.prorettype and c.relnamespace=n.oid
  where n.nspname='public' and c.relkind in ('r','p') $$,
  'Public RPCs do not expose whole table row types that silently grow');
select results_eq($$ select id, file_size_limit from storage.buckets order by id $$,
 $$ values ('chat-media'::text, 5242880::bigint), ('reels', 52428800::bigint), ('vendor-media', 5242880::bigint) $$,
 'Storage bucket byte limits match the client upload guards');
select is((select allowed_mime_types from storage.buckets where id='vendor-media'),
 array['image/webp','image/jpeg']::text[], 'Vendor media MIME types match client guards');
select is((select allowed_mime_types from storage.buckets where id='reels'),
 array['video/mp4','video/quicktime','image/jpeg','image/webp','image/png']::text[],
 'Reel MIME types match client guards');
select is((select allowed_mime_types from storage.buckets where id='chat-media'),
 array['image/jpeg','image/png','image/webp','image/heic','audio/mp4','audio/m4a',
 'audio/x-m4a','audio/aac','audio/mpeg','audio/webm']::text[], 'Chat MIME types match client guards');
select * from finish();
rollback;
