-- Two buckets: `kennel-media` is public (logos, covers, parent-dog and animal photos — the same
-- kind of content already seeded as static image URLs), `transport-documents` is private (passport
-- scans, health certificates, etc. — "do not expose uploaded documents publicly").

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('kennel-media', 'kennel-media', true, 20971520),
  ('transport-documents', 'transport-documents', false, 20971520)
on conflict (id) do nothing;

-- kennel-media: object path convention is `{org_id}/...`. Anyone can read (bucket is public);
-- only the org's owner can write into their own folder.
create policy "public reads kennel media"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'kennel-media');

create policy "org owners upload their own kennel media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'kennel-media'
    and public.owns_org((storage.foldername(name))[1]::uuid)
  );

create policy "org owners manage their own kennel media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'kennel-media' and public.owns_org((storage.foldername(name))[1]::uuid))
  with check (bucket_id = 'kennel-media' and public.owns_org((storage.foldername(name))[1]::uuid));

create policy "org owners delete their own kennel media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'kennel-media' and public.owns_org((storage.foldername(name))[1]::uuid));

-- transport-documents: object path convention is `{transport_request_id}/...`. Only the requester
-- and ops/admin can read or write.
create policy "requesters read their own transport documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'transport-documents'
    and exists (
      select 1 from public.transport_requests tr
      where tr.id = (storage.foldername(name))[1]::uuid and tr.requester_profile_id = (select auth.uid())
    )
  );

create policy "requesters upload their own transport documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'transport-documents'
    and exists (
      select 1 from public.transport_requests tr
      where tr.id = (storage.foldername(name))[1]::uuid and tr.requester_profile_id = (select auth.uid())
    )
  );

create policy "ops staff manage all transport documents in storage"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'transport-documents' and public.is_ops_staff())
  with check (bucket_id = 'transport-documents' and public.is_ops_staff());
