-- Requests: family permissions, Pro privacy, proposal limits and acceptance.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users (id, instance_id, aud, role, email)
select ('a2180000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r1-' || n || '@example.com'
from generate_series(1,4) n;
insert into public.profiles (id, full_name, city, phone) values
 ('a2180000-0000-4000-8000-000000000001','Harjit Kaur','Yuba City','+15305550218');
insert into public.vendors (id,slug,status,name,base_city_slug,location)
select ('b2180000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 'r1-vendor-' || n, 'published', 'R1 Vendor ' || n, 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)'
from generate_series(1,12) n;
insert into public.vendor_categories (vendor_id,category_slug,position)
select id, case when slug='r1-vendor-12' then 'dj' else 'dhol' end, 1
from public.vendors where slug like 'r1-vendor-%';
insert into public.vendor_members (vendor_id,user_id)
select id,'a2180000-0000-4000-8000-000000000003' from public.vendors where slug like 'r1-vendor-%';
create function pg_temp.as_user(n integer) returns void language sql as $$
 select set_config('request.jwt.claims', json_build_object('sub','a2180000-0000-4000-8000-' || lpad(n::text,12,'0'),'role','authenticated')::text,true);
$$;
create function pg_temp.today() returns date language sql as $$
 select (now() at time zone 'America/Los_Angeles')::date;
$$;
create temp table ids (name text primary key,id uuid);
grant all on ids to authenticated;
set local role authenticated;
select pg_temp.as_user(1);
insert into ids select 'wedding', public.create_wedding('R1 wedding');
reset role;
insert into public.wedding_members(wedding_id,user_id,role)
select id,'a2180000-0000-4000-8000-000000000002','suggester' from ids where name='wedding';
set local role authenticated;
select pg_temp.as_user(2);
select throws_ok($$select public.post_request((select id from ids where name='wedding'),'dhol','Hello','yuba-city')$$,'42501','not_allowed','Suggesters cannot post');
select pg_temp.as_user(4);
select throws_ok($$select public.post_request((select id from ids where name='wedding'),'dhol','Hello','yuba-city')$$,'42501','not_allowed','Strangers cannot post');
select pg_temp.as_user(1);
select throws_ok($$select public.post_request((select id from ids where name='wedding'),'bad','Hi','yuba-city')$$,'22023','invalid_category','invalid_category');
select throws_ok($$select public.post_request((select id from ids where name='wedding'),'dhol','Hi','bad')$$,'22023','invalid_city','invalid_city');
select throws_ok($$select public.post_request((select id from ids where name='wedding'),'dhol','Hi','yuba-city','bad')$$,'22023','invalid_event','invalid_event');
select throws_ok($$select public.post_request((select id from ids where name='wedding'),'dhol',' ','yuba-city')$$,'22023','invalid_note','invalid_note');
select throws_ok($$select public.post_request((select id from ids where name='wedding'),'dhol','Hi','yuba-city',null,pg_temp.today()-1)$$,'22023','date_passed','date_passed');
select throws_ok($$select public.post_request((select id from ids where name='wedding'),'dhol','Hi','yuba-city',null,null,null,200,100)$$,'22023','invalid_budget','invalid_budget');

insert into ids select 'request', public.post_request((select id from ids where name='wedding'),'dhol','  Our Jaago  ','yuba-city','jaago',pg_temp.today()+30,'100_250',50000,100000);
select results_eq($$select note,event_date,expires_at from public.wedding_requests where id=(select id from ids where name='request')$$,
 $$select 'Our Jaago'::text,pg_temp.today()+30,(pg_temp.today()+31)::timestamp at time zone 'America/Los_Angeles'$$,'Post trims note and expires on the California day');
select throws_ok($$select public.post_request((select id from ids where name='wedding'),'dhol','Hi','yuba-city','jaago')$$,'23505','already_open','Only one open request per category and event');
select pg_temp.as_user(3);
select throws_ok($$select * from public.families_looking('b2180000-0000-4000-8000-000000000001')$$,'42501','pro_only','Free vendors cannot read requests');
select is((select sum(open_requests)::int from public.families_looking_summary('b2180000-0000-4000-8000-000000000001')),1,'Free vendors get counts');
select is((select count(*)::int from public.wedding_requests),0,'Vendors cannot read the underlying requests');
select throws_ok($$select public.send_proposal((select id from ids where name='request'),'b2180000-0000-4000-8000-000000000001','Hi')$$,'42501','pro_only','Free vendors cannot propose');
reset role;
insert into public.vendor_subscriptions(vendor_id,status)
select id,'active' from public.vendors where slug like 'r1-vendor-%';
set local role authenticated;
select pg_temp.as_user(3);
select results_eq($$select family_name,city from public.families_looking('b2180000-0000-4000-8000-000000000001')$$,$$values('Harjit K.','Yuba City')$$,'Pro sees only short family name and town');
select throws_ok($$select public.send_proposal((select id from ids where name='request'),'b2180000-0000-4000-8000-000000000012','Hi')$$,'P0001','not_open','Category must fit');
select throws_ok($$select public.send_proposal((select id from ids where name='request'),'b2180000-0000-4000-8000-000000000001',' ')$$,'22023','invalid_note','Proposal needs a note');
insert into ids select 'proposal', public.send_proposal((select id from ids where name='request'),'b2180000-0000-4000-8000-000000000001','Available',75000,'event');
select throws_ok($$select public.send_proposal((select id from ids where name='request'),'b2180000-0000-4000-8000-000000000001','Again')$$,'23505','already_sent','One proposal per vendor');
select public.send_proposal((select id from ids where name='request'),('b2180000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'Available') from generate_series(2,10)n;
select throws_ok($$select public.send_proposal((select id from ids where name='request'),'b2180000-0000-4000-8000-000000000011','Hi')$$,'P0001','proposals_full','Ten proposals maximum');
select pg_temp.as_user(4);
select is((select count(*)::int from public.request_proposals),0,'Strangers see no proposals');
select is((select count(*)::int from public.vendor_subscriptions where vendor_id::text like 'b218%'),0,'Strangers see no subscriptions');
select throws_ok($$select * from public.request_proposals_for((select id from ids where name='request'))$$,'42501','not_allowed','Strangers cannot fetch proposals');
select throws_ok($$select * from public.families_looking_summary('b2180000-0000-4000-8000-000000000001')$$,'42501','not_allowed','Strangers cannot get the teaser');
select throws_ok($$select public.answer_proposal((select id from ids where name='proposal'),true)$$,'42501','not_allowed','Strangers cannot answer');
select throws_ok($$select public.withdraw_proposal((select id from ids where name='proposal'))$$,'42501','not_allowed','Strangers cannot withdraw');
select throws_ok($$select public.close_request((select id from ids where name='request'))$$,'42501','not_allowed','Strangers cannot close');
select pg_temp.as_user(2);
select throws_ok($$select public.answer_proposal((select id from ids where name='proposal'),true)$$,'42501','not_allowed','Suggesters cannot answer');
reset role;
update public.wedding_members set role='editor' where user_id='a2180000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.as_user(2);
insert into ids select 'conversation',public.answer_proposal((select id from ids where name='proposal'),true);
select is((select count(*)::int from public.messages where conversation_id=(select id from ids where name='conversation') and kind='proposal'),2,'Acceptance creates both proposal messages');
select is((select data->>'update' from public.messages where conversation_id=(select id from ids where name='conversation') and sender_role='family'),'accepted','Family acceptance is recorded');
select throws_ok($$select public.answer_proposal((select id from ids where name='proposal'),true)$$,'P0001','already_answered','Accept only once');
select lives_ok($$select public.answer_proposal((select id from public.request_proposals where vendor_id='b2180000-0000-4000-8000-000000000002'),false)$$,'Editor can decline');
select pg_temp.as_user(3);
select lives_ok($$select public.send_message((select id from ids where name='conversation'),'text','Thank you')$$,'Vendor can write after acceptance');
select lives_ok($$select public.withdraw_proposal((select id from public.request_proposals where vendor_id='b2180000-0000-4000-8000-000000000003'))$$,'Vendor can withdraw');
select throws_ok($$select public.withdraw_proposal((select id from public.request_proposals where vendor_id='b2180000-0000-4000-8000-000000000003'))$$,'P0001','already_answered','Withdraw once');
reset role;
update public.vendors set is_sample=true where id='b2180000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.as_user(1);
select is((select count(*)::int from public.request_proposals_for((select id from ids where name='request'))),9,'Withdrawn proposals disappear from family comparison');
select is((select array_agg(vendor_id) from public.request_proposals_for((select id from ids where name='request')) where vendor_is_sample),array['b2180000-0000-4000-8000-000000000002'::uuid],'Proposals say which vendors are samples');
select lives_ok($$select public.close_request((select id from ids where name='request'),true)$$,'Owner can close as booked');
select is((select status from public.wedding_requests where id=(select id from ids where name='request')),'booked','Request is booked');
select pg_temp.as_user(3);
select is((select count(*)::int from public.families_looking('b2180000-0000-4000-8000-000000000001')),0,'Closed requests disappear');
select throws_ok($$select public.send_proposal((select id from ids where name='request'),'b2180000-0000-4000-8000-000000000011','Hi')$$,'P0001','not_open','No proposals on closed requests');
reset role;
-- Seed existing requests to exercise caps independently of the daily limit.
insert into public.wedding_requests(wedding_id,created_by,category_slug,event_slug,note,city_slug,expires_at,created_at)
select (select id from ids where name='wedding'),'a2180000-0000-4000-8000-000000000001','dhol',slug,'Limit test','yuba-city',now()+interval '90 days',now()-interval '2 days'
from public.events limit 10;
set local role authenticated;
select pg_temp.as_user(1);
select throws_ok($$select public.post_request((select id from ids where name='wedding'),'dj','Hi','yuba-city')$$,'P0001','too_many_open','Ten open requests maximum');
reset role;
update public.wedding_requests set status='closed',created_at=now() where wedding_id=(select id from ids where name='wedding');
set local role authenticated;
select pg_temp.as_user(1);
select throws_ok($$select public.post_request((select id from ids where name='wedding'),'dj','Hi','yuba-city')$$,'P0001','request_rate','Five posts per day maximum');
reset role;
select * from finish();
rollback;
