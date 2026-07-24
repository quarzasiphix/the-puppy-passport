-- Stage L: full database consistency audit. Closes a real, previously-documented-but-unfixed gap
-- (docs/adr/TRANSPORT_DATA_MODEL.md, "Quotations, routes, assignments" section; carried forward in
-- docs/AUTONOMOUS_BACKEND_PROGRESS.md as a known open item): "requesters accept or reject their own
-- quotation" restricts `WITH CHECK (status in ('accepted', 'rejected'))`, but RLS is row-level, not
-- column-level -- nothing stops a requester's UPDATE from also changing total_price, base_price, or
-- any other column on the same statement. Not exploitable through the real UI
-- (respondToQuotation() in src/lib/queries/transport.ts only ever sends { status }), only via a raw
-- API call -- the exact same "found during an audit, never actually reachable through the app, but
-- real and worth closing" shape as every other lock trigger added this session.
create or replace function public.prevent_requester_writes_to_ops_controlled_quotation_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
begin
  -- Same reasoning as every other lock trigger in this schema: a direct superuser/service
  -- connection (migrations/seed) or ops staff is always allowed through unchanged -- ops already
  -- has "ops staff manage all quotations" granting full column access, this only adds the missing
  -- column-level restriction for the *requester's own* update policy.
  if auth.uid() is null or public.is_ops_staff() then
    return new;
  end if;

  v_old := to_jsonb(old) - 'status' - 'updated_at';
  v_new := to_jsonb(new) - 'status' - 'updated_at';

  if v_old is distinct from v_new then
    raise exception 'You can only accept or reject a quotation -- its price and other terms are set by operations.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger prevent_requester_writes_to_ops_controlled_quotation_fields
  before update on public.quotations
  for each row execute function public.prevent_requester_writes_to_ops_controlled_quotation_fields();
