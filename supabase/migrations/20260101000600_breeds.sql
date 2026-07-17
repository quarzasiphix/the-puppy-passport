-- breeds: reusable directory, publicly readable, admin-writable.

create type public.size_category as enum ('small', 'medium', 'large', 'giant');

create table public.breeds (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  size_category public.size_category not null,
  short_description text,
  image_url text
);

alter table public.breeds enable row level security;

create policy "breeds are publicly readable"
  on public.breeds for select
  to anon, authenticated
  using (true);

create policy "admins manage breeds"
  on public.breeds for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
