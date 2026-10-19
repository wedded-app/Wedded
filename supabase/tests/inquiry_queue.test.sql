-- The daily email cap and the nightly job that sends queued inquiries.

begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

select results_eq(
  $$ select schedule, active from cron.job where jobname = 'send-queued-inquiries' $$,
  $$ values ('5 8 * * *'::text, true) $$,
  'The nightly job sends queued inquiries just after midnight in California'
);

select ok(
  (select command like '%/functions/v1/send-queued-inquiries%'
     and command like '%vault.decrypted_secrets%'
   from cron.job where jobname = 'send-queued-inquiries'),
  'The job calls send-queued-inquiries with its URL and key from Vault (no key in the migration)'
);

insert into auth.users (id, instance_id, aud, role, email) values
  ('e0000000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cap@example.com');
insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('70000000-0000-4000-8000-000000000001', 'cap-vendor', 'published', 'Cap Vendor', 'yuba-city', 'SRID=4326;POINT(-121.6 39.1)');

update public.app_config set value = '10' where key = 'inquiry_daily_cap';
-- Nothing else sent today in this test database
delete from public.inquiries;

insert into public.inquiries (user_id, vendor_id, guest_band, venue_text, message, preferred_contact,
  sender_name, sender_phone, channel, status, created_at, sent_at) values
  -- queued yesterday, sent today: counts against today
  ('e0000000-0000-4000-8000-00000000000e', '70000000-0000-4000-8000-000000000001', 'not_sure', 'x', 'x', 'call',
    'Cap', '+15305550100', 'email', 'sent', now() - interval '1 day', now()),
  ('e0000000-0000-4000-8000-00000000000e', '70000000-0000-4000-8000-000000000001', 'not_sure', 'x', 'x', 'call',
    'Cap', '+15305550100', 'email', 'sending', now(), null),
  -- failed and queued ones don't use the cap
  ('e0000000-0000-4000-8000-00000000000e', '70000000-0000-4000-8000-000000000001', 'not_sure', 'x', 'x', 'call',
    'Cap', '+15305550100', 'email', 'failed', now(), null),
  ('e0000000-0000-4000-8000-00000000000e', '70000000-0000-4000-8000-000000000001', 'not_sure', 'x', 'x', 'call',
    'Cap', '+15305550100', 'email', 'queued', now(), null);

set local role service_role;
select is(public.inquiry_emails_left_today(), 8,
  'Emails left today counts what was sent today, including yesterday''s queue, and not failures or the queue');
reset role;

set local role anon;
select throws_ok($$ select public.inquiry_emails_left_today() $$, '42501', null,
  'Logged-out users cannot read the email count');
reset role;
set local role authenticated;
select throws_ok($$ select public.inquiry_emails_left_today() $$, '42501', null,
  'Signed-in users cannot read the email count');
reset role;

select * from finish();
rollback;
