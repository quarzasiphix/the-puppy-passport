// Pure organisation-type logic, kept separate from any Supabase/React import so it can be
// unit-tested directly (see tests/unit/org-routing.test.ts) without mocking a client — this file
// has zero dependencies on purpose.

// Kennels get the breeder-framed profile at /breeders/$slug; every other org_type (foundation,
// shelter, rescue) gets the adoption-framed profile at /foundations/$slug — used identically by
// _public.community.index.tsx (organisation-authored posts) and _public.profile.$profileId.tsx
// (a signed-in user's linked professional profile) so the two surfaces can't silently diverge.
export type OrgProfileRoute = "/breeders/$slug" | "/foundations/$slug";

export function orgProfileRoute(orgType: string): OrgProfileRoute {
  return orgType === "kennel" ? "/breeders/$slug" : "/foundations/$slug";
}

// The three non-kennel org_type values that get foundation-style adoption framing — single source
// of truth used by both marketplace.ts (mapOrgToFoundation) and buyer-activity.ts
// (listFollowedFoundations), which previously each declared their own identical copy of this list.
export const FOUNDATION_ORG_TYPES = ["foundation", "shelter", "rescue"] as const;
export type FoundationOrgType = (typeof FOUNDATION_ORG_TYPES)[number];

export function isFoundationOrgType(orgType: string): orgType is FoundationOrgType {
  return (FOUNDATION_ORG_TYPES as readonly string[]).includes(orgType);
}

// Defensive fallback to "foundation" for any org_type outside the known three — org_type is a
// Postgres enum today, but this function takes a plain string, so a future enum value must resolve
// to *some* valid foundation-style type rather than throwing or producing an invalid value.
export function toFoundationOrgType(orgType: string): FoundationOrgType {
  return isFoundationOrgType(orgType) ? orgType : "foundation";
}
