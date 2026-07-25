-- Stage IR-6 (integration-readiness queue): complete product scenarios. Writing an end-to-end
-- test for the full "buyer applies -> breeder approves -> reserved" journey (the exact pipeline
-- docs/PRODUCT_VISION.md's own priority hierarchy names -- "applications/reservations/adoption/
-- handover") surfaced a real, significant gap: `reservations` (20260101001100_reservations.sql)
-- has a complete, already-correct RLS contract -- "org owners create reservations from approved
-- applications" specifically requires the source application to be status='approved' for the same
-- animal -- but there was no code path anywhere that could ever actually create one. Grepped every
-- query file: reservations.ts only has read functions (listMyReservationsAsBuyer/
-- listReservationsForMyKennel), zero insert. Grepped every route file: the one real application-
-- review UI (dashboard.breeder.applications.tsx) only offers approve/reject, no "convert to
-- reservation" action at all -- even though applicationStatusLabels already has a dead
-- 'converted_to_reservation': 'Reserved' label that nothing could ever actually reach. The
-- "schema/RLS built, never wired" shape this session has repeatedly found and closed elsewhere
-- (Stage BG's evidence_url, Stage S's message attachments), just for a more product-critical step
-- this time -- the entire commercial purchase pipeline had no way to complete past "approved."
--
-- New atomic RPC rather than a raw client insert: creating a reservation is genuinely a 3-table
-- write (the reservation row itself, the source application's status, the animal's public
-- availability_status) that must succeed or fail together -- the same non-atomic-multi-write risk
-- this session has closed repeatedly elsewhere (advance_transport_job_status,
-- assign_request_to_route, claim_moderation_case).
create or replace function public.convert_application_to_reservation(
  p_application_id uuid,
  p_agreed_price numeric default null,
  p_currency text default 'PLN',
  p_planned_collection_date date default null,
  p_collection_method public.collection_method default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application public.buyer_applications;
  v_reservation_id uuid;
begin
  select * into v_application from public.buyer_applications where id = p_application_id;
  if not found then
    raise exception 'Application not found' using errcode = 'P0001';
  end if;

  if v_application.organization_id is null then
    raise exception 'This application has no organisation to reserve on behalf of.'
      using errcode = 'P0001';
  end if;

  if not public.owns_org(v_application.organization_id) and not public.is_admin() then
    raise exception 'Only the organisation this application was submitted to can convert it to a reservation.'
      using errcode = 'P0001';
  end if;

  if v_application.status <> 'approved' then
    raise exception 'Only an approved application can be converted to a reservation.'
      using errcode = 'P0001';
  end if;

  if exists (select 1 from public.reservations where application_id = p_application_id) then
    raise exception 'This application has already been converted to a reservation.'
      using errcode = 'P0001';
  end if;

  insert into public.reservations (
    animal_id, litter_id, buyer_id, organization_id, application_id,
    agreed_price, currency, planned_collection_date, collection_method, notes
  )
  values (
    v_application.animal_id, v_application.litter_id, v_application.buyer_id,
    v_application.organization_id, p_application_id,
    p_agreed_price, p_currency, p_planned_collection_date, p_collection_method, p_notes
  )
  returning id into v_reservation_id;

  update public.buyer_applications set status = 'converted_to_reservation'
  where id = p_application_id;

  -- Best-effort: only actually change availability if the animal is still in a state where
  -- "reserved" is a meaningful forward transition -- never overwrite an animal that's already
  -- moved further along (sold/adopted) or been withdrawn, which a stale/duplicate call could race.
  update public.animals set availability_status = 'reserved'
  where id = v_application.animal_id
    and availability_status in ('available', 'applications_open');

  return v_reservation_id;
end;
$$;

revoke all on function public.convert_application_to_reservation(uuid, numeric, text, date, public.collection_method, text) from public;
grant execute on function public.convert_application_to_reservation(uuid, numeric, text, date, public.collection_method, text) to authenticated;
