create type public.post_type as enum (
  'general', 'transport_update', 'route_announcement', 'litter_announcement', 'adoption_post',
  'achievement'
);
create type public.post_visibility as enum ('public', 'followers', 'group');
create type public.reaction_type as enum ('like', 'support', 'helpful');
create type public.group_member_role as enum ('member', 'moderator');

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  group_type text,
  created_at timestamptz not null default now()
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.group_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (group_id, profile_id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_profile_id uuid references public.profiles (id),
  author_organization_id uuid references public.organisations (id),
  post_type public.post_type not null default 'general',
  content text,
  image_urls text[] not null default '{}',
  linked_transport_request_id uuid references public.transport_requests (id),
  linked_animal_id uuid references public.animals (id),
  linked_route_id uuid references public.routes (id),
  group_id uuid references public.groups (id),
  visibility public.post_visibility not null default 'public',
  auto_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_posts_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_profile_id uuid not null references public.profiles (id),
  content text not null,
  created_at timestamptz not null default now()
);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  reaction_type public.reaction_type not null default 'like',
  created_at timestamptz not null default now(),
  constraint reactions_target check (
    (post_id is not null and comment_id is null) or (post_id is null and comment_id is not null)
  )
);
create unique index reactions_unique_post on public.reactions (profile_id, post_id) where post_id is not null;
create unique index reactions_unique_comment on public.reactions (profile_id, comment_id) where comment_id is not null;

create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_profile_id uuid not null references public.profiles (id) on delete cascade,
  followed_profile_id uuid references public.profiles (id) on delete cascade,
  followed_organization_id uuid references public.organisations (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint follows_target check (
    (followed_profile_id is not null and followed_organization_id is null)
    or (followed_profile_id is null and followed_organization_id is not null)
  )
);
create unique index follows_unique_profile on public.follows (follower_profile_id, followed_profile_id) where followed_profile_id is not null;
create unique index follows_unique_org on public.follows (follower_profile_id, followed_organization_id) where followed_organization_id is not null;

create table public.saved_posts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, post_id)
);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.follows enable row level security;
alter table public.saved_posts enable row level security;

create policy "groups are publicly readable" on public.groups for select to anon, authenticated using (true);
create policy "admins manage groups" on public.groups for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "group members are readable by authenticated users" on public.group_members for select to authenticated using (true);
create policy "users manage their own group membership" on public.group_members for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy "admins manage all group memberships" on public.group_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "public posts are readable by anyone" on public.posts for select to anon, authenticated using (visibility = 'public');
create policy "authors manage their own posts" on public.posts for all to authenticated
  using (author_profile_id = (select auth.uid()) or (author_organization_id is not null and public.owns_org(author_organization_id)))
  with check (author_profile_id = (select auth.uid()) or (author_organization_id is not null and public.owns_org(author_organization_id)));
create policy "admins manage all posts" on public.posts for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "comments follow their post's visibility" on public.comments for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.visibility = 'public'));
create policy "authenticated users comment" on public.comments for insert to authenticated
  with check (author_profile_id = (select auth.uid()));
create policy "authors manage their own comments" on public.comments for update to authenticated
  using (author_profile_id = (select auth.uid())) with check (author_profile_id = (select auth.uid()));
create policy "authors delete their own comments" on public.comments for delete to authenticated
  using (author_profile_id = (select auth.uid()));
create policy "admins manage all comments" on public.comments for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "reactions are publicly readable" on public.reactions for select to anon, authenticated using (true);
create policy "users manage their own reactions" on public.reactions for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

create policy "users manage their own follows" on public.follows for all to authenticated
  using (follower_profile_id = (select auth.uid())) with check (follower_profile_id = (select auth.uid()));

create policy "users manage their own saved posts" on public.saved_posts for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
