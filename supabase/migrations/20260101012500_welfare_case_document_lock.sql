-- Stage IR-11 (integration-readiness queue): Storage and signed URL security. Auditing every
-- private bucket for the "org can tamper with evidence after ops already acted on it" bug class
-- (the same shape Stage AP closed for transport_documents) found welfare_case_documents was never
-- covered: welfare_cases itself already locks organisation-side edits to a fixed editable window
-- ("org members edit their own org's case before ops decision" -- only draft/submitted/
-- information_required), but both welfare_case_documents (the metadata table) and the
-- welfare-case-documents Storage bucket used a single unrestricted `for all` policy with no such
-- window -- an org member could insert, overwrite, or delete supporting evidence at any time,
-- including after ops accepted or declined the case based on that exact evidence. Not reachable
-- through the real UI today (uploadWelfareCaseDocument() only ever inserts a new row/object, no
-- update/delete action exists in src/), but real via a raw API/Storage call, the same "no UI path
-- today, but RLS is the actual boundary" severity tier as every other self-approval-class fix this
-- session has made.
--
-- Split each `for all` into SELECT (always allowed -- an org should always be able to see its own
-- submitted evidence, viewing was never the risk) and INSERT/UPDATE/DELETE (restricted to the same
-- editable window welfare_cases' own update policy already uses). New documents can still be added
-- while the case is still theirs to edit; once ops has moved it past that point, every existing
-- document is frozen from the organisation's side. Ops keeps its separate, unrestricted `for all`
-- policy on both the table and the bucket, unchanged.
drop policy "org members manage documents on their own org's welfare case" on public.welfare_case_documents;

create policy "org members view their own org's welfare case documents"
  on public.welfare_case_documents for select
  to authenticated
  using (
    exists (
      select 1 from public.welfare_cases wc
      where wc.id = welfare_case_id and public.is_org_member(wc.organisation_id)
    )
  );

create policy "org members add documents while their case is still editable"
  on public.welfare_case_documents for insert
  to authenticated
  with check (
    exists (
      select 1 from public.welfare_cases wc
      where wc.id = welfare_case_id
        and public.is_org_member(wc.organisation_id)
        and wc.status in ('draft', 'submitted', 'information_required')
    )
  );

create policy "org members change documents while their case is editable"
  on public.welfare_case_documents for update
  to authenticated
  using (
    exists (
      select 1 from public.welfare_cases wc
      where wc.id = welfare_case_id
        and public.is_org_member(wc.organisation_id)
        and wc.status in ('draft', 'submitted', 'information_required')
    )
  )
  with check (
    exists (
      select 1 from public.welfare_cases wc
      where wc.id = welfare_case_id
        and public.is_org_member(wc.organisation_id)
        and wc.status in ('draft', 'submitted', 'information_required')
    )
  );

create policy "org members remove documents while their case is editable"
  on public.welfare_case_documents for delete
  to authenticated
  using (
    exists (
      select 1 from public.welfare_cases wc
      where wc.id = welfare_case_id
        and public.is_org_member(wc.organisation_id)
        and wc.status in ('draft', 'submitted', 'information_required')
    )
  );

-- Same split for the underlying Storage objects, so the lock can't be bypassed by editing the
-- file in place at the same path while leaving the welfare_case_documents row untouched.
drop policy "org members access their welfare case documents in storage" on storage.objects;

create policy "org members view their welfare case documents in storage"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'welfare-case-documents'
    and exists (
      select 1 from public.welfare_cases wc
      where wc.id = (storage.foldername(name))[1]::uuid and public.is_org_member(wc.organisation_id)
    )
  );

create policy "org members upload welfare case documents while still editable"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'welfare-case-documents'
    and exists (
      select 1 from public.welfare_cases wc
      where wc.id = (storage.foldername(name))[1]::uuid
        and public.is_org_member(wc.organisation_id)
        and wc.status in ('draft', 'submitted', 'information_required')
    )
  );

create policy "org members change welfare case documents while still editable"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'welfare-case-documents'
    and exists (
      select 1 from public.welfare_cases wc
      where wc.id = (storage.foldername(name))[1]::uuid
        and public.is_org_member(wc.organisation_id)
        and wc.status in ('draft', 'submitted', 'information_required')
    )
  )
  with check (
    bucket_id = 'welfare-case-documents'
    and exists (
      select 1 from public.welfare_cases wc
      where wc.id = (storage.foldername(name))[1]::uuid
        and public.is_org_member(wc.organisation_id)
        and wc.status in ('draft', 'submitted', 'information_required')
    )
  );

create policy "org members remove welfare case documents while still editable"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'welfare-case-documents'
    and exists (
      select 1 from public.welfare_cases wc
      where wc.id = (storage.foldername(name))[1]::uuid
        and public.is_org_member(wc.organisation_id)
        and wc.status in ('draft', 'submitted', 'information_required')
    )
  );
