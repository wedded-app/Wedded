-- Every table says what it holds (docs/DATABASE.md is built from these); four were missing theirs.

comment on table public.guest_list_members is 'Which guests are on a list.';
comment on table public.reel_likes is 'One like per person per reel.';
comment on table public.reel_comments is 'Comments on a reel; the founders hide reported ones (hidden_at, hidden_by).';
comment on table public.user_blocks is 'People someone blocked: neither sees the other''s reels, comments or stories.';
