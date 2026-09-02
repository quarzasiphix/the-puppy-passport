import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { notifyUserFromTemplate } from "@/domains/messaging";

export type ReportTargetType = "animal_listing" | "organisation" | "post" | "message" | "user";
export type ReportReason =
  | "suspected_illegal_breeding"
  | "false_breeder_information"
  | "stolen_animal"
  | "missing_or_false_microchip"
  | "animal_welfare_concern"
  | "misleading_health_information"
  | "scam_or_payment_fraud"
  | "duplicate_listing"
  | "prohibited_content"
  | "other";

export async function submitReport(payload: {
  reporterProfileId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description: string | null;
}) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("reports").insert({
    reporter_profile_id: payload.reporterProfileId,
    target_type: payload.targetType,
    target_id: payload.targetId,
    reason: payload.reason,
    description: payload.description,
  });
  if (error) throw error;
}

export type ReportRow = {
  id: string;
  reporter_profile_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  evidence_url: string | null;
  description: string | null;
  created_at: string;
  profiles: { display_name: string | null } | null;
};

// Only 'open' (untriaged) reports -- dismissed/escalated reports are kept (Stage CJG: soft
// dismissal, not a hard delete) but deliberately excluded from the active queue, matching the
// admin's original observable experience (a dismissed report used to just vanish from this list).
export async function listReports() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, reporter_profile_id, target_type, target_id, reason, evidence_url, description, created_at, profiles!reports_reporter_profile_id_fkey(display_name)",
    )
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ReportRow[];
}

// A report with no linked moderation_cases row yet is "untriaged" — the admin either dismisses it
// outright or escalates it into a real case for investigation.
export async function listOpenCaseReportIds() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("moderation_cases").select("report_id");
  if (error) throw error;
  return new Set((data ?? []).map((c) => c.report_id).filter((id): id is string => !!id));
}

// Soft dismissal (Stage CJG) -- never a hard delete. A permanently-deleted report can never
// contribute to detecting a real abuse pattern (e.g. one reporter filing many reports that all get
// dismissed), the exact "repeated reports" signal risk_signals.multiple_independent_reports
// (Stage BN) was left unwired for.
export async function dismissReport(reportId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("reports")
    .update({ status: "dismissed" })
    .eq("id", reportId);
  if (error) throw error;
}

export async function escalateReportToCase(report: { id: string }) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("escalate_report_to_case", { p_report_id: report.id });
  if (error) throw error;
}

export type ModerationCaseRow = {
  id: string;
  report_id: string | null;
  case_type: string;
  target_type: ReportTargetType;
  target_id: string;
  status: "open" | "investigating" | "resolved" | "dismissed";
  assigned_moderator_id: string | null;
  decision: string | null;
  decision_explanation: string | null;
  appeal_status: "none" | "requested" | "reviewed";
  affected_profile_id: string | null;
  public_decision_summary: string | null;
  appeal_deadline: string | null;
  created_at: string;
  resolved_at: string | null;
};

export async function listModerationCases() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("moderation_cases")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ModerationCaseRow[];
}

export async function updateModerationCase(
  id: string,
  payload: Partial<
    Pick<
      ModerationCaseRow,
      | "status"
      | "decision"
      | "decision_explanation"
      | "resolved_at"
      | "affected_profile_id"
      | "public_decision_summary"
      | "assigned_moderator_id"
    >
  >,
) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("moderation_cases").update(payload).eq("id", id);
  if (error) throw error;
}

// The plain update above used to also be how a moderator "claimed" a case (setting
// assigned_moderator_id + status = 'investigating' as a client-side UPDATE) -- a real race (two
// moderators claiming the same case at once) and a forgeable actor (assigned_moderator_id was
// just whatever id the client sent). claim_moderation_case() does both atomically with a
// server-stamped auth.uid() actor, and gives a clear error if someone else already has it.
export async function claimModerationCase(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("claim_moderation_case", { p_case_id: id });
  if (error) throw error;
}

// Notifies the affected user once a case resolves, with a link to the safe case view — the only
// current discovery path for `_public.moderation.$caseId.tsx`, matching how transport-conversation
// links already work elsewhere in this codebase (direct link, not a separate list page yet).
export async function notifyAffectedUserOfDecision(caseId: string, affectedProfileId: string) {
  await notifyUserFromTemplate({
    profileId: affectedProfileId,
    templateId: "moderation_decision",
    dedupKey: `moderation_case:${caseId}:decision`,
    payload: { caseId },
  });
}

// --- Affected user's own view + appeal ---------------------------------------------------------
export type MyModerationCaseRow = {
  id: string;
  case_type: string;
  target_type: ReportTargetType;
  status: "open" | "investigating" | "resolved" | "dismissed";
  public_decision_summary: string | null;
  appeal_status: "none" | "requested" | "reviewed";
  appeal_deadline: string | null;
  created_at: string;
  resolved_at: string | null;
};

export async function getMyModerationCase(caseId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("my_moderation_case_view")
    .select("*")
    .eq("id", caseId)
    .maybeSingle();
  if (error) throw error;
  return data as MyModerationCaseRow | null;
}

export type ModerationAppealRow = {
  id: string;
  moderation_case_id: string;
  submitted_by: string;
  statement: string;
  supporting_document_url: string | null;
  status: "submitted" | "under_review" | "upheld" | "overturned";
  outcome_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export async function getMyAppealForCase(caseId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("moderation_appeals")
    .select(
      "id, moderation_case_id, submitted_by, statement, supporting_document_url, status, outcome_notes, created_at, reviewed_at",
    )
    .eq("moderation_case_id", caseId)
    .maybeSingle();
  if (error) throw error;
  return data as ModerationAppealRow | null;
}

export async function submitModerationAppeal(input: {
  caseId: string;
  statement: string;
  supportingDocumentUrl?: string | null;
}): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("submit_moderation_appeal", {
    p_case_id: input.caseId,
    p_statement: input.statement,
    p_supporting_document_url: input.supportingDocumentUrl ?? undefined,
  });
  if (error) throw error;
  return data as string;
}

// --- Moderator side ------------------------------------------------------------------------
export async function listAppealsForCase(caseId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("moderation_appeals")
    .select("*")
    .eq("moderation_case_id", caseId);
  if (error) throw error;
  return (data ?? []) as (ModerationAppealRow & { internal_notes: string | null })[];
}

export async function reviewModerationAppeal(input: {
  appealId: string;
  decision: "upheld" | "overturned";
  outcomeNotes?: string;
  internalNotes?: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("review_moderation_appeal", {
    p_appeal_id: input.appealId,
    p_decision: input.decision,
    p_outcome_notes: input.outcomeNotes || undefined,
    p_internal_notes: input.internalNotes || undefined,
  });
  if (error) throw error;
}

// review_moderation_appeal() itself never notifies (same "the client makes a second call after
// the write succeeds" shape as notifyAffectedUserOfDecision above) -- found missing entirely:
// an appellant previously had no way to learn their appeal was resolved short of revisiting their
// case page. dedupKey is scoped to the appeal, not the case, since a case can have at most one
// appeal (moderation_appeals.moderation_case_id is unique) but this keeps the key's meaning
// self-evident without relying on that constraint.
export async function notifyAppellantOfAppealDecision(
  appealId: string,
  caseId: string,
  appellantProfileId: string,
  decision: "upheld" | "overturned",
) {
  await notifyUserFromTemplate({
    profileId: appellantProfileId,
    templateId: "moderation_appeal_decision",
    dedupKey: `moderation_appeal:${appealId}:decision`,
    payload: { caseId, decision },
  });
}
