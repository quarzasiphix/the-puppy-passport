-- Breeder-claimed titles/results for a specific parent dog, kept private until an admin verifies
-- the evidence — "AI/self-reported claims are never final without human review" applies here the
-- same way it does to compliance_review_result and every other verification-style table.
create type public.achievement_verification_status as enum ('pending', 'approved', 'rejected');

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  parent_dog_id uuid not null references public.parent_dogs (id) on delete cascade,
  kennel_id uuid not null references public.organisations (id) on delete cascade,
  title text not null,
  issuing_body text,
  achieved_on date,
  evidence_url text,
  verification_status public.achievement_verification_status not null default 'pending',
  admin_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_achievements_updated_at
  before update on public.achievements
  for each row execute function public.set_updated_at();

alter table public.achievements enable row level security;

-- Public sees only verified achievements, and only for dogs at an approved+public kennel — same
-- publication-category gate as every other public marketplace read.
create policy "public reads verified achievements of public approved kennels"
  on public.achievements for select
  to anon, authenticated
  using (
    verification_status = 'approved'
    and exists (
      select 1 from public.organisations o
      where o.id = kennel_id and o.verification_status = 'approved' and o.is_public
    )
  );

create policy "owners manage their kennel's achievements"
  on public.achievements for all
  to authenticated
  using (public.owns_org(kennel_id))
  with check (public.owns_org(kennel_id));

create policy "admins manage all achievements"
  on public.achievements for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.achievements to anon;
grant select, insert, update, delete on public.achievements to authenticated;
