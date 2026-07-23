-- Stage I: dashboard.admin.settings.tsx's own placeholder text says "Platform-wide configuration,
-- including featured-breeder selection" — no column backed that claim at all (confirmed by
-- `grep -n "is_featured" supabase/migrations/*.sql`, which only ever finds it on `animals`, never
-- `organisations`). Additive: admin-settable, defaults to false, never affects existing queries.
alter table public.organisations add column is_featured boolean not null default false;

-- "owners update their own organisation" is row-level only, so without this an org owner could
-- self-mark their own listing as featured -- defeating the entire point of admin curation, the
-- same class of gap Stage E already found and fixed for owner_user_id (which is admin-only per
-- prevent_org_owner_transfer_by_non_admin). is_featured joins that same trigger's protected set
-- rather than getting a second near-identical trigger.
create or replace function public.prevent_org_owner_transfer_by_non_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'Organisation ownership can only be transferred by Havenpaw staff — contact support to change the accountable owner.'
      using errcode = 'P0001';
  end if;
  if new.is_featured is distinct from old.is_featured then
    raise exception 'Only Havenpaw staff can feature or unfeature an organisation.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
