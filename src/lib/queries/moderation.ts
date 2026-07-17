import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

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

export async function listReports() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, reporter_profile_id, target_type, target_id, reason, evidence_url, description, created_at, profiles!reports_reporter_profile_id_fkey(display_name)",
    )
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

export async function dismissReport(reportId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("reports").delete().eq("id", reportId);
  if (error) throw error;
}

export async function escalateReportToCase(report: {
  id: string;
  target_type: ReportTargetType;
  target_id: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("moderation_cases").insert({
    report_id: report.id,
    case_type: "report_escalation",
    target_type: report.target_type,
    target_id: report.target_id,
    status: "open",
  });
  if (error) throw error;
}

export type ModerationCaseRow = {
  id: string;
  report_id: string | null;
  case_type: string;
  target_type: ReportTargetType;
  target_id: string;
  status: "open" | "investigating" | "resolved" | "dismissed";
  decision: string | null;
  decision_explanation: string | null;
  appeal_status: "none" | "requested" | "reviewed";
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
    Pick<ModerationCaseRow, "status" | "decision" | "decision_explanation" | "resolved_at">
  >,
) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("moderation_cases").update(payload).eq("id", id);
  if (error) throw error;
}
