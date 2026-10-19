-- Vendor types say which questions their inquiry asks, to the database design
-- (categories.inquiry_schema): the app picked the hall and caterer questions
-- from lists of type slugs written into its code. Now each type names its
-- question set, so a new type gets the right questions without a code change.
--
-- The questions themselves stay in the app (they have their own pickers:
-- catering, alcohol, live stations, tour times), so the column names a set
-- rather than holding the questions as data.

alter table public.categories
  add column inquiry_questions text check (inquiry_questions in ('venue', 'caterer'));

comment on column public.categories.inquiry_questions is
  'Which of the inquiry form''s question sets this type asks: venue (catering, alcohol, ghori and dhol, same day, tour times) or caterer (food, live stations, hall, tasting); null for none.';

update public.categories set inquiry_questions = 'venue'
where slug in ('banquet-hall', 'hotel-ballroom', 'restaurant-room', 'community-center', 'outdoor-venue');
update public.categories set inquiry_questions = 'caterer'
where slug in ('caterer', 'halwai');
