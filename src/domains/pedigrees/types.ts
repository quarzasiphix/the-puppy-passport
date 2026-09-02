// Pedigree domain — type contracts only. NOT backed by a database schema yet; see
// docs/DEFERRED_BACKEND.md. Shaped so the real tables/RLS can be added later without a frontend
// rewrite: a dog's permanent identity is separate from any listing, and every assertion about a
// dog (a relationship, a health test, a title) carries its own source and verification level
// rather than the whole dog record having one vague "verified" flag.

/**
 * A dog's permanent identity, independent of any marketplace listing. `public.animals` in the
 * current schema conflates this with listing state (`listing_category`, `is_published`) — a
 * future migration should give a dog an identity row that a listing merely references. This type
 * describes the target shape; `DogIdentityId` today maps 1:1 onto `animals.id` /
 * `parent_dogs.id` until that split happens.
 */
export type DogIdentityId = string;

export type PedigreeVerificationLevel =
  | "unverified"
  | "community_supported"
  | "document_supported"
  | "breeder_confirmed"
  | "registry_verified"
  | "disputed";

export type PedigreeAssertionSource =
  | "user_submission"
  | "breeder_confirmation"
  | "uploaded_pedigree"
  | "kennel_club_record"
  | "moderator_decision"
  | "system_import";

/** One relationship edge (sire or dam) in a pedigree graph. */
export type PedigreeRelationshipRole = "sire" | "dam";

export type PedigreeRelationship = {
  id: string;
  dogId: DogIdentityId;
  relatedDogId: DogIdentityId;
  role: PedigreeRelationshipRole;
  source: PedigreeAssertionSource;
  verificationLevel: PedigreeVerificationLevel;
  createdAt: string;
};

/**
 * A single claimed fact about a dog (a name, a colour, a title, a health-test result) with its
 * own provenance — the "per-field provenance" the product brief requires instead of one
 * document-level or dog-level verified boolean.
 */
export type PedigreeAssertion<TField extends string = string, TValue = unknown> = {
  id: string;
  dogId: DogIdentityId;
  field: TField;
  value: TValue;
  source: PedigreeAssertionSource;
  verificationLevel: PedigreeVerificationLevel;
  submittedBy: string | null;
  submittedAt: string;
  supersedesAssertionId: string | null;
};

/** A proposed correction awaiting review — never applied silently. */
export type PedigreeCorrectionProposal = {
  id: string;
  dogId: DogIdentityId;
  field: string;
  proposedValue: unknown;
  reason: string;
  proposedBy: string;
  proposedAt: string;
  status: "pending" | "accepted" | "rejected";
  reviewedBy: string | null;
  reviewedAt: string | null;
};

/** A candidate duplicate pairing surfaced for human (owner/moderator) review — never auto-merged. */
export type DogMatchCandidate = {
  id: string;
  dogAId: DogIdentityId;
  dogBId: DogIdentityId;
  matchedOn: Array<
    | "registered_name"
    | "kennel_prefix"
    | "registration_number"
    | "microchip"
    | "date_of_birth"
    | "sex"
    | "breed"
    | "sire"
    | "dam"
    | "breeder"
    | "country_or_registry"
  >;
  confidence: number; // 0..1, advisory only — never a threshold for automatic merging
  status: "pending_review" | "confirmed_duplicate" | "confirmed_distinct";
  reviewedBy: string | null;
  reviewedAt: string | null;
};
