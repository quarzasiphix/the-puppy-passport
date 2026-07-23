-- Stage F: full adoption questionnaire and review workflow. buyer_applications already carries
-- almost the entire questionnaire this phase asks for (household/housing/garden/children/other
-- animals/experience/schedule/alone-time/intended purpose/collection method/transport interest) —
-- confirmed by reading the table directly, this is "the full multi-step questionnaire... the
-- template to extend from" IMPLEMENTATION_PLAN.md already pointed at, not something to duplicate.
-- What's genuinely missing: landlord permission, veterinary planning, consent/version metadata,
-- organisation-specific supplemental questions, an internal-only notes field distinct from the
-- applicant-visible breeder_response, and three workflow states (draft/interview_planned/expired).

alter type public.buyer_application_status add value 'draft';
alter type public.buyer_application_status add value 'interview_planned';
alter type public.buyer_application_status add value 'expired';

alter table public.buyer_applications
  add column landlord_permission boolean,
  add column veterinary_plan text,
  -- Internal-only — never selected for the applicant's own view (see listMyApplications() in
  -- src/lib/queries/applications.ts, and the write-lock trigger below).
  add column internal_notes text,
  add column consent_version text,
  add column consent_given_at timestamptz,
  -- A single flexible column for org-specific supplemental questions, same "config jsonb, no
  -- consumers yet for a fixed schema" pattern already used for product_service_categories
  -- (20260101005700_product_service_categories.sql) — a real per-org question set is a future
  -- foundation-settings feature, not invented here.
  add column organisation_supplemental_answers jsonb not null default '{}'::jsonb;

-- Real gap found while adding internal_notes: "buyers manage their own applications" is a `for
-- all` policy scoped only by row ownership (buyer_id = auth.uid()), the exact same column-level
-- gap the transport-request/quotation RLS had before earlier hardening passes closed it there. A
-- buyer could otherwise directly UPDATE their own application's status to 'approved', overwrite
-- breeder_response, or (once added) read/write internal_notes. Locks every organisation-controlled
-- column; the buyer keeps full ability to edit their own questionnaire answers (e.g. after
-- 'more_info_requested') and to withdraw their own application, matching the same
-- "submit/self-cancel are the only customer-initiated transitions" pattern already established for
-- transport_requests (20260101006000_lock_transport_request_operational_fields.sql).
-- Default-deny: strip the buyer's own allowed fields (their questionnaire answers, consent, and
-- the bookkeeping updated_at column) from the comparison, then reject *any* remaining difference —
-- an allow-list, not a block-list, so a column added to this table in the future is organisation-
-- controlled by default unless explicitly added to v_buyer_mutable_keys (mirrors
-- prevent_requester_snapshot_field_changes_after_draft's reasoning on transport_requests).
create or replace function public.prevent_buyer_writes_to_org_controlled_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_buyer_mutable_keys text[] := array[
    'buyer_city', 'buyer_country', 'phone', 'housing_type', 'has_garden', 'has_children',
    'children_ages', 'other_animals', 'previous_experience', 'breed_knowledge',
    'working_schedule', 'alone_time', 'intended_purpose', 'collection_method',
    'transport_required', 'preferred_collection_date', 'message',
    'landlord_permission', 'veterinary_plan', 'consent_version', 'consent_given_at',
    'organisation_supplemental_answers', 'status', 'updated_at'
  ];
  v_key text;
begin
  -- Same reasoning as every other lock trigger in this schema: a direct superuser/service
  -- connection (migrations/seed) or an org owner/admin acting on this application's own
  -- organisation is always allowed through unchanged.
  if auth.uid() is null or public.is_admin()
     or (old.organization_id is not null and public.owns_org(old.organization_id)) then
    return new;
  end if;

  -- The one legitimate buyer-initiated status change: withdrawing their own application, from any
  -- non-final status.
  if new.status is distinct from old.status and new.status is distinct from 'withdrawn' then
    raise exception 'Only the organisation can change an application''s status (other than withdrawing it yourself).'
      using errcode = 'P0001';
  end if;

  v_old := to_jsonb(old);
  v_new := to_jsonb(new);
  foreach v_key in array v_buyer_mutable_keys loop
    v_old := v_old - v_key;
    v_new := v_new - v_key;
  end loop;

  if v_old is distinct from v_new then
    raise exception 'Only the organisation can change that field on this application.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger prevent_buyer_writes_to_org_controlled_fields
  before update on public.buyer_applications
  for each row execute function public.prevent_buyer_writes_to_org_controlled_fields();
