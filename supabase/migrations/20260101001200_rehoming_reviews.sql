create type public.rehoming_admin_status as enum ('pending', 'approved', 'rejected');

create table public.rehoming_reviews (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals (id) on delete cascade,
  owner_profile_id uuid not null references public.profiles (id) on delete cascade,
  reason_for_rehoming text not null,
  ownership_declaration boolean not null default false,
  admin_status public.rehoming_admin_status not null default 'pending',
  admin_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.rehoming_reviews enable row level security;

create policy "owners view their own rehoming review"
  on public.rehoming_reviews for select
  to authenticated
  using (owner_profile_id = (select auth.uid()));

create policy "owners create their own rehoming review"
  on public.rehoming_reviews for insert
  to authenticated
  with check (
    owner_profile_id = (select auth.uid())
    and exists (
      select 1 from public.animals a
      where a.id = animal_id and a.owner_profile_id = (select auth.uid())
    )
  );

create policy "admins manage all rehoming reviews"
  on public.rehoming_reviews for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Now that rehoming_reviews exists: a private-rehoming animal is only publicly visible once an
-- admin has approved the corresponding review. This does not replace the owner/admin policies
-- already on `animals` (added in the animals migration) — it only adds the public-read case.
create policy "public reads approved private rehoming listings"
  on public.animals for select
  to anon, authenticated
  using (
    is_published
    and listing_category = 'private_rehoming'
    and exists (
      select 1 from public.rehoming_reviews rr
      where rr.animal_id = animals.id and rr.admin_status = 'approved'
    )
  );
