-- Reservation cancellation — the state machine (src/domains/reservations/status.ts,
-- RESERVATION_TRANSITIONS) already allowed a transition into 'cancelled' from every
-- non-terminal status, but nothing actually wrote it: zero UI, zero RPC. This adds the one real
-- way to cancel, mirroring request_reservation_deposit()'s style (row lock, owns_org/is_admin
-- guard, explicit errcodes).
--
-- Business rule (2026-09-12 product decision): a paid deposit is never refunded on cancellation —
-- "platform collects, manual payout" already means the money is effectively the breeder's once
-- paid (see docs/RESERVATION_PAYMENT_DESIGN.md). So this function deliberately does NOT touch
-- deposit_status when it is already 'paid'. A merely-*requested*-but-unpaid deposit ('pending')
-- reverts to 'not_required' instead — nothing was ever charged, so there is nothing to forfeit or
-- keep; this mirrors the stripe-webhook function's own checkout.session.expired handling.

alter table public.reservations
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id),
  add column if not exists cancellation_reason text;

create or replace function public.cancel_reservation(
  p_reservation_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_reservation public.reservations%rowtype;
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Not authenticated.' using errcode = '42501';
  end if;

  select * into v_reservation from public.reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'Reservation not found.' using errcode = 'P0002';
  end if;

  if not (
    v_reservation.buyer_id = v_caller
    or public.owns_org(v_reservation.organization_id)
    or public.is_admin()
  ) then
    raise exception 'You are not a party to this reservation.' using errcode = '42501';
  end if;

  if v_reservation.status in ('cancelled', 'completed') then
    raise exception 'This reservation is already %.', v_reservation.status using errcode = 'P0001';
  end if;

  update public.reservations
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_caller,
      cancellation_reason = nullif(btrim(coalesce(p_reason, '')), ''),
      -- Nothing was ever charged for a merely-requested deposit, so nothing to forfeit or keep —
      -- revert it the same way an expired Stripe Checkout session does. A *paid* deposit is
      -- deliberately left untouched: see the file header, it is never refunded on cancellation.
      deposit_status = case
        when deposit_status = 'pending' then 'not_required'::public.deposit_status
        else deposit_status
      end
  where id = p_reservation_id;

  -- Free the puppy back up for other buyers — only if this reservation is the reason it's
  -- currently marked reserved (never touch an animal that has since moved on, e.g. to 'sold').
  update public.animals
  set availability_status = 'available'
  where id = v_reservation.animal_id
    and availability_status = 'reserved';

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    v_caller,
    'reservation.cancelled',
    'reservations',
    p_reservation_id,
    jsonb_build_object('status', v_reservation.status, 'deposit_status', v_reservation.deposit_status),
    jsonb_build_object('status', 'cancelled', 'reason', p_reason)
  );
end;
$function$;

grant execute on function public.cancel_reservation(uuid, text) to authenticated;
