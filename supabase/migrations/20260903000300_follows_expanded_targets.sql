-- Breeder social layer, stage 3: widen public.follows to the full target vocabulary the product
-- needs (user, kennel/organisation, dog, litter, breed, community) — extending the existing
-- table's own safe pattern (nullable target columns + a CHECK that exactly one is set + a partial
-- unique index per target) rather than a second, parallel follow table or loose polymorphism that
-- would prevent real foreign keys and simple RLS. "breeder"/"kennel" both already map onto
-- followed_organization_id (there is one organisations row per kennel in this schema — see
-- docs/SOCIAL_DOMAIN.md); "community" maps onto the existing groups table.

alter table public.follows
  add column followed_animal_id uuid references public.animals (id) on delete cascade,
  add column followed_litter_id uuid references public.litters (id) on delete cascade,
  add column followed_breed_id uuid references public.breeds (id) on delete cascade,
  add column followed_group_id uuid references public.groups (id) on delete cascade;

alter table public.follows drop constraint follows_target;
alter table public.follows add constraint follows_target check (
  num_nonnulls(
    followed_profile_id, followed_organization_id,
    followed_animal_id, followed_litter_id, followed_breed_id, followed_group_id
  ) = 1
);

create unique index follows_unique_animal on public.follows (follower_profile_id, followed_animal_id) where followed_animal_id is not null;
create unique index follows_unique_litter on public.follows (follower_profile_id, followed_litter_id) where followed_litter_id is not null;
create unique index follows_unique_breed on public.follows (follower_profile_id, followed_breed_id) where followed_breed_id is not null;
create unique index follows_unique_group on public.follows (follower_profile_id, followed_group_id) where followed_group_id is not null;

-- Integrity a plain CHECK can't express: a self-follow is meaningless, and following a kennel that
-- isn't public yet would leak its existence to the follower's own follow list before the kennel
-- has chosen to be public. Neither was previously enforced at all — "users manage their own
-- follows" only ever checked follower_profile_id, not the target's own validity.
create or replace function public.prevent_invalid_follow_targets()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.followed_profile_id is not null and new.followed_profile_id = new.follower_profile_id then
    raise exception 'Cannot follow yourself.' using errcode = 'P0001';
  end if;

  if new.followed_organization_id is not null and not exists (
    select 1 from public.organisations
    where id = new.followed_organization_id and is_public = true
  ) then
    raise exception 'Cannot follow an organisation that is not public.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger prevent_invalid_follow_targets
  before insert or update on public.follows
  for each row execute function public.prevent_invalid_follow_targets();

grant select, insert, update, delete on public.follows to authenticated;
