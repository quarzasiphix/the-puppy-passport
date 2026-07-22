-- Verified-organisation fundraising (docs/PRODUCT_VISION.md hierarchy pillar 7,
-- docs/FUNDRAISING_POLICY.md is the authoritative policy this schema must match). No payment
-- provider is integrated — every contribution row this schema can produce is either
-- `is_simulated = true` (a clearly-labelled development-only test payment) or otherwise unpaid;
-- nothing here claims a real payment has moved money. The whole feature stays behind an
-- application-level flag (see src/lib/fundraising-flag.ts) until a real provider, refund rules and
-- legal texts are explicitly approved.

create type public.fundraising_campaign_status as enum (
  'draft', 'organisation_review', 'approved', 'active', 'target_reached', 'partially_funded',
  'expired', 'transport_cancelled', 'suspended', 'completed', 'refund_review'
);

create type public.fundraising_payment_status as enum ('pending', 'completed', 'failed', 'refunded');

-- Only these organisation types may run a fundraiser at all (see FUNDRAISING_POLICY.md
-- "Eligibility") — never kennels (commercial breeders), transport_company, kennel_club or an
-- unreviewed "other". Kept as a function (not inlined) so the eligibility rule lives in one place.
create or replace function public.is_eligible_fundraising_org(p_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.organisations
    where id = p_org_id
      and org_type in ('foundation', 'shelter', 'rescue')
      and verification_status = 'approved'
  );
$$;

-- Shared by both the INSERT and UPDATE policies below so the required relational shape (real
-- animal owned by this org, real adoption/rehoming application for that animal, real transport
-- request for that animal, an *accepted* quotation for that request) can't drift between the two
-- policies or be bypassed by editing an existing row after the fact — "do not permit raising money
-- for purchasing an animal" is enforced here via application_type, never 'purchase'.
create or replace function public.fundraising_campaign_links_are_valid(
  p_organisation_id uuid, p_animal_id uuid, p_buyer_application_id uuid,
  p_transport_request_id uuid, p_quotation_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    exists (select 1 from public.animals a where a.id = p_animal_id and a.organization_id = p_organisation_id)
    and exists (
      select 1 from public.buyer_applications ba
      where ba.id = p_buyer_application_id
        and ba.animal_id = p_animal_id
        and ba.application_type in ('adoption', 'rehoming_inquiry')
    )
    and exists (
      select 1 from public.transport_requests tr
      where tr.id = p_transport_request_id and tr.animal_id = p_animal_id
    )
    and exists (
      select 1 from public.quotations q
      where q.id = p_quotation_id and q.transport_request_id = p_transport_request_id and q.status = 'accepted'
    );
$$;

create table public.fundraising_campaigns (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id),
  animal_id uuid not null references public.animals (id),
  buyer_application_id uuid not null references public.buyer_applications (id),
  transport_request_id uuid not null references public.transport_requests (id),
  quotation_id uuid not null references public.quotations (id),
  title text not null,
  description text,
  target_amount numeric(10, 2) not null check (target_amount > 0),
  currency text not null default 'EUR',
  deadline date,
  status public.fundraising_campaign_status not null default 'draft',
  excess_funds_policy text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "Do not permit creating duplicate campaigns for the same quotation" — one non-terminal campaign
-- per quotation. Terminal states (expired/transport_cancelled/suspended/completed) don't block a
-- fresh campaign against a *replaced* quotation.
create unique index fundraising_campaigns_one_active_per_quotation
  on public.fundraising_campaigns (quotation_id)
  where status not in ('expired', 'transport_cancelled', 'suspended', 'completed');

create trigger set_fundraising_campaigns_updated_at
  before update on public.fundraising_campaigns
  for each row execute function public.set_updated_at();

-- "Do not permit changing the campaign purpose after the first payment" — animal/transport
-- request/quotation/organisation must not change once a completed contribution exists.
create or replace function public.prevent_fundraising_purpose_change_after_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.animal_id, new.transport_request_id, new.quotation_id, new.organisation_id)
     is distinct from (old.animal_id, old.transport_request_id, old.quotation_id, old.organisation_id)
  then
    if exists (
      select 1 from public.fundraising_contributions
      where campaign_id = old.id and payment_status = 'completed'
    ) then
      raise exception 'Cannot change a fundraising campaign''s animal, transport request, quotation or organisation once it has received a completed contribution.';
    end if;
  end if;
  return new;
end;
$$;

create trigger fundraising_campaigns_lock_purpose_after_payment
  before update on public.fundraising_campaigns
  for each row execute function public.prevent_fundraising_purpose_change_after_payment();

alter table public.fundraising_campaigns enable row level security;

-- Public: only genuinely public-facing states, and only for campaigns belonging to a still-public
-- organisation (mirrors the "public reads approved published organisations" pattern).
create policy "public reads active fundraising campaigns"
  on public.fundraising_campaigns for select
  to anon, authenticated
  using (
    status in ('active', 'target_reached', 'partially_funded', 'completed')
    and exists (
      select 1 from public.organisations o
      where o.id = organisation_id and o.verification_status = 'approved' and o.is_public
    )
  );

create policy "eligible org owners view their own campaigns"
  on public.fundraising_campaigns for select
  to authenticated
  using (public.owns_org(organisation_id));

create policy "eligible org owners create draft campaigns"
  on public.fundraising_campaigns for insert
  to authenticated
  with check (
    public.owns_org(organisation_id)
    and public.is_eligible_fundraising_org(organisation_id)
    and status = 'draft'
    and public.fundraising_campaign_links_are_valid(
      organisation_id, animal_id, buyer_application_id, transport_request_id, quotation_id
    )
  );

create policy "eligible org owners update their own non-terminal campaigns"
  on public.fundraising_campaigns for update
  to authenticated
  using (public.owns_org(organisation_id) and status not in ('completed', 'refund_review'))
  with check (
    public.owns_org(organisation_id)
    and public.is_eligible_fundraising_org(organisation_id)
    and public.fundraising_campaign_links_are_valid(
      organisation_id, animal_id, buyer_application_id, transport_request_id, quotation_id
    )
    -- an org may move their own campaign between draft/organisation_review/active/expired/
    -- transport_cancelled themselves; only an admin can set approved/suspended/refund_review/
    -- completed (enforced by the admin-only policy being required for those transitions — this
    -- policy's status check narrows what an org can set unilaterally).
    and status in ('draft', 'organisation_review', 'active', 'target_reached', 'partially_funded', 'expired', 'transport_cancelled')
  );

create policy "admins manage all fundraising campaigns"
  on public.fundraising_campaigns for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table public.fundraising_contributions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.fundraising_campaigns (id) on delete cascade,
  supporter_profile_id uuid not null references public.profiles (id),
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null default 'EUR',
  display_publicly boolean not null default true,
  public_message text,
  payment_status public.fundraising_payment_status not null default 'pending',
  -- Never a real payment integration yet — see the file header. `is_simulated` makes it
  -- structurally impossible to mistake a dev-only test row for real money; app code must refuse
  -- to ever insert is_simulated = false until a real payment provider exists.
  is_simulated boolean not null default true,
  payment_provider_reference text,
  created_at timestamptz not null default now()
);

alter table public.fundraising_contributions enable row level security;

create policy "supporters create their own contribution"
  on public.fundraising_contributions for insert
  to authenticated
  with check (
    supporter_profile_id = (select auth.uid())
    and is_simulated = true -- see file header: no real payment path exists yet
    and exists (
      select 1 from public.fundraising_campaigns c
      where c.id = campaign_id and c.status in ('active', 'target_reached', 'partially_funded')
    )
  );

create policy "supporters view their own contributions"
  on public.fundraising_contributions for select
  to authenticated
  using (supporter_profile_id = (select auth.uid()));

create policy "eligible org owners view contributions to their campaigns"
  on public.fundraising_contributions for select
  to authenticated
  using (
    exists (
      select 1 from public.fundraising_campaigns c
      where c.id = campaign_id and public.owns_org(c.organisation_id)
    )
  );

create policy "admins manage all fundraising contributions"
  on public.fundraising_contributions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Public campaign pages need "amount collected so far" and public supporter messages, but never
-- supporter_profile_id itself (not even for a non-anonymous supporter — a public first name is a
-- UI choice for later, not a raw profile id) and never a non-public message. Same pattern as
-- public_transport_requests: a hand-picked-column view, not a column grant, not security_invoker
-- (see docs/DECISIONS.md).
create view public.public_fundraising_contributions
  with (security_invoker = false) as
  select
    fc.id,
    fc.campaign_id,
    fc.amount,
    fc.currency,
    fc.public_message,
    fc.created_at
  from public.fundraising_contributions fc
  join public.fundraising_campaigns c on c.id = fc.campaign_id
  where fc.display_publicly = true
    and fc.payment_status = 'completed'
    and c.status in ('active', 'target_reached', 'partially_funded', 'completed');

grant select on public.public_fundraising_contributions to anon, authenticated;

-- Separate from the view above on purpose: "remain anonymous publicly" (FUNDRAISING_POLICY.md)
-- means hiding a contribution's own attribution/message from the public list, not excluding it
-- from the campaign's total raised — an anonymous €50 must still count toward "target reached".
-- Exposes only the sum, never a per-row anything (not even for a display_publicly = true row),
-- so it can't be used to work around the row-level view's privacy above.
create view public.public_fundraising_totals
  with (security_invoker = false) as
  select
    c.id as campaign_id,
    coalesce(sum(fc.amount) filter (where fc.payment_status = 'completed'), 0) as total_collected
  from public.fundraising_campaigns c
  left join public.fundraising_contributions fc on fc.campaign_id = c.id
  where c.status in ('active', 'target_reached', 'partially_funded', 'completed')
  group by c.id;

grant select on public.public_fundraising_totals to anon, authenticated;

grant select on public.fundraising_campaigns to anon;
grant select, insert, update, delete on public.fundraising_campaigns to authenticated;
grant select, insert, update, delete on public.fundraising_contributions to authenticated;
