-- "Identity verified" is one of the five public trust badges the breeder profile redesign needs
-- (docs — breeder profile trust claims), sourced from the existing user_verifications pipeline
-- (verification_type = 'identity', status = 'approved') rather than a new table. But
-- user_verifications itself is private (self/admin-only, 20260101000550_user_verifications.sql) —
-- an anonymous profile visitor has no way to read it. This view exposes only the one boolean fact
-- a public profile actually needs, for the org's accountable owner specifically, nothing else from
-- the verification row (no submitted_data, no notes, no reviewer identity).
create view public.public_kennel_owner_identity_verification as
select
  o.id as organisation_id,
  (uv.id is not null) as identity_verified,
  uv.reviewed_at as identity_verified_at
from public.organisations o
left join public.user_verifications uv
  on uv.user_id = o.owner_user_id
  and uv.verification_type = 'identity'
  and uv.status = 'approved'
where o.is_public = true
  and o.verification_status = 'approved';

grant select on public.public_kennel_owner_identity_verification to anon, authenticated;
