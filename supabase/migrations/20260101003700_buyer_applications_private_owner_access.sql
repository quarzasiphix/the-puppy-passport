-- buyer_applications already lets an organisation see applications for its own animals ("org
-- owners view/update applications for their animals"), but a private_rehoming animal has no
-- organisation — owner_profile_id on animals instead. Without this, someone expressing interest
-- in a privately-rehomed dog would be submitting into a void the owner can never see.
create policy "private animal owners view applications for their animals"
  on public.buyer_applications for select
  to authenticated
  using (
    exists (
      select 1 from public.animals a
      where a.id = animal_id and a.owner_profile_id = (select auth.uid())
    )
  );

create policy "private animal owners update applications for their animals"
  on public.buyer_applications for update
  to authenticated
  using (
    exists (
      select 1 from public.animals a
      where a.id = animal_id and a.owner_profile_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.animals a
      where a.id = animal_id and a.owner_profile_id = (select auth.uid())
    )
  );
