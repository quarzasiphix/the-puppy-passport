// Pure route-selection logic for organisation profiles, kept separate from any component so it can
// be unit-tested without mocking Supabase or React (see tests/unit/org-routing.test.ts). Kennels
// get the breeder-framed profile at /breeders/$slug; every other org_type (foundation, shelter,
// rescue) gets the adoption-framed profile at /foundations/$slug — used identically by
// _public.community.index.tsx (organisation-authored posts) and _public.profile.$profileId.tsx
// (a signed-in user's linked professional profile) so the two surfaces can't silently diverge.
export type OrgProfileRoute = "/breeders/$slug" | "/foundations/$slug";

export function orgProfileRoute(orgType: string): OrgProfileRoute {
  return orgType === "kennel" ? "/breeders/$slug" : "/foundations/$slug";
}
