import type { DogClaim, DogClaimType } from "../types";
import { getPedigreeClient } from "./client";

type RawClaimRow = {
  id: string;
  dog_id: string;
  claimant_profile_id: string;
  claim_type: DogClaimType;
  organisation_id: string | null;
  message: string | null;
  status: DogClaim["status"];
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

function mapClaim(r: RawClaimRow): DogClaim {
  return {
    id: r.id,
    dogId: r.dog_id,
    claimantProfileId: r.claimant_profile_id,
    claimType: r.claim_type,
    organisationId: r.organisation_id,
    message: r.message,
    status: r.status,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    createdAt: r.created_at,
  };
}

/**
 * "Is this your dog / kennel." A direct insert (RLS: `claimant_profile_id = auth.uid()` and
 * `status = 'pending'`) — claiming never grants edit rights over verified pedigree history by
 * itself; a moderator reviews claims separately (see docs/PEDIGREE_GRAPH.md — owner, breeder,
 * record contributor and source authority are kept as separate concepts).
 */
export async function createDogClaim(input: {
  dogId: string;
  claimantProfileId: string;
  claimType: DogClaimType;
  organisationId?: string | null;
  message?: string | null;
}): Promise<DogClaim> {
  const supabase = getPedigreeClient();
  const { data, error } = await supabase
    .from("dog_claims")
    .insert({
      dog_id: input.dogId,
      claimant_profile_id: input.claimantProfileId,
      claim_type: input.claimType,
      organisation_id: input.organisationId ?? null,
      message: input.message ?? null,
      status: "pending",
    })
    .select(
      "id, dog_id, claimant_profile_id, claim_type, organisation_id, message, status, " +
        "reviewed_by, reviewed_at, created_at",
    )
    .single();
  if (error) throw error;
  return mapClaim(data as unknown as RawClaimRow);
}

export async function listMyDogClaims(): Promise<DogClaim[]> {
  const supabase = getPedigreeClient();
  const { data, error } = await supabase
    .from("dog_claims")
    .select(
      "id, dog_id, claimant_profile_id, claim_type, organisation_id, message, status, " +
        "reviewed_by, reviewed_at, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as RawClaimRow[]).map(mapClaim);
}
