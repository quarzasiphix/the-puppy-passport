-- Breeder public-profile redesign: explicit, separately-explainable trust claims instead of one
-- vague "verified" badge (docs/PRODUCT_VISION.md pillar 2 already says claims must be labelled
-- with their verification state, never presented as uniformly "verified"). Two of the requested
-- claims already have a real home and do NOT get a new row here:
--   - "Identity verified" = public.user_verifications where user_id = organisations.owner_user_id
--     and verification_type = 'identity' and status = 'approved' (existing pipeline).
--   - "Kennel verified" = organisations.verification_status = 'approved' (this already IS kennel
--     verification in this schema).
-- This table covers the three that have no existing home: association/registry membership,
-- pedigree records, and health documents. "Completed Anemalo handovers" is a derived count
-- (completed reservations), not a claim — no schema needed for it either.
--
-- Admin-only writer for now (no self-submission flow yet, same posture as this schema's other
-- admin-reviewed claims) — an org-owner-submission INSERT policy can be added later without a
-- rewrite, same pattern as user_verifications already established.

create type public.organisation_trust_claim_type as enum (
  'association', 'pedigrees', 'health_documents'
);
create type public.organisation_trust_claim_status as enum (
  'unverified', 'pending', 'verified', 'rejected'
);

create table public.organisation_trust_claims (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  claim_type public.organisation_trust_claim_type not null,
  status public.organisation_trust_claim_status not null default 'unverified',
  evidence_note text,
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, claim_type)
);

create trigger set_organisation_trust_claims_updated_at
  before update on public.organisation_trust_claims
  for each row execute function public.set_updated_at();

alter table public.organisation_trust_claims enable row level security;

create policy "org owners view their own trust claims"
  on public.organisation_trust_claims for select
  to authenticated
  using (public.owns_org(organisation_id));

create policy "admins manage all trust claims"
  on public.organisation_trust_claims for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.organisation_trust_claims to authenticated;

-- Deliberately NOT security_invoker (same reasoning as public_transport_requests,
-- 20260101002300_public_views.sql): the base table has no anon/broad-authenticated SELECT policy
-- at all, so this view is the only sanctioned public path, hand-picking a safe column list —
-- never evidence_note or verified_by (an admin's internal reviewer identity/notes), and never a
-- 'rejected' or bare 'unverified' row (a rejection is not public-facing information; "unverified"
-- is simply the absence of a row from a viewer's point of view, not a claim to display at all).
create view public.public_organisation_trust_claims as
select
  otc.organisation_id,
  otc.claim_type,
  otc.status,
  otc.verified_at
from public.organisation_trust_claims otc
join public.organisations o on o.id = otc.organisation_id
where o.is_public = true
  and o.verification_status = 'approved'
  and otc.status in ('verified', 'pending');

grant select on public.public_organisation_trust_claims to anon, authenticated;
