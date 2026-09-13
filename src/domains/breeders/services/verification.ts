// My own organisation's verification record — same query shape as create-breeder.tsx's inline
// version, extracted here so the Settings page (which needs to let the breeder attach evidence
// after the fact, not just see status) can reuse it instead of duplicating the query.
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  uploadPrivateFile,
  getSignedFileUrl,
  sanitizeFilenameForStoragePath,
} from "@/lib/storage/media";

const VERIFICATION_EVIDENCE_BUCKET = "verification-evidence";

export type MyOrgVerification = {
  id: string;
  verification_type: string;
  status: string;
  submitted_data: Record<string, unknown> | null;
  evidence_url: string | null;
  notes: string | null;
  created_at: string;
};

export async function getMyOrgVerification(userId: string): Promise<MyOrgVerification | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("user_verifications")
    .select("id, verification_type, status, submitted_data, evidence_url, notes, created_at")
    .eq("user_id", userId)
    .in("verification_type", ["breeder", "organisation"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  // submitted_data is `Json` at the DB layer (a union that includes string/number/etc, not just
  // object) — every real row here is always a jsonb object (see create-breeder.tsx's own insert),
  // so this narrows to the shape this file actually works with rather than widening
  // MyOrgVerification.submitted_data back to `Json` for every caller.
  return data as MyOrgVerification | null;
}

/** Uploads a verification document (WNI, kennel-club registration proof, etc.) to the private
 * verification-evidence bucket under this user's own folder, then records its storage path via
 * submit_verification_evidence() — see supabase/migrations/20260913130000_verification_evidence_upload.sql
 * for why this is an RPC rather than a direct table update (evidence_url is not otherwise
 * user-editable once a verification is past 'not_started'). */
export async function uploadVerificationEvidence(
  userId: string,
  verificationId: string,
  file: File,
): Promise<void> {
  const path = `${userId}/${Date.now()}-${sanitizeFilenameForStoragePath(file.name)}`;
  await uploadPrivateFile(VERIFICATION_EVIDENCE_BUCKET, path, file);
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("submit_verification_evidence", {
    p_verification_id: verificationId,
    p_evidence_path: path,
  });
  if (error) throw error;
}

/** A short-lived signed URL to view/download the currently-attached evidence file — never
 * persisted, generated on demand right before opening it. */
export async function getVerificationEvidenceUrl(evidencePath: string): Promise<string> {
  return getSignedFileUrl(VERIFICATION_EVIDENCE_BUCKET, evidencePath);
}
