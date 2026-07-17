-- SECURITY DEFINER helper functions used throughout RLS policies. They read tables that RLS
-- would otherwise block (e.g. a policy on `organisations` needs to check `organisation_members`
-- without re-triggering that table's own RLS), and they let policies stay simple one-liners
-- instead of repeating the same subqueries everywhere.
--
-- Some of these reference tables created in later migrations (organisations, organisation_members).
-- That's fine: plpgsql function bodies are only name-resolved at first execution, not at CREATE
-- FUNCTION time, and nothing calls these functions until the full schema exists.

create or replace function public.has_role(p_user_id uuid, p_role public.platform_role)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = p_user_id and role = p_role and status = 'active'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.has_role(auth.uid(), 'admin');
$$;

create or replace function public.is_moderator()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.has_role(auth.uid(), 'moderator') or public.is_admin();
$$;

-- Named is_ops_staff() (not is_operations()) for historical reasons in this codebase — it checks
-- the 'operations' role from the platform_role enum. Kept stable so the ~10 migrations after this
-- one that already call it don't all need editing when the role's display name changes again.
create or replace function public.is_ops_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.has_role(auth.uid(), 'operations') or public.is_admin();
$$;

-- Ownership is the explicit organisations.owner_user_id column, not a role row — every
-- organisation always has exactly one accountable owner even before any organisation_members rows
-- exist (which is exactly the moment approve_user_verification needs owns_org()-gated inserts to
-- already work).
--
-- These two reference organisations/organisation_members, created in a later migration, so they
-- must be `language plpgsql` (body name-resolved lazily on first call) rather than `language sql`
-- (body validated against the catalog at CREATE FUNCTION time, which would fail here since those
-- tables don't exist yet).
create or replace function public.owns_org(p_org_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return exists (
    select 1 from public.organisations
    where id = p_org_id and owner_user_id = auth.uid()
  );
end;
$$;

create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return public.owns_org(p_org_id) or exists (
    select 1 from public.organisation_members
    where org_id = p_org_id and profile_id = auth.uid()
  );
end;
$$;

-- Now that is_admin() exists, grant admins full access to the tables created before this
-- migration. Every later migration adds its own "admins manage everything" policy inline instead.
create policy "admins manage all profiles"
  on public.profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins manage all roles"
  on public.user_roles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
