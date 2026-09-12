-- Breeder payout tracking (manual-payout v1) — see the approved plan this session
-- (breeder payout tracking) for full context. Once a deposit is paid, Anemalo owes that money to
-- the breeder (platform collects, manual bank-transfer payout — no Stripe Connect yet). Nothing
-- previously tracked that obligation or a due-by date. 20-day SLA from deposit_paid_at, chosen as
-- a comfortable buffer over Stripe's own Poland settlement timing (7-day initial, 3-business-day
-- thereafter, plus the payout-to-bank leg).
--
-- v1 assumption: the full deposit_amount is owed, no platform fee deduction — no fee concept
-- exists anywhere in this schema yet (docs/RESERVATION_PAYMENT_DESIGN.md lists platform_fee as a
-- deferred column). Cancellation never touches a paid deposit (see cancel_reservation(),
-- 20260912120000_reservation_cancellation.sql) — that money is correctly still owed regardless.

create type public.payout_status as enum ('owed', 'paid');

create table public.reservation_payouts (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.reservations(id),
  organization_id uuid not null references public.organisations(id),
  amount numeric not null,
  currency text not null,
  status public.payout_status not null default 'owed',
  due_at timestamptz not null,
  paid_at timestamptz,
  paid_by uuid references public.profiles(id),
  payout_reference text,
  created_at timestamptz not null default now()
);

alter table public.reservation_payouts enable row level security;

-- RLS mirrors organisation_trust_claims exactly: org SELECT-only via owns_org(), admin `for all`.
-- No authenticated INSERT/UPDATE grant at all — a breeder can see their own payout rows but can
-- never mark themselves paid; only the trigger below (security definer) and the admin-only RPC
-- further down ever write to this table.
create policy "org owners view their own organisation's payouts"
  on public.reservation_payouts for select to authenticated
  using (public.owns_org(organization_id));

create policy "admins manage all payouts"
  on public.reservation_payouts for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.reservation_payouts to authenticated;

-- Row creation is a trigger, not something the stripe-webhook edge function does directly —
-- this repo already keeps derived state in sync via DB triggers elsewhere (e.g. the pedigree
-- verification-level recompute), and a trigger survives any future write path that flips
-- deposit_status to 'paid', not just today's one webhook call.
create or replace function public.create_reservation_payout_on_deposit_paid()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.reservation_payouts (
    reservation_id, organization_id, amount, currency, due_at
  ) values (
    new.id,
    new.organization_id,
    new.deposit_amount,
    coalesce(new.currency, 'PLN'),
    coalesce(new.deposit_paid_at, now()) + interval '20 days'
  )
  on conflict (reservation_id) do nothing;
  return new;
end;
$function$;

create trigger reservation_payout_on_deposit_paid
  after update on public.reservations
  for each row
  when (old.deposit_status is distinct from new.deposit_status and new.deposit_status = 'paid')
  execute function public.create_reservation_payout_on_deposit_paid();

-- Admin/ops-only. Mirrors request_reservation_deposit()'s style: row lock, explicit errcodes,
-- audit_logs insert. Never callable by the breeder or buyer — Anemalo staff are the ones actually
-- sending the bank transfer in this manual-payout model.
create or replace function public.mark_reservation_payout_paid(
  p_payout_id uuid,
  p_payout_reference text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_payout public.reservation_payouts%rowtype;
  v_caller uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'Only Anemalo staff can mark a payout as paid.' using errcode = '42501';
  end if;

  select * into v_payout from public.reservation_payouts where id = p_payout_id for update;
  if not found then
    raise exception 'Payout not found.' using errcode = 'P0002';
  end if;

  if v_payout.status <> 'owed' then
    raise exception 'This payout is already marked %.', v_payout.status using errcode = 'P0001';
  end if;

  update public.reservation_payouts
  set status = 'paid',
      paid_at = now(),
      paid_by = v_caller,
      payout_reference = nullif(btrim(coalesce(p_payout_reference, '')), '')
  where id = p_payout_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    v_caller,
    'reservation_payout.marked_paid',
    'reservation_payouts',
    p_payout_id,
    jsonb_build_object('status', 'owed'),
    jsonb_build_object('status', 'paid', 'payout_reference', p_payout_reference)
  );
end;
$function$;

grant execute on function public.mark_reservation_payout_paid(uuid, text) to authenticated;
