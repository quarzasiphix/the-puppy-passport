-- public_parent_dogs — the anon read path for a kennel's BREEDING STOCK.
--
-- Why this exists: `public_dogs` (pedigree-graph view, 20260910000100) exposes every permanent
-- `dogs` identity a kennel touches — its breeding adults AND every puppy it has ever bred AND
-- external ancestors entered from a pedigree document. A breeder's public site ("our dogs",
-- studs, brood bitches) wants only the first group: the rows the breeder actively manages as
-- `parent_dogs`. api.anemalo.com/v1/site-content used `public_dogs` for its `dogs` array and so
-- returned puppies-as-dogs too (19 instead of 11 for GRYFIN YORK). This view is the fix.
--
-- Same convention as public_dogs / public_transport_requests: a plain (NOT security_invoker)
-- view, so it runs with the owner's rights and hand-picks an anon-safe column list — the base
-- table `parent_dogs` keeps its "no anon policy" posture untouched. `microchip_number` is
-- deliberately NOT exposed (anti-theft / ID data has no place on a marketing site; the pedigree
-- registry's `public_dogs` still carries it, gated by `dogs.is_public`, for registry lookups).
--
-- Defense in depth: also gated on the owning kennel being approved + public, so a suspended or
-- unlisted kennel's stock never leaks even if a caller queries the view directly rather than
-- through the gateway's org-resolution step.

create view public.public_parent_dogs as
select
  pd.id,
  pd.kennel_id,
  pd.dog_id,
  d.slug            as dog_slug,
  pd.breed_id,
  pd.registered_name,
  pd.call_name,
  pd.sex,
  pd.date_of_birth,
  pd.color,
  pd.pedigree_number,
  pd.description,
  pd.profile_image_url,
  pd.health_tests,
  pd.titles,
  pd.is_active,
  pd.created_at,
  pd.updated_at
from public.parent_dogs pd
join public.organisations o on o.id = pd.kennel_id
left join public.dogs d on d.id = pd.dog_id
where o.verification_status = 'approved'
  and o.is_public;

grant select on public.public_parent_dogs to anon, authenticated;

comment on view public.public_parent_dogs is
  'Anon-safe breeding-stock rows for approved, public kennels. The gateway''s site-content `dogs` '
  'array. Distinct from public_dogs (whole pedigree graph). No microchip_number by design.';
