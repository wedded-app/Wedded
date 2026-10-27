-- Storage deletes a file with DELETE ... RETURNING, which also needs the row to
-- pass a SELECT policy. The website, vendor photo and reel buckets had upload
-- and delete policies but none for select, so removing a cover photo or a
-- vendor's photo, or deleting your own reel or story, deleted nothing and left
-- the files at their public URLs. The people who may delete a file can now see
-- it too; the buckets stay public for viewing, as before.

create policy "Owners and editors see their wedding site's photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'site-media' and private.can_write_site_file(name, false));

create policy "A vendor's people see its photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'vendor-media' and private.can_write_vendor_photo(name));

create policy "People see their own reel files" on storage.objects
  for select to authenticated
  using (bucket_id = 'reels' and split_part(name, '/', 1) = (select auth.uid())::text);
