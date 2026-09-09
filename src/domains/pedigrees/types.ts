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

// ─────────────────────────────────────────────────────────────────────────────────────────────
// View-model types for the applied pedigree-graph schema
// (supabase/migrations/20260910000100_pedigree_graph_schema.sql + ..._200_pedigree_graph_rpcs.sql).
//
// The generated src/lib/supabase/types.ts does NOT contain these tables yet — the migration is
// written but not applied to the live project, so types cannot be regenerated this pass. Per the
// repo convention for shapes the generated types don't cover, the service layer queries with the
// browser client cast loose and maps rows onto the hand-written types below. Every enum here is a
// verbatim copy of the Postgres enum the migration declares — keep them in lock-step.
// ─────────────────────────────────────────────────────────────────────────────────────────────

export type DogSex = "male" | "female";

export type DogLifeStatus = "unknown" | "alive" | "deceased";

export type PedigreeParentRole = "sire" | "dam";

/** `public.pedigree_source_type` — the upload-format + evidence-kind enum on `pedigree_sources`. */
export type PedigreeSourceType =
  | "uploaded_scan"
  | "uploaded_pdf"
  | "uploaded_photo"
  | "registry_record"
  | "breeder_declaration"
  | "owner_declaration"
  | "community_contribution"
  | "dna_evidence"
  | "association_import"
  | "system_import";

export type PedigreeSourceReviewState = "pending" | "accepted" | "rejected";

export type PedigreeSubmissionMethod = "upload" | "manual_entry" | "build_from_existing";

export type PedigreeSubmissionStatus = "pending_review" | "accepted" | "rejected";

export type DogParentRelationshipStatus = "active" | "disputed" | "rejected";

export type DogClaimType = "owner" | "breeder";

export type DogClaimStatus = "pending" | "approved" | "rejected";

/** A permanent dog identity — the public projection (`public.public_dogs` view). Safe columns
 * only: never `created_by`, `current_owner_profile_id`, `is_public`, `created_via`. */
export type DogIdentity = {
  id: string;
  registeredName: string;
  callName: string | null;
  sex: DogSex | null;
  breedId: string | null;
  breedName: string | null;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
  lifeStatus: DogLifeStatus;
  color: string | null;
  pedigreeNumber: string | null;
  microchipNumber: string | null;
  countryOfOrigin: string | null;
  kennelName: string | null;
  kennelId: string | null;
  kennelSlug: string | null;
  description: string | null;
  profileImageUrl: string | null;
  titles: string | null;
  healthTests: unknown[];
  slug: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * The precise, non-overclaiming evidence indicators shown on a dog page. Each flag is only true
 * when evidence that actually exists supports it — there is no blanket "verified" state.
 */
export type DogEvidenceSummary = {
  /** At least one accepted source with an uploaded document (`uploaded_*`) exists for this dog. */
  hasPedigreeDocument: boolean;
  /** At least one parent edge is backed by an accepted source (verification_level beyond
   * `unverified`/`community_supported`). */
  parentRelationshipSupportedBySource: boolean;
  /** A `registry_record` source from a `kennel_club` org backs at least one parent edge. */
  registryVerified: boolean;
  /** A `dna_evidence` source exists and is accepted. */
  dnaVerified: boolean;
  /** Any parent edge is currently in `disputed` status. */
  hasDisputedRelationship: boolean;
};

/** One sire/dam edge (`dog_parent_relationships` / `public_dog_parent_relationships`). */
export type ParentRelationship = {
  id: string;
  childDogId: string;
  parentDogId: string;
  role: PedigreeParentRole;
  verificationLevel: PedigreeVerificationLevel;
  status: DogParentRelationshipStatus;
  createdAt: string;
};

/**
 * A node in an ancestor tree, N generations deep. `dog` is null for an unfilled slot ("Unknown").
 * `sire` / `dam` are undefined past the requested depth, null when that ancestor slot is empty.
 * Multiple competing sources per edge are represented by `edgeVerificationLevel` +
 * `edgeStatus` ('disputed' when sources disagree) — Anemalo, unlike POK, does not assume one
 * canonical parent per role.
 */
export type AncestorNode = {
  slotKey: string; // "" root, then a dot path of "sire"/"dam" segments
  role: PedigreeParentRole | null; // null only for the root
  dog: DogIdentity | null;
  edgeId: string | null;
  edgeVerificationLevel: PedigreeVerificationLevel | null;
  edgeStatus: DogParentRelationshipStatus | null;
  sire?: AncestorNode | null;
  dam?: AncestorNode | null;
};

export type PedigreeSource = {
  id: string;
  submissionId: string | null;
  sourceType: PedigreeSourceType;
  submittedBy: string | null;
  contactEmail: string | null;
  organisationId: string | null;
  submittedAt: string;
  documentBucket: string | null;
  documentPath: string | null;
  documentMimeType: string | null;
  reviewState: PedigreeSourceReviewState;
  notes: string | null;
  createdAt: string;
};

export type PedigreeSubmission = {
  id: string;
  submittedBy: string | null;
  contactEmail: string | null;
  method: PedigreeSubmissionMethod;
  submittedOrgId: string | null;
  subjectDogId: string | null;
  status: PedigreeSubmissionStatus;
  extractionState: string;
  acceptedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PedigreeSubmissionSlotAction = "use_existing" | "create_new" | "skip";

export type PedigreeSubmissionResolution = {
  id: string;
  submissionId: string;
  slotKey: string;
  role: PedigreeParentRole | null;
  resolvedDogId: string | null;
  action: PedigreeSubmissionSlotAction;
  createdAt: string;
};

/** One row in the review/matching stage: a slot to be decided, with the ancestor's claimed
 * details and any existing dogs that might already be it. */
export type SubmissionAncestorSlot = {
  slotKey: string;
  role: PedigreeParentRole | null;
  claimed: ManualAncestorEntry;
  candidates: DogSearchResult[];
  resolution: PedigreeSubmissionResolution | null;
};

export type DogSearchResult = {
  id: string;
  registeredName: string;
  callName: string | null;
  sex: DogSex | null;
  breedId: string | null;
  dateOfBirth: string | null;
  pedigreeNumber: string | null;
  microchipNumber: string | null;
  kennelName: string | null;
  kennelId: string | null;
  profileImageUrl: string | null;
  slug: string | null;
  /** Advisory score from `search_dogs_ranked` — an exact registration-/chip-number hit is
   * weighted far above a fuzzy name match. Never a threshold for an automatic merge. */
  matchRank: number;
  matchedOn: Array<"pedigree_number" | "microchip" | "registered_name">;
};

export type DogClaim = {
  id: string;
  dogId: string;
  claimantProfileId: string;
  claimType: DogClaimType;
  organisationId: string | null;
  message: string | null;
  status: DogClaimStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

/** A single manually-typed ancestor (upload transcription / "enter manually" path). */
export type ManualAncestorEntry = {
  slotKey: string;
  role: PedigreeParentRole | null;
  registeredName: string;
  callName?: string;
  sex?: DogSex;
  pedigreeNumber?: string;
  color?: string;
  countryOfOrigin?: string;
  dateOfBirth?: string;
};

export type CreatePedigreeSubmissionInput = {
  method: PedigreeSubmissionMethod;
  sourceType: PedigreeSourceType;
  subjectDogId?: string | null;
  contactEmail?: string | null;
  submittedOrgId?: string | null;
  /** Manual/transcribed ancestor entries stashed on the source's `document_metadata`. */
  manualEntries?: ManualAncestorEntry[];
  subjectDraft?: Omit<ManualAncestorEntry, "slotKey" | "role">;
};

export type CreatePedigreeSubmissionResult = {
  submissionId: string;
  sourceId: string;
};

export type ResolveSlotInput = {
  submissionId: string;
  slotKey: string;
  role?: PedigreeParentRole | null;
  action: PedigreeSubmissionSlotAction;
  resolvedDogId?: string | null;
  newDog?: {
    registered_name: string;
    call_name?: string;
    sex?: DogSex;
    pedigree_number?: string;
    color?: string;
    country_of_origin?: string;
    date_of_birth?: string;
  };
};
