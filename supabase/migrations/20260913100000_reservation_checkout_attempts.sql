-- Reservation checkout attempts — a real per-Stripe-session ledger, replacing pure reliance on
-- the single, overwritable `reservations.stripe_checkout_session_id` "current pointer" column for
-- payment reconciliation (2026-09-13 external review finding: "checkout attempts and webhook
-- events are not reconciled tightly enough ... track distinct payment attempts and reconcile
-- authenticated events against their exact attempt and amount, preserving every actual financial
-- event"). `reservations.stripe_checkout_session_id` still exists and is still updated (used to
-- know which session to expire on cancellation/re-attempt — see create-deposit-checkout-session
-- and cancel-reservation) but is no longer the sole authority for whether a given webhook event's
-- payment gets recorded — every session ever created for a reservation gets its own row here, so a
-- late/duplicate/out-of-order event for ANY of them can still be looked up and reconciled by its
-- own session id, amount and currency, instead of only the most recent one.

create table public.reservation_checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id),
  stripe_checkout_session_id text not null unique,
  amount numeric not null,
  currency text not null,
  status text not null default 'open' check (status in ('open', 'complete', 'expired')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

comment on table public.reservation_checkout_attempts is
  'One row per Stripe Checkout Session ever created for a reservation''s deposit — written by create-deposit-checkout-session (service role) at creation, updated by stripe-webhook (service role) on completion/expiry. Never written by an authenticated client directly.';

alter table public.reservation_checkout_attempts enable row level security;

-- Same visibility shape as reservation_payment_events (20260909000100) — buyer, the owning
-- org, or an admin. No insert/update/delete policy for `authenticated`: only the service-role
-- edge functions ever write this table.
create policy "buyers view their own reservation's checkout attempts"
  on public.reservation_checkout_attempts for select
  to authenticated
  using (
    exists (
      select 1 from public.reservations r
      where r.id = reservation_checkout_attempts.reservation_id
        and r.buyer_id = (select auth.uid())
    )
  );

create policy "org owners view their reservations' checkout attempts"
  on public.reservation_checkout_attempts for select
  to authenticated
  using (
    exists (
      select 1 from public.reservations r
      where r.id = reservation_checkout_attempts.reservation_id
        and public.owns_org(r.organization_id)
    )
  );

create policy "admins view all reservation checkout attempts"
  on public.reservation_checkout_attempts for select
  to authenticated
  using (public.is_admin());

grant select on public.reservation_checkout_attempts to authenticated;

create index reservation_checkout_attempts_reservation_id_idx
  on public.reservation_checkout_attempts (reservation_id);
