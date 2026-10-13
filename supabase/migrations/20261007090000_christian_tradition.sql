-- A Christian tradition (docs/DECISIONS.md, 2026-10-07).
--
-- The first questions now ask the faith first (Sikh, Hindu, Muslim,
-- Christian), and each faith card leads to the traditions of that faith. The
-- faiths table has listed Christian since 2026-09-30, but no tradition
-- belonged to it, so this adds a faith-wide one (no background, like the
-- Muslim one): the engagement, a church wedding and the reception, with a
-- mehndi under More events for the South Asian Christian families who have
-- one.
--
-- Churches and pastors aren't vendor types: families marry in their own
-- church, so the church wedding lists the vendors around the ceremony.
-- English only until the family reviews a translation.

insert into public.cultures (slug, name, script, shows_auspicious_dates, is_default, sort_order, background_slug, faith_slug) values
  ('christian', '{"en": "Christian"}', 'latin', false, false, 6, null, 'christian');

insert into public.events (slug, name, aliases, host_side, timing, typical_guests_min, typical_guests_max) values
  ('church-wedding',
    '{"en": "Church wedding"}',
    array['church', 'church wedding', 'church ceremony', 'holy matrimony', 'wedding mass', 'nuptial mass', 'christian wedding'],
    'joint', '{"en": "The wedding day, usually the morning or early afternoon"}', 80, 400);

insert into public.culture_events (culture_slug, event_slug, phase, sort_order, is_core, local_name) values
  ('christian', 'chunni-kurmai', 'before', 1, true, '{"en": "Engagement"}'),
  ('christian', 'mehndi', 'before', 2, false, null),
  ('christian', 'church-wedding', 'wedding_day', 3, true, null),
  ('christian', 'reception', 'wedding_day', 4, true, null),
  ('christian', 'whole-wedding', 'whole_wedding', 5, true, null);

insert into public.event_categories (event_slug, category_slug, importance, sort_order)
select 'church-wedding', e.category_slug, 'essential', e.position::smallint
from unnest(array['photographer', 'videographer', 'florist', 'makeup', 'bridal-boutique'])
  with ordinality as e (category_slug, position)
union all
select 'church-wedding', n.category_slug, 'nice_to_have', (5 + n.position)::smallint
from unnest(array['live-singer', 'decorator', 'groom-wear', 'jewelry', 'cars-limos', 'live-streaming'])
  with ordinality as n (category_slug, position);
