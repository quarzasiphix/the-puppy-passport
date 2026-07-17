-- Bug found while testing the private rehoming submission flow: inserting into rehoming_reviews
-- fails with "infinite recursion detected in policy for relation rehoming_reviews" (42P17).
--
-- The cycle: rehoming_reviews' insert policy subqueries animals directly; animals' "public reads
-- approved private rehoming listings" policy subqueries rehoming_reviews directly. Postgres's RLS
-- planner won't evaluate a policy graph that loops back to its own starting table, no matter how
-- many hops. Same reasoning as owns_org()/is_org_member() in 20260101000400_role_helpers.sql:
-- route the cross-table check through a SECURITY DEFINER function so the subquery isn't inlined
-- into the same policy-expansion graph.
create or replace function public.owns_animal(p_animal_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return exists (
    select 1 from public.animals
    where id = p_animal_id and owner_profile_id = auth.uid()
  );
end;
$$;

create or replace function public.animal_has_approved_rehoming(p_animal_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.rehoming_reviews
    where animal_id = p_animal_id and admin_status = 'approved'
  );
$$;

drop policy "owners create their own rehoming review" on public.rehoming_reviews;
create policy "owners create their own rehoming review"
  on public.rehoming_reviews for insert
  to authenticated
  with check (
    owner_profile_id = (select auth.uid())
    and public.owns_animal(animal_id)
  );

drop policy "public reads approved private rehoming listings" on public.animals;
create policy "public reads approved private rehoming listings"
  on public.animals for select
  to anon, authenticated
  using (
    is_published
    and listing_category = 'private_rehoming'
    and public.animal_has_approved_rehoming(id)
  );
