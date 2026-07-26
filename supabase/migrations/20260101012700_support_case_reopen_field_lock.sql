-- Stage XR-1 (append-only queue): protected-field mutation matrix. Auditing every table where a
-- less-privileged actor shares row-level UPDATE access with a more-privileged one (the exact bug
-- class this session has repeatedly found and fixed -- quotations, transport_documents,
-- buyer_applications, rehoming_reviews, organisations, welfare_case_documents) found one real,
-- previously-uncovered instance: support_cases' "requesters may only reopen their own resolved or
-- closed case" policy (20260101010400_support_cases.sql) has a `with check` that verifies only
-- `status = 'reopened'` -- RLS policies compare the NEW row against a predicate, they have no
-- built-in way to require every OTHER column stayed equal to OLD. Nothing stopped the exact same
-- UPDATE statement that reopens a case from also changing `priority` (e.g. to 'urgent', jumping
-- the support queue), `category`, `subject`, or `assigned_staff_id` (assigning the case to an
-- arbitrary staff member, or to themselves) in the same call -- every one of those is meant to be
-- staff-only, per this table's own header comment ("Every other field... is staff-only"), but
-- only `status` beyond reopen was actually enforced. Not reachable through the real UI
-- (no `src/` call site sends anything but `{ status: 'reopened' }` when reopening), but real via a
-- raw API call, the same "no UI path today, RLS is the actual boundary" severity tier as every
-- other fix in this class.
--
-- Same fix shape as prevent_buyer_writes_to_org_controlled_fields(): an allowlist of the columns a
-- requester may legitimately change (just `status`/`updated_at` here -- the reopen transition
-- itself is the only requester-initiated write this table has), diffed as jsonb so any future
-- column addition is protected by default rather than needing to be remembered.
create or replace function public.prevent_requester_writes_to_staff_controlled_support_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_requester_mutable_keys text[] := array['status', 'updated_at'];
  v_key text;
begin
  -- Same bypass convention as every other lock trigger in this schema: a direct superuser/service
  -- connection (migrations/seed) or ops staff acting on any case is always allowed through.
  if auth.uid() is null or public.is_ops_staff() then
    return new;
  end if;

  v_old := to_jsonb(old) - v_requester_mutable_keys;
  v_new := to_jsonb(new) - v_requester_mutable_keys;

  if v_old is distinct from v_new then
    for v_key in select jsonb_object_keys(v_old) loop
      if v_old -> v_key is distinct from v_new -> v_key then
        raise exception 'Only support staff can change %.', v_key
          using errcode = 'P0001';
      end if;
    end loop;
  end if;

  return new;
end;
$$;

create trigger prevent_requester_writes_to_staff_controlled_support_fields
  before update on public.support_cases
  for each row execute function public.prevent_requester_writes_to_staff_controlled_support_fields();
