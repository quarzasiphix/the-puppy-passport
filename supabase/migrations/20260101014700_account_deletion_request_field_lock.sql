-- Independently verified from a Bot 1 audit finding (H-1/§5.2, reproduced live against this repo's
-- own database before fixing, not trusted from the report alone).
--
-- "users manage their own deletion request" (account_deletion_requests, ALL, `profile_id =
-- auth.uid()`) is row-level, not column-level -- the only legitimate self-service write is a plain
-- insert (requestAccountDeletion() in src/lib/queries/privacy.ts), but the same policy also lets a
-- user raw-UPDATE status/processed_at/processed_by on their own row. Confirmed empirically: a
-- customer could mark their own pending request 'processed' (or 'declined'), stamp an arbitrary
-- timestamp, and forge processed_by to name any real admin as having decided it -- without
-- execute_account_deletion() ever running, so the account stays fully intact. Beyond the false
-- attribution, this lets a genuine pending request silently vanish from any admin queue filtered on
-- status = 'pending'.
--
-- Also found while fixing this: markDeletionRequestProcessed()'s "declined" path (the "processed"
-- path already correctly goes through the admin-only execute_account_deletion() RPC) does a raw
-- update passing a plain client-supplied processedBy argument -- the same forgeable-actor shape
-- already closed for transport_status_history.changed_by, quotations.created_by, etc. Closed here
-- too, in the same migration, since it's the same table and the same underlying concern.
create or replace function public.prevent_non_admin_deletion_request_field_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.status is distinct from old.status
    or new.processed_at is distinct from old.processed_at
    or new.processed_by is distinct from old.processed_by
  then
    raise exception 'Only an admin can change the status of an account deletion request'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger prevent_non_admin_deletion_request_field_changes
  before update on public.account_deletion_requests
  for each row execute function public.prevent_non_admin_deletion_request_field_changes();

create or replace function public.stamp_deletion_request_processed_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status in ('processed', 'declined') then
    new.processed_by := auth.uid();
    new.processed_at := coalesce(new.processed_at, now());
  end if;
  return new;
end;
$$;

create trigger stamp_deletion_request_processed_by
  before update on public.account_deletion_requests
  for each row execute function public.stamp_deletion_request_processed_by();
