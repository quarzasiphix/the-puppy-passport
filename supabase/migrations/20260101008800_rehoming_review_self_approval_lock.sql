-- Stage T (supplemental queue): listing lifecycle. Found a real bypass of a fundamental product
-- rule (CLAUDE.md #5: "Private rehoming requires a separate moderated workflow"):
-- "owners create their own rehoming review" (20260101001200_rehoming_reviews.sql, re-created in
-- 20260101003800_fix_rehoming_rls_recursion.sql for an unrelated recursion fix) only ever checked
-- `owner_profile_id = auth.uid()` and `owns_animal(animal_id)` -- it never restricted
-- `admin_status`. `admin_status` defaults to 'pending', but a default only applies when the client
-- omits the column; nothing stopped an owner's INSERT from explicitly supplying
-- `admin_status: 'approved'`. Combined with the owner already being free to set
-- `animals.is_published = true` on their own row ("private owners manage their own animal
-- records" is a full FOR ALL policy), this is a real, reachable self-approval path: an owner could
-- submit an already-"admin approved" rehoming_reviews row and their listing would immediately
-- satisfy "public reads approved private rehoming listings" (`is_published` and
-- `animal_has_approved_rehoming(id)`), skipping the moderated review entirely. Not caught by
-- tests/db/workflows.test.ts's existing "private rehoming stays hidden until admin approval" test,
-- since that test only ever inserts with the default (omitted) admin_status -- it proved the
-- honest path works, not that the dishonest path is blocked.
drop policy "owners create their own rehoming review" on public.rehoming_reviews;

create policy "owners create their own rehoming review"
  on public.rehoming_reviews for insert
  to authenticated
  with check (
    owner_profile_id = (select auth.uid())
    and admin_status = 'pending'
    and public.owns_animal(animal_id)
  );
