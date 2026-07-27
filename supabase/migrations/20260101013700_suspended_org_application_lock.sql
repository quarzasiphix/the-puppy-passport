-- Stage YR-8 (organisation trust-state consistency). Every public-facing table already correctly
-- requires organisations.verification_status = 'approved' before showing anything (animals,
-- litters, parent_dogs, welfare_cases, fundraising, achievements -- confirmed by grep, no gaps
-- there), so a suspended organisation's listings correctly vanish from every public/browse view
-- immediately. But buyer_applications' own INSERT policy ("buyers manage their own applications",
-- `for all`, with check only `buyer_id = auth.uid()`) never checked the target animal's
-- organisation at all -- a buyer who already knows an animal's id (a bookmark/saved_animals
-- entry made *before* the organisation was suspended, or any other stale reference) could still
-- submit a brand-new application against it via a direct insert, completely bypassing the
-- suspension. Suspension is meant to stop an organisation operating -- receiving new applications
-- is exactly the kind of privileged workflow that should stop too.
--
-- Split the previous single `for all` policy so only INSERT gets the new check -- an existing
-- application a buyer already has (made before suspension) must remain fully visible and
-- withdrawable; only *creating a new one* against a currently-suspended/pending/rejected org is
-- blocked. Private-rehoming/direct-owner applications (organization_id is null, gated by their own
-- separate rehoming_reviews workflow, not org verification) are correctly unaffected.
drop policy "buyers manage their own applications" on public.buyer_applications;

create policy "buyers view their own applications"
  on public.buyer_applications for select
  to authenticated
  using (buyer_id = (select auth.uid()));

create policy "buyers update their own applications"
  on public.buyer_applications for update
  to authenticated
  using (buyer_id = (select auth.uid()))
  with check (buyer_id = (select auth.uid()));

create policy "buyers delete their own applications"
  on public.buyer_applications for delete
  to authenticated
  using (buyer_id = (select auth.uid()));

create policy "buyers create applications only for currently-approved orgs"
  on public.buyer_applications for insert
  to authenticated
  with check (
    buyer_id = (select auth.uid())
    and (
      organization_id is null
      or exists (
        select 1 from public.organisations o
        where o.id = organization_id and o.verification_status = 'approved'
      )
    )
  );
