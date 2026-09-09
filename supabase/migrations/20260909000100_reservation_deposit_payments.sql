-- Stripe zaliczka (deposit) payments — "platform collects, manual payout" model (2026-09-09
-- product decision: skip Stripe Connect for v1; the platform collects the deposit via a single
-- Stripe Checkout Session and breeders are paid out manually/by bank transfer outside the app for
-- now — see docs/RESERVATION_PAYMENT_DESIGN.md and docs/DEFERRED_BACKEND.md). Deliberately does
-- NOT widen `reservation_status` or `deposit_status` (still `not_required | pending | paid`) — the
-- existing 3-state enum already matches this simpler flow; only Stripe *tracking* columns and an
-- append-only webhook ledger are new. No Stripe account exists yet — the edge functions this
-- migration supports (`create-deposit-checkout-session`, `stripe-webhook`) return a clear
-- "not configured" error until STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET are set as Supabase Edge
-- Function secrets.

alter table public.reservations
  add column stripe_checkout_session_id text,
  add column stripe_payment_intent_id text,
  add column deposit_requested_at timestamptz,
  add column deposit_paid_at timestamptz;

comment on column public.reservations.stripe_checkout_session_id is
  'Set only by the create-deposit-checkout-session edge function (service role) — see prevent_client_writes_to_deposit_payment_fields().';
comment on column public.reservations.stripe_payment_intent_id is
  'Set only by the stripe-webhook edge function once checkout.session.completed fires.';
comment on column public.reservations.deposit_paid_at is
  'Set only by the stripe-webhook edge function — never a client-trusted timestamp.';

-- Append-only ledger of verified Stripe webhook events, one row per delivered event
-- (stripe_event_id unique = the idempotency key — a Stripe webhook can and will redeliver the same
-- event). Mirrors domains/payments/types.ts PaymentLedgerEvent. Only ever written by the
-- stripe-webhook edge function via the service_role key (which bypasses RLS entirely) — no
-- insert/update/delete policy exists here for `authenticated`, same posture as every other
-- audit-trail table in this schema (transport_status_history, audit_logs).
create table public.reservation_payment_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id),
  stripe_event_id text not null unique,
  event_type text not null,
  occurred_at timestamptz not null,
  raw jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.reservation_payment_events enable row level security;

create policy "buyers view their own reservation's payment events"
  on public.reservation_payment_events for select
  to authenticated
  using (
    exists (
      select 1 from public.reservations r
      where r.id = reservation_payment_events.reservation_id
        and r.buyer_id = (select auth.uid())
    )
  );

create policy "org owners view their reservations' payment events"
  on public.reservation_payment_events for select
  to authenticated
  using (
    exists (
      select 1 from public.reservations r
      where r.id = reservation_payment_events.reservation_id
        and public.owns_org(r.organization_id)
    )
  );

create policy "admins view all reservation payment events"
  on public.reservation_payment_events for select
  to authenticated
  using (public.is_admin());

grant select on public.reservation_payment_events to authenticated;

-- Column-level lock, same shape as prevent_requester_writes_to_ops_controlled_quotation_fields()
-- (20260101008400): service_role (auth.uid() is null, i.e. the edge functions) and admins pass
-- through unrestricted. For everyone else (including the org owner, whose "update their
-- organization's reservations" policy is otherwise column-unrestricted):
--   - the three Stripe/payment-system-owned columns can never change, no exceptions;
--   - deposit_status may only move not_required -> pending (the one client-legitimate transition,
--     matching request_reservation_deposit() below) — every other transition, including ->paid, is
--     payment-system-only, so a raw PostgREST PATCH can't fake a paid deposit.
create or replace function public.prevent_client_writes_to_deposit_payment_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.stripe_checkout_session_id is distinct from old.stripe_checkout_session_id
    or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
    or new.deposit_paid_at is distinct from old.deposit_paid_at
  then
    raise exception 'Stripe payment fields are set by the payment system, not directly.'
      using errcode = 'P0001';
  end if;

  if new.deposit_status is distinct from old.deposit_status
    and not (old.deposit_status = 'not_required' and new.deposit_status = 'pending')
  then
    raise exception 'Deposit status is set by the payment system, not directly — use request_reservation_deposit() to request a deposit.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger prevent_client_writes_to_deposit_payment_fields
  before update on public.reservations
  for each row execute function public.prevent_client_writes_to_deposit_payment_fields();

-- The only sanctioned client-callable way to move deposit_status from 'not_required' to 'pending'.
-- Kept as a SECURITY DEFINER RPC (rather than relying solely on the trigger above) so the "only the
-- breeder who owns this reservation, only a positive amount, only while the reservation is still
-- active, only once" rules give a clear error message instead of the trigger's generic one, and so
-- amount/currency/deposit_status/deposit_requested_at are all set atomically in one statement.
create or replace function public.request_reservation_deposit(
  p_reservation_id uuid,
  p_deposit_amount numeric,
  p_currency text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.reservations%rowtype;
begin
  if p_deposit_amount is null or p_deposit_amount <= 0 then
    raise exception 'Deposit amount must be greater than zero.' using errcode = 'P0001';
  end if;

  select * into v_reservation from public.reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'Reservation not found.' using errcode = 'P0002';
  end if;

  if not (public.owns_org(v_reservation.organization_id) or public.is_admin()) then
    raise exception 'Only the breeder for this reservation can request a deposit.' using errcode = '42501';
  end if;

  if v_reservation.status in ('cancelled', 'completed') then
    raise exception 'Cannot request a deposit on a % reservation.', v_reservation.status using errcode = 'P0001';
  end if;

  if v_reservation.deposit_status <> 'not_required' then
    raise exception 'A deposit has already been requested for this reservation.' using errcode = 'P0001';
  end if;

  update public.reservations
  set deposit_amount = p_deposit_amount,
      currency = coalesce(p_currency, currency, 'PLN'),
      deposit_status = 'pending',
      deposit_requested_at = now()
  where id = p_reservation_id;
end;
$$;

revoke all on function public.request_reservation_deposit(uuid, numeric, text) from public;
grant execute on function public.request_reservation_deposit(uuid, numeric, text) to authenticated;
