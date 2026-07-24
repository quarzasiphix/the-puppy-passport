-- Stage T (supplemental queue): listing lifecycle. Same bug class as
-- 20260101008800_rehoming_review_self_approval_lock.sql, found while reviewing the buyer/org
-- application boundary as part of the same listing-lifecycle sweep:
-- prevent_buyer_writes_to_org_controlled_fields() (20260101007800) only ever fires
-- `before update`, and the RLS INSERT policy on buyer_applications ("buyers manage their own
-- applications", a FOR ALL policy whose WITH CHECK only verifies `buyer_id = auth.uid()`) never
-- restricts `status`. A buyer's INSERT could set status directly to 'approved' (or any other
-- value), landing an already-"approved" application in the table without ever going through
-- organisation review. Not reachable through the real UI (submitApplication() in
-- src/lib/queries/applications.ts never sends a status field, relying on the column default of
-- 'submitted'), only via a raw API call.
--
-- Fixed by extending the same trigger to fire on INSERT too, matching the
-- set_moderation_case_appeal_deadline fix from Stage G ("only fired on UPDATE, silently missing
-- the INSERT case") -- reusing the existing trigger rather than adding a second, redundant one.
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
     or (new.organization_id is not null and public.owns_org(new.organization_id)) then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    if new.status is distinct from 'submitted' then
      raise exception 'A new application must start as submitted.'
        using errcode = 'P0001';
    end if;
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

drop trigger prevent_buyer_writes_to_org_controlled_fields on public.buyer_applications;

create trigger prevent_buyer_writes_to_org_controlled_fields
  before insert or update on public.buyer_applications
  for each row execute function public.prevent_buyer_writes_to_org_controlled_fields();
