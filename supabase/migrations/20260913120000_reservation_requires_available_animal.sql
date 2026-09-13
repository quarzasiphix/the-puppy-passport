-- convert_application_to_reservation() never checked the animal's own availability_status before
-- creating a reservation for it — only that the *application* was approved. Two different buyer
-- applications for the same popular puppy can both legitimately reach status='approved' (a
-- breeder reviewing several interested buyers before picking one), and nothing stopped both from
-- then being converted: the second conversion would insert a second reservations row for an
-- animal that's already 'reserved' (or 'sold'/'adopted') — the animal-status update at the end is
-- already written defensively ("only if still available/applications_open") so it silently no-ops
-- for the second call, but that silence let the second RESERVATION itself still get created.
-- Found 2026-09-13 (user: "this reservation should be possible only to available non reserved
-- dogs right").
--
-- Fix: lock and check the animal's current availability_status before inserting, same `for
-- update` pattern already used in request_reservation_deposit()/cancel_reservation() to close the
-- equivalent race under concurrent calls. Everything else is unchanged from the
-- 20260101013600_admin_command_audit_coverage.sql version (the idempotent-retry-safe early return
-- for an application that's already been converted is preserved and deliberately runs BEFORE this
-- new check — retrying/refreshing a call for an already-converted application must keep returning
-- its existing reservation regardless of the animal's current state, since that reservation's own
-- creation already passed this check).
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
  v_existing public.reservations;
  v_animal_status public.animal_availability_status;
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

  select * into v_existing from public.reservations where application_id = p_application_id;
  if found then
    if v_existing.agreed_price is distinct from p_agreed_price
       or v_existing.currency is distinct from p_currency
       or v_existing.planned_collection_date is distinct from p_planned_collection_date
       or v_existing.collection_method is distinct from p_collection_method then
      raise exception 'This application was already converted to a reservation with different terms — refresh and try again.'
        using errcode = 'P0001';
    end if;
    return v_existing.id;
  end if;

  if v_application.status <> 'approved' then
    raise exception 'Only an approved application can be converted to a reservation.'
      using errcode = 'P0001';
  end if;

  -- Row lock closes the same race the deposit/cancellation RPCs already close elsewhere: two
  -- concurrent conversions for two different (both approved) applications on the same animal must
  -- not both succeed. The second caller blocks here until the first transaction commits or rolls
  -- back, then re-reads the now-current status.
  select availability_status into v_animal_status
  from public.animals where id = v_application.animal_id for update;

  if v_animal_status is null then
    raise exception 'The puppy for this application could not be found.' using errcode = 'P0002';
  end if;

  if v_animal_status not in ('available', 'applications_open') then
    raise exception 'This puppy is no longer available to reserve — it may already be reserved or have found a home.'
      using errcode = 'P0001';
  end if;

  begin
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
  exception when unique_violation then
    select * into v_existing from public.reservations where application_id = p_application_id;
    if v_existing.agreed_price is distinct from p_agreed_price
       or v_existing.currency is distinct from p_currency
       or v_existing.planned_collection_date is distinct from p_planned_collection_date
       or v_existing.collection_method is distinct from p_collection_method then
      raise exception 'This application was already converted to a reservation with different terms — refresh and try again.'
        using errcode = 'P0001';
    end if;
    return v_existing.id;
  end;

  update public.buyer_applications set status = 'converted_to_reservation'
  where id = p_application_id;

  update public.animals set availability_status = 'reserved'
  where id = v_application.animal_id
    and availability_status in ('available', 'applications_open');

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, after)
  values (
    auth.uid(), 'buyer_application.converted_to_reservation', 'buyer_applications', p_application_id,
    jsonb_build_object('reservation_id', v_reservation_id, 'agreed_price', p_agreed_price, 'currency', p_currency)
  );

  return v_reservation_id;
end;
$$;
