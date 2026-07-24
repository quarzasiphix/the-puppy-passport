-- Stage AO (supplemental queue): security red-team pass. Found a real, serious gap:
-- "requesters manage documents on their own request" (20260101001400_transport_documents.sql) is
-- a FOR ALL policy with zero column restriction beyond row ownership. A requester could:
-- 1) Self-set status directly to 'accepted'/'rejected' and forge reviewed_by/reviewed_at, faking
--    an ops review that never happened.
-- 2) The more serious one -- **document substitution**: after a document is legitimately reviewed
--    and accepted by ops, the requester could UPDATE file_url to point at a *different* Storage
--    object (upload a new file, then swap the pointer) while status/reviewed_by/reviewed_at still
--    show "accepted by ops", making a never-reviewed replacement document appear ops-approved.
-- Neither is reachable through the real UI (submitDocument() in src/lib/queries/transport.ts only
-- ever inserts a fresh row with status defaulting to 'uploaded', never sets review fields or
-- updates an existing row's file_url), only via a raw API call -- the same shape as every other
-- lock added this session, but with real forgery/substitution consequences given these are the
-- documents (passports, health certificates, transport authorisations) the whole compliance
-- review process depends on.
--
-- Fix: a requester may still freely upload new documents and replace a not-yet-accepted one (a
-- legitimate "fix my rejected scan" workflow), but can never set/forge the review fields, and once
-- a document is accepted, it is completely locked from requester-side changes -- any further
-- change (including re-uploading a corrected file) must go through ops.
-- Also closes a smaller, related gap found while writing this trigger: reviewDocument()
-- (src/lib/queries/transport.ts) trusts a client-supplied reviewedBy for the review action itself
-- -- one ops account could credit a *different* ops/admin profile as the reviewer. Lower severity
-- than the requester-side gaps above (ops-to-ops, not customer-to-system), but the same forgeable-
-- actor shape closed everywhere else this session, and free to fix here: when ops changes status
-- to a real review outcome, reviewed_by/reviewed_at are always server-stamped, never trusted from
-- the client, regardless of what the UPDATE payload requests.
create or replace function public.prevent_requester_writes_to_document_review_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.is_ops_staff() then
    if TG_OP = 'UPDATE' and new.status is distinct from old.status
       and new.status in ('accepted', 'rejected') then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;
    return new;
  end if;

  if TG_OP = 'INSERT' then
    if new.reviewed_by is not null or new.reviewed_at is not null then
      raise exception 'A document cannot be uploaded as already reviewed.'
        using errcode = 'P0001';
    end if;
    if new.status not in ('missing', 'uploaded') then
      raise exception 'A newly uploaded document must start as uploaded.'
        using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- TG_OP = 'UPDATE'
  if old.status = 'accepted' then
    raise exception 'This document has already been accepted and can no longer be changed -- contact operations if it needs to be updated.'
      using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at
  then
    raise exception 'Only operations can review a document.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger prevent_requester_writes_to_document_review_fields
  before insert or update on public.transport_documents
  for each row execute function public.prevent_requester_writes_to_document_review_fields();
