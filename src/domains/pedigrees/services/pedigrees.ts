// BACKEND: not wired. No pedigree tables exist yet (see docs/DEFERRED_BACKEND.md). These
// functions describe the intended service contract so UI can be built and typed against it ahead
// of the migration, but every one of them throws rather than pretending to succeed — never fake
// a pedigree submission, match, or verification result.

import type {
  DogIdentityId,
  DogMatchCandidate,
  PedigreeAssertion,
  PedigreeCorrectionProposal,
  PedigreeRelationship,
} from "../types";

function notWired(operation: string): never {
  throw new Error(
    `Pedigree ${operation} is not available yet — the pedigree data model has not been built. ` +
      "See docs/DEFERRED_BACKEND.md.",
  );
}

export async function getDogPedigree(
  _dogId: DogIdentityId,
): Promise<{ relationships: PedigreeRelationship[]; assertions: PedigreeAssertion[] }> {
  return notWired("lookup");
}

export async function submitPedigreeRelationship(
  _input: Omit<PedigreeRelationship, "id" | "createdAt" | "verificationLevel">,
): Promise<PedigreeRelationship> {
  return notWired("submission");
}

export async function proposeCorrection(
  _input: Omit<PedigreeCorrectionProposal, "id" | "status" | "reviewedBy" | "reviewedAt">,
): Promise<PedigreeCorrectionProposal> {
  return notWired("correction");
}

export async function findMatchCandidates(_dogId: DogIdentityId): Promise<DogMatchCandidate[]> {
  return notWired("duplicate matching");
}
