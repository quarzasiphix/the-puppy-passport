-- profiles: one row per auth.users row, holding the common account information for every
-- person on the platform regardless of which elevated roles (see user_roles) they hold.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  first_name text,
  last_name text,
  email text,
  phone text,
  avatar_url text,
  preferred_language text not null default 'en',
  preferred_currency text not null default 'EUR',
  country text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Every authenticated user can be looked up by id (needed to render "posted by", breeder name,
-- etc. across the app) but only non-sensitive columns are selected by callers in practice; phone
-- and email stay restricted to the owner via column-level exposure in application queries.
create policy "profiles are viewable by any authenticated user"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users manage their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Populates profiles automatically whenever a new auth user is created, reading the metadata
-- passed at sign-up time (supabase.auth.signUp({ options: { data: { first_name, ... } } })).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, display_name, first_name, last_name, email, phone, preferred_language, preferred_currency, country, city
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      trim(concat(new.raw_user_meta_data ->> 'first_name', ' ', new.raw_user_meta_data ->> 'last_name'))
    ),
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.email,
    new.raw_user_meta_data ->> 'phone',
    coalesce(new.raw_user_meta_data ->> 'preferred_language', 'en'),
    coalesce(new.raw_user_meta_data ->> 'preferred_currency', 'EUR'),
    new.raw_user_meta_data ->> 'country',
    new.raw_user_meta_data ->> 'city'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
