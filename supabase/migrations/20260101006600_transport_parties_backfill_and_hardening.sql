-- docs/adr/TRANSPORT_DATA_MODEL.md: transport_parties (20260101002400_animals_transport_fields.sql)
-- has correct RLS but zero rows and zero callers anywhere in src/ — it was built ahead of the UI
-- that would use it. This backfills it losslessly from the inline columns that already exist on
-- transport_requests (never inventing data — a role is only backfilled where the source column is
-- actually non-null), tightens two real integrity gaps found while auditing it, and adds the one
-- piece of visibility parity a named organisation needs that named profiles already had.

-- Backfill order matches the exact inline columns the real 7-step form and its schema already had.
-- requester is always present (transport_requests.requester_profile_id is not null) — added here so
-- it exists as a real transport_parties row too, not just the legacy column, going forward.
insert into public.transport_parties (transport_request_id, party_role, profile_id)
select id, 'requester', requester_profile_id from public.transport_requests;

insert into public.transport_parties (transport_request_id, party_role, profile_id)
select id, 'legal_owner', current_owner_profile_id
from public.transport_requests
where current_owner_profile_id is not null;

-- sender_org_id and sender_profile_id are mutually exclusive in transport_parties (the check
-- constraint below), so organisation takes precedence in the rare case both were somehow set on the
-- legacy row (in practice, confirmed via the form's submit handler, only sender_org_id is ever
-- written).
insert into public.transport_parties (transport_request_id, party_role, organisation_id)
select id, 'sender', sender_org_id
from public.transport_requests
where sender_org_id is not null;

insert into public.transport_parties (transport_request_id, party_role, profile_id)
select id, 'sender', sender_profile_id
from public.transport_requests
where sender_profile_id is not null and sender_org_id is null;

insert into public.transport_parties (transport_request_id, party_role, profile_id)
select id, 'recipient', recipient_profile_id
from public.transport_requests
where recipient_profile_id is not null;

insert into public.transport_parties (transport_request_id, party_role, profile_id)
select id, 'payer', payer_profile_id
from public.transport_requests
where payer_profile_id is not null;

-- release_authorized_by/receive_authorized_by were always just one free-text name with no phone or
-- email captured — backfilled as an external contact with only external_name, exactly what the
-- source data actually contains, nothing invented for the two fields it never had.
insert into public.transport_parties (transport_request_id, party_role, external_name)
select id, 'pickup_contact', release_authorized_by
from public.transport_requests
where release_authorized_by is not null and release_authorized_by <> '';

insert into public.transport_parties (transport_request_id, party_role, external_name)
select id, 'delivery_contact', receive_authorized_by
from public.transport_requests
where receive_authorized_by is not null and receive_authorized_by <> '';

-- Integrity fix #1: the original constraint allowed num_nonnulls(...) <= 1, i.e. a completely empty
-- party row (no profile, no org, no external contact) was valid. Every row inserted above sets
-- exactly one, so tightening to exactly 1 is safe against the data that now exists.
alter table public.transport_parties drop constraint transport_parties_single_reference;
alter table public.transport_parties add constraint transport_parties_single_reference check (
  num_nonnulls(profile_id, organisation_id, external_name) = 1
);

-- Integrity fix #2: external_phone/external_email were never required to travel with external_name
-- — a row could have a phone number attached to no name at all. Requires the name whenever contact
-- details are present (still allows a bare name with no phone/email, matching what the legacy
-- release/receive_authorized_by backfill just created).
alter table public.transport_parties add constraint transport_parties_external_contact_needs_name check (
  external_name is not null or (external_phone is null and external_email is null)
);

-- Integrity fix #3: nothing stopped two conflicting rows for the same role on the same request
-- (e.g. two different `payer` rows). One party per role per request from here on.
alter table public.transport_parties add constraint transport_parties_one_per_role
  unique (transport_request_id, party_role);

-- Visibility parity: a named profile could already see their own party row
-- ("named profile parties view their own party row"); a named organisation had no equivalent.
create policy "named organisation parties view their own party row"
  on public.transport_parties for select
  to authenticated
  using (organisation_id is not null and public.is_org_member(organisation_id));
