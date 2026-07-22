-- Community groups (docs/PRODUCT_VISION.md hierarchy pillar 3, docs/IMPLEMENTATION_PLAN.md
-- phase 12). `groups`/`group_members` already existed with join/leave working (`group_members`'s
-- "users manage their own group membership" policy is already FOR ALL on profile_id = auth.uid()),
-- but posts.visibility = 'group' had NO select policy anywhere — "public posts are readable by
-- anyone" only covers visibility = 'public', so a group member other than the post's own author
-- could never actually read a fellow member's group post. Same gap in comments (comments follow
-- their post's visibility, which only checked visibility = 'public'). Fixing both before building
-- any group-posting UI on top of them.

create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and profile_id = (select auth.uid())
  );
$$;

create policy "group members read group-scoped posts"
  on public.posts for select
  to authenticated
  using (visibility = 'group' and group_id is not null and public.is_group_member(group_id));

create policy "group members read comments on group-scoped posts"
  on public.comments for select
  to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and p.visibility = 'group'
        and p.group_id is not null
        and public.is_group_member(p.group_id)
    )
  );

-- Default, practical groups — real platform structure (like `species`), not per-environment demo
-- data, so inserted here with fixed ids rather than in supabase/seed.sql.
insert into public.groups (id, name, slug, description, group_type) values
  ('c0000000-0000-0000-0000-000000000001', 'Border Collie owners & breeders', 'border-collie',
   'Breed-specific discussion for Border Collie owners and breeders.', 'breed'),
  ('c0000000-0000-0000-0000-000000000002', 'Golden & Labrador Retriever community', 'retrievers',
   'Breed-specific discussion for Golden and Labrador Retriever people.', 'breed'),
  ('c0000000-0000-0000-0000-000000000003', 'Breeders', 'breeders', 'For approved breeders to compare notes.', 'breeders'),
  ('c0000000-0000-0000-0000-000000000004', 'Foundations & rescue', 'foundations-rescue',
   'For foundations, shelters and rescue organisations.', 'foundation_rescue'),
  ('c0000000-0000-0000-0000-000000000005', 'Adoption', 'adoption',
   'Adoption stories, questions and support.', 'adoption'),
  ('c0000000-0000-0000-0000-000000000006', 'Poland ↔ Netherlands transport', 'transport-pl-nl',
   'Coordinate and discuss transport between Poland and the Netherlands.', 'transport_route'),
  ('c0000000-0000-0000-0000-000000000007', 'Poland ↔ Germany transport', 'transport-pl-de',
   'Coordinate and discuss transport between Poland and Germany.', 'transport_route'),
  ('c0000000-0000-0000-0000-000000000008', 'Shared transport availability', 'shared-transport',
   'Share and find shared-transport capacity on planned routes.', 'transport_route'),
  ('c0000000-0000-0000-0000-000000000009', 'Exhibitions & events', 'exhibitions-events',
   'Upcoming shows, exhibitions and events.', 'exhibitions'),
  ('c0000000-0000-0000-0000-000000000010', 'Rabbits & small mammals', 'rabbits-small-mammals',
   'For rabbit, guinea pig and other small companion mammal owners.', 'species'),
  ('c0000000-0000-0000-0000-000000000011', 'Cats & catteries', 'cats-catteries',
   'For cat owners and cattery breeders.', 'species');
