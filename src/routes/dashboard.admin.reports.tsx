import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flag, Gavel, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  dismissReport,
  escalateReportToCase,
  listOpenCaseReportIds,
  listReports,
} from "@/lib/queries/moderation";

export const Route = createFileRoute("/dashboard/admin/reports")({
  component: ReportsPage,
});

const reasonLabels: Record<string, string> = {
  suspected_illegal_breeding: "Suspected illegal breeding",
  false_breeder_information: "False breeder information",
  stolen_animal: "Possibly stolen animal",
  missing_or_false_microchip: "Missing/false microchip",
  animal_welfare_concern: "Animal welfare concern",
  misleading_health_information: "Misleading health information",
  scam_or_payment_fraud: "Scam or payment fraud",
  duplicate_listing: "Duplicate listing",
  prohibited_content: "Prohibited content",
  other: "Other",
};

function ReportsPage() {
  const queryClient = useQueryClient();
  const reportsQuery = useQuery({ queryKey: ["admin-reports"], queryFn: listReports });
  const casedIdsQuery = useQuery({
    queryKey: ["admin-report-case-ids"],
    queryFn: listOpenCaseReportIds,
  });

  const escalate = useMutation({
    mutationFn: escalateReportToCase,
    onSuccess: () => {
      toast.success("Escalated to a moderation case.");
      queryClient.invalidateQueries({ queryKey: ["admin-report-case-ids"] });
      queryClient.invalidateQueries({ queryKey: ["admin-moderation-cases"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not escalate."),
  });

  const dismiss = useMutation({
    mutationFn: dismissReport,
    onSuccess: () => {
      toast.success("Report dismissed.");
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not dismiss."),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Reports</h1>
        <p className="text-sm text-muted-foreground">
          User-filed reports awaiting triage. Escalate anything that needs investigation into a
          moderation case, or dismiss reports that don't need action.
        </p>
      </header>

      {reportsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !reportsQuery.data?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <Flag className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No reports filed.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reportsQuery.data.map((r) => {
            const hasCase = casedIdsQuery.data?.has(r.id);
            return (
              <div key={r.id} className="rounded-2xl border border-border/70 bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {r.target_type.replace(/_/g, " ")}
                      </Badge>
                      <span className="font-medium">{reasonLabels[r.reason] ?? r.reason}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Filed by {r.profiles?.display_name ?? "Unknown"} ·{" "}
                      {new Date(r.created_at).toLocaleDateString("en-GB")} · target id{" "}
                      <span className="font-mono">{r.target_id.slice(0, 8)}…</span>
                    </div>
                    {r.description && (
                      <p className="mt-2 max-w-xl text-sm text-muted-foreground">{r.description}</p>
                    )}
                  </div>
                  {hasCase && <Badge className="bg-accent/15 text-accent">Case opened</Badge>}
                </div>
                {!hasCase && (
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => escalate.mutate({ id: r.id })}
                      disabled={escalate.isPending}
                    >
                      <Gavel className="mr-1 size-4" /> Open moderation case
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => dismiss.mutate(r.id)}
                      disabled={dismiss.isPending}
                    >
                      <Trash2 className="mr-1 size-4" /> Dismiss
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
