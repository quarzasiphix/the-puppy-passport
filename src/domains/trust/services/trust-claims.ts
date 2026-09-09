import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// Explicit, separately-explainable breeder trust claims — never one vague "Verified" badge (see
// supabase/migrations/20260909001000_breeder_trust_claims.sql). "Identity verified" and "Kennel
// verified" are NOT part of this table — they're read from user_verifications and
// organisations.verification_status respectively (see getIdentityVerified in
// domains/breeders/services/breeder-stats.ts) — this file only covers the three claims with no
// existing home: association, pedigrees, health_documents.

export type OrganisationTrustClaimType = "association" | "pedigrees" | "health_documents";
export type OrganisationTrustClaimStatus = "unverified" | "pending" | "verified" | "rejected";

export type OrganisationTrustClaim = {
  claimType: OrganisationTrustClaimType;
  status: OrganisationTrustClaimStatus;
  verifiedAt: string | null;
};

const ALL_CLAIM_TYPES: OrganisationTrustClaimType[] = ["association", "pedigrees", "health_documents"];

// Translated via the i18n `t()` function rather than a static Record, since the label is shown on
// a public breeder profile page — see src/shared/i18n/index.tsx. Pass `useTranslation().t`.
export function trustClaimLabel(
  t: (key: string) => string,
  type: OrganisationTrustClaimType,
): string {
  const map: Record<OrganisationTrustClaimType, string> = {
    association: t("trustClaims.association"),
    pedigrees: t("trustClaims.pedigrees"),
    health_documents: t("trustClaims.healthDocuments"),
  };
  return map[type];
}

export function trustClaimExplanation(
  t: (key: string) => string,
  type: OrganisationTrustClaimType,
): string {
  const map: Record<OrganisationTrustClaimType, string> = {
    association: t("trustClaims.associationExplanation"),
    pedigrees: t("trustClaims.pedigreesExplanation"),
    health_documents: t("trustClaims.healthDocumentsExplanation"),
  };
  return map[type];
}

/** Public read — only ever 'verified' or 'pending' rows come back (see the view's own definition);
 * a claim type with no row is simply unverified/not yet submitted, not an error. */
export async function getPublicTrustClaims(
  organisationId: string,
): Promise<OrganisationTrustClaim[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("public_organisation_trust_claims")
    .select("claim_type, status, verified_at")
    .eq("organisation_id", organisationId);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    claimType: r.claim_type as OrganisationTrustClaimType,
    status: r.status as OrganisationTrustClaimStatus,
    verifiedAt: r.verified_at,
  }));
}

/** Full status per claim type for display, defaulting every claim not yet submitted to
 * 'unverified' — a kennel with zero rows still gets an honest "not yet verified" answer for all
 * three, not a missing/undefined badge. */
export async function getTrustClaimMap(
  organisationId: string,
): Promise<Record<OrganisationTrustClaimType, OrganisationTrustClaim>> {
  const claims = await getPublicTrustClaims(organisationId);
  const map = Object.fromEntries(
    ALL_CLAIM_TYPES.map((type) => [
      type,
      { claimType: type, status: "unverified" as const, verifiedAt: null },
    ]),
  ) as Record<OrganisationTrustClaimType, OrganisationTrustClaim>;
  for (const claim of claims) map[claim.claimType] = claim;
  return map;
}
