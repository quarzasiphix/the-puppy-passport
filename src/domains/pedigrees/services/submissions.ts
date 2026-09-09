import { uploadPrivateFile } from "@/lib/storage/media";

import type {
  CreatePedigreeSubmissionInput,
  CreatePedigreeSubmissionResult,
  ManualAncestorEntry,
  PedigreeSubmission,
  PedigreeSubmissionMethod,
  PedigreeSubmissionResolution,
  PedigreeSubmissionStatus,
  ResolveSlotInput,
  SubmissionAncestorSlot,
} from "../types";
import { getPedigreeClient } from "./client";
import { searchDogs } from "./dogs";

export const PEDIGREE_SOURCES_BUCKET = "pedigree-sources";

type RawSubmissionRow = {
  id: string;
  submitted_by: string | null;
  contact_email: string | null;
  method: PedigreeSubmissionMethod;
  submitted_org_id: string | null;
  subject_dog_id: string | null;
  status: PedigreeSubmissionStatus;
  extraction_state: string;
  accepted_at: string | null;
  rejected_reason: string | null;
  created_at: string;
  updated_at: string;
};

function mapSubmission(r: RawSubmissionRow): PedigreeSubmission {
  return {
    id: r.id,
    submittedBy: r.submitted_by,
    contactEmail: r.contact_email,
    method: r.method,
    submittedOrgId: r.submitted_org_id,
    subjectDogId: r.subject_dog_id,
    status: r.status,
    extractionState: r.extraction_state,
    acceptedAt: r.accepted_at,
    rejectedReason: r.rejected_reason,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

type RawResolutionRow = {
  id: string;
  submission_id: string;
  slot_key: string;
  role: PedigreeSubmissionResolution["role"];
  resolved_dog_id: string | null;
  action: PedigreeSubmissionResolution["action"];
  created_at: string;
};

function mapResolution(r: RawResolutionRow): PedigreeSubmissionResolution {
  return {
    id: r.id,
    submissionId: r.submission_id,
    slotKey: r.slot_key,
    role: r.role,
    resolvedDogId: r.resolved_dog_id,
    action: r.action,
    createdAt: r.created_at,
  };
}

/**
 * Start an "Add pedigree" contribution. Works for an anonymous visitor (RLS + the
 * `create_pedigree_submission` SECURITY DEFINER RPC produce a `pending_review` row with
 * `submitted_by = null` — never a canonical write) and for a signed-in / breeder contributor.
 * The manual/transcribed ancestor entries are stashed on the source's `document_metadata` so the
 * review stage can render them without a separate table.
 */
export async function createPedigreeSubmission(
  input: CreatePedigreeSubmissionInput,
): Promise<CreatePedigreeSubmissionResult> {
  const supabase = getPedigreeClient();
  const manualPayload = {
    subject: input.subjectDraft ?? null,
    ancestors: input.manualEntries ?? [],
  };
  const { data, error } = await supabase.rpc("create_pedigree_submission", {
    p_method: input.method,
    p_source_type: input.sourceType,
    p_subject_dog_id: input.subjectDogId ?? null,
    p_contact_email: input.contactEmail ?? null,
    p_submitted_org_id: input.submittedOrgId ?? null,
    p_manual_payload: manualPayload,
  });
  if (error) throw error;
  const row = data as unknown as { submission_id: string; source_id: string };
  return { submissionId: row.submission_id, sourceId: row.source_id };
}

/**
 * Upload the original document for a submission into the private `pedigree-sources` bucket
 * (path `{submissionId}/{filename}`, matching the storage RLS policy) and record its path on the
 * submission's paired source row via the `attach_pedigree_submission_document` RPC. The original
 * scan is never public — it is only ever retrieved through a short-lived signed URL for the
 * submitter or staff.
 */
export async function uploadPedigreeSourceDocument(
  submissionId: string,
  file: File,
): Promise<{ path: string }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "pedigree";
  const objectPath = `${submissionId}/${Date.now()}-${safeName}`;
  await uploadPrivateFile(PEDIGREE_SOURCES_BUCKET, objectPath, file);
  const supabase = getPedigreeClient();
  const { error } = await supabase.rpc("attach_pedigree_submission_document", {
    p_submission_id: submissionId,
    p_bucket: PEDIGREE_SOURCES_BUCKET,
    p_path: objectPath,
    p_mime: file.type || null,
  });
  if (error) throw error;
  return { path: objectPath };
}

export type KennelDogIdentity = {
  parentDogId: string;
  dogId: string | null;
  registeredName: string;
  sex: "male" | "female" | null;
  isActive: boolean;
};

/**
 * The breeder panel's "enter once, reused everywhere" list: every `parent_dogs` row for a kennel
 * with the permanent `dogs` identity id that part 1's trigger/backfill attached to it. `dogId` is
 * null only if the migration has not been applied yet (there is no trigger to create it).
 */
export async function listKennelDogIdentities(kennelId: string): Promise<KennelDogIdentity[]> {
  const supabase = getPedigreeClient();
  const { data, error } = await supabase
    .from("parent_dogs")
    .select("id, dog_id, registered_name, sex, is_active")
    .eq("kennel_id", kennelId)
    .order("registered_name");
  if (error) throw error;
  return (
    (data ?? []) as unknown as {
      id: string;
      dog_id: string | null;
      registered_name: string;
      sex: "male" | "female" | null;
      is_active: boolean;
    }[]
  ).map((r) => ({
    parentDogId: r.id,
    dogId: r.dog_id,
    registeredName: r.registered_name,
    sex: r.sex,
    isActive: r.is_active,
  }));
}

export async function listMySubmissions(): Promise<PedigreeSubmission[]> {
  const supabase = getPedigreeClient();
  const { data, error } = await supabase
    .from("pedigree_submissions")
    .select(
      "id, submitted_by, contact_email, method, submitted_org_id, subject_dog_id, status, " +
        "extraction_state, accepted_at, rejected_reason, created_at, updated_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as RawSubmissionRow[]).map(mapSubmission);
}

export async function getSubmission(id: string): Promise<PedigreeSubmission | null> {
  const supabase = getPedigreeClient();
  const { data, error } = await supabase
    .from("pedigree_submissions")
    .select(
      "id, submitted_by, contact_email, method, submitted_org_id, subject_dog_id, status, " +
        "extraction_state, accepted_at, rejected_reason, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapSubmission(data as unknown as RawSubmissionRow) : null;
}

export async function listSubmissionResolutions(
  submissionId: string,
): Promise<PedigreeSubmissionResolution[]> {
  const supabase = getPedigreeClient();
  const { data, error } = await supabase
    .from("pedigree_submission_resolutions")
    .select("id, submission_id, slot_key, role, resolved_dog_id, action, created_at")
    .eq("submission_id", submissionId);
  if (error) throw error;
  return ((data ?? []) as unknown as RawResolutionRow[]).map(mapResolution);
}

/**
 * The review/matching stage. Reads the manual ancestor entries stashed on the submission's
 * source, runs the reg-number-weighted matcher for each, and merges in any decision already
 * recorded. No `dog_match_candidates` rows are written here — that table is a staff-review audit
 * trail (see docs/PEDIGREE_GRAPH.md, moderation queue is deferred).
 */
export async function listSubmissionAncestorSlots(
  submissionId: string,
): Promise<SubmissionAncestorSlot[]> {
  const supabase = getPedigreeClient();
  const { data: sourceRow, error: sourceErr } = await supabase
    .from("pedigree_sources")
    .select("document_metadata")
    .eq("submission_id", submissionId)
    .maybeSingle();
  if (sourceErr) throw sourceErr;

  const meta = (sourceRow?.document_metadata ?? {}) as {
    ancestors?: ManualAncestorEntry[];
  };
  const entries = Array.isArray(meta.ancestors) ? meta.ancestors : [];
  const resolutions = await listSubmissionResolutions(submissionId);
  const byslot = new Map(resolutions.map((r) => [r.slotKey, r]));

  const slots: SubmissionAncestorSlot[] = [];
  for (const entry of entries) {
    const query = entry.pedigreeNumber?.trim() || entry.registeredName?.trim() || "";
    const candidates = query ? await searchDogs(query, 6) : [];
    slots.push({
      slotKey: entry.slotKey,
      role: entry.role,
      claimed: entry,
      candidates,
      resolution: byslot.get(entry.slotKey) ?? null,
    });
  }
  return slots;
}

export async function resolvePedigreeSlot(input: ResolveSlotInput): Promise<string | null> {
  const supabase = getPedigreeClient();
  const { data, error } = await supabase.rpc("resolve_pedigree_slot", {
    p_submission_id: input.submissionId,
    p_slot_key: input.slotKey,
    p_action: input.action,
    p_role: input.role ?? null,
    p_resolved_dog_id: input.resolvedDogId ?? null,
    p_new_dog: input.newDog ?? {},
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

/** Staff/admin only (enforced in the RPC). An ordinary contributor's submission stays
 * `pending_review` until a moderator runs this. */
export async function finalizePedigreeSubmission(submissionId: string): Promise<void> {
  const supabase = getPedigreeClient();
  const { error } = await supabase.rpc("finalize_pedigree_submission", {
    p_submission_id: submissionId,
  });
  if (error) throw error;
}

/**
 * Breeder-panel path: attach an (accepted) pedigree source — optionally with an already-uploaded
 * document — plus sire/dam edges to a dog the breeder's kennel already owns. This is the
 * "enter once, reused everywhere" flow for the authenticated breeder case; it does not go through
 * the submission → staff-review queue because ownership is verified in the RPC.
 */
export async function attachBreederPedigreeSource(input: {
  dogId: string;
  orgId: string;
  document?: File;
  sireDogId?: string | null;
  damDogId?: string | null;
  notes?: string | null;
}): Promise<string> {
  const supabase = getPedigreeClient();
  let documentBucket: string | null = null;
  let documentPath: string | null = null;
  let documentMime: string | null = null;
  if (input.document) {
    // Breeder document uploads reuse the kennel-scoped folder convention of the pedigree-sources
    // bucket keyed by the dog id (breeder owns the dog, so `{dogId}/…` is theirs).
    const safeName = input.document.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "pedigree";
    documentPath = `${input.dogId}/${Date.now()}-${safeName}`;
    await uploadPrivateFile(PEDIGREE_SOURCES_BUCKET, documentPath, input.document);
    documentBucket = PEDIGREE_SOURCES_BUCKET;
    documentMime = input.document.type || null;
  }
  const { data, error } = await supabase.rpc("attach_breeder_pedigree_source", {
    p_dog_id: input.dogId,
    p_org_id: input.orgId,
    p_document_bucket: documentBucket,
    p_document_path: documentPath,
    p_document_mime: documentMime,
    p_sire_dog_id: input.sireDogId ?? null,
    p_dam_dog_id: input.damDogId ?? null,
    p_notes: input.notes ?? null,
  });
  if (error) throw error;
  return data as string;
}
