import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { countFollowers } from "@/domains/social";

// Public breeder-profile statistics — every number here is a real, derived count, never a
// fabricated or placeholder value (see the profile redesign brief: "don't fabricate these if the
// data isn't available yet"). A kennel with no history yet just gets honest zeros.

export type BreederStats = {
  availablePuppies: number;
  plannedLitters: number;
  previousLitters: number;
  puppiesPlaced: number; // "alumni" — sold/adopted
  breedingDogs: number;
  completedHandovers: number; // completed reservations
  followerCount: number;
  identityVerified: boolean;
  kennelVerified: boolean;
};

export async function getBreederStats(
  organisationId: string,
  kennelVerified: boolean,
): Promise<BreederStats> {
  const supabase = getSupabaseBrowserClient();

  const [
    availablePuppiesRes,
    plannedLittersRes,
    previousLittersRes,
    puppiesPlacedRes,
    breedingDogsRes,
    completedHandoversRes,
    followerCount,
    identityRes,
  ] = await Promise.all([
    supabase
      .from("animals")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organisationId)
      .eq("listing_category", "breeder_puppy")
      .eq("is_published", true)
      .in("availability_status", ["available", "applications_open"]),
    supabase
      .from("litters")
      .select("id", { count: "exact", head: true })
      .eq("kennel_id", organisationId)
      .eq("status", "planned"),
    supabase
      .from("litters")
      .select("id", { count: "exact", head: true })
      .eq("kennel_id", organisationId)
      .eq("status", "completed"),
    supabase
      .from("animals")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organisationId)
      .eq("listing_category", "breeder_puppy")
      .in("availability_status", ["sold", "adopted"]),
    supabase
      .from("parent_dogs")
      .select("id", { count: "exact", head: true })
      .eq("kennel_id", organisationId)
      .eq("is_active", true),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organisationId)
      .eq("status", "completed"),
    countFollowers({ type: "organisation", id: organisationId }),
    supabase
      .from("public_kennel_owner_identity_verification")
      .select("identity_verified")
      .eq("organisation_id", organisationId)
      .maybeSingle(),
  ]);

  return {
    availablePuppies: availablePuppiesRes.count ?? 0,
    plannedLitters: plannedLittersRes.count ?? 0,
    previousLitters: previousLittersRes.count ?? 0,
    puppiesPlaced: puppiesPlacedRes.count ?? 0,
    breedingDogs: breedingDogsRes.count ?? 0,
    completedHandovers: completedHandoversRes.count ?? 0,
    followerCount,
    identityVerified: identityRes.data?.identity_verified ?? false,
    kennelVerified,
  };
}
