-- Stage C (transport timeline): found while building a role-scoped timeline that a party named
-- via the new transport_parties table cannot see anything about the request they're named on.
-- "named parties view the transport request" (20260101001300_transport_requests.sql) and
-- "request parties view their status history" both only check the *legacy inline* columns
-- (current_owner_profile_id/sender_profile_id/recipient_profile_id/payer_profile_id/sender_org_id)
-- — confirmed by reading both policies directly. A recipient/payer/sender/legal_owner named via
-- create_transport_draft()'s p_parties (i.e. through transport_parties, not the inline columns)
-- already has visibility into their own transport_parties row ("named profile parties view their
-- own party row"), but that row alone tells them nothing about the actual request — not the
-- route, not the animal, not any status history. This makes the entire multi-party model close to
-- non-functional from a named party's own point of view for anything created through the new RPC.
create or replace function public.is_named_transport_party(p_transport_request_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.transport_parties tp
    where tp.transport_request_id = p_transport_request_id
      and tp.party_role <> 'requester'
      and (
        tp.profile_id = auth.uid()
        or (tp.organisation_id is not null and public.is_org_member(tp.organisation_id))
      )
  );
$$;

create policy "named transport_parties view the request"
  on public.transport_requests for select
  to authenticated
  using (public.is_named_transport_party(id));

create policy "named transport_parties view status history"
  on public.transport_status_history for select
  to authenticated
  using (public.is_named_transport_party(transport_request_id));

-- Amendments had no party-visibility at all beyond the requester themselves — a named party
-- (e.g. an org named as sender) had no way to see a pending/resolved amendment on a request they
-- are legitimately part of.
create policy "named transport_parties view amendments"
  on public.transport_request_amendments for select
  to authenticated
  using (public.is_named_transport_party(transport_request_id));
