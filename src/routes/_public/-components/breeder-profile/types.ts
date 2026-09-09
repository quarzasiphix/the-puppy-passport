import type { Breeder as MockBreeder, Puppy, Litter } from "@/lib/mock-data";
import type { ParentDogInfo, ChampionEntry } from "@/domains/marketplace";
import type { OrganisationTrustClaimType, OrganisationTrustClaim } from "@/domains/trust";
import type { BreederStats } from "@/domains/breeders";
import type { PostSummary } from "@/domains/social";

// Shared view-model types for the @$handle.tsx breeder profile page and its co-located
// components under -components/breeder-profile/. Kept in one place so the route file and every
// split-out component agree on shape without re-deriving it from LoaderData each time.
export type Breeder = MockBreeder;
export type Stats = BreederStats;
export type TrustClaims = Record<OrganisationTrustClaimType, OrganisationTrustClaim>;
export type Puppies = Puppy[];
export type Litters = Litter[];
export type Parents = (ParentDogInfo & { sex: "male" | "female" })[];
export type Posts = PostSummary[];
export type Champions = ChampionEntry[];
