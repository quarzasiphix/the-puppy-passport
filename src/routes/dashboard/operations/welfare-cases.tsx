import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import {
  acknowledgeWelfareCase,
  listOpsWelfareCases,
  reviewWelfareCase,
  welfareCaseStatusLabels,
} from "@/domains/transport";

export const Route = createFileRoute("/dashboard/operations/welfare-cases")({
  component: OpsWelfareCasesPage,
});

const urgencyStyles: Record<string, string> = {
  routine: "bg-muted text-muted-foreground",
  urgent: "bg-warning/20 text-foreground",
  critical: "bg-destructive/10 text-destructive",
};

function OpsWelfareCasesPage() {
  const queryClient = useQueryClient();
  const [notesByCase, setNotesByCase] = useState<Record<string, string>>({});

  const casesQuery = useQuery({ queryKey: ["ops-welfare-cases"], queryFn: listOpsWelfareCases });

  const acknowledgeMutation = useMutation({
    mutationFn: (caseId: string) => acknowledgeWelfareCase(caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ops-welfare-cases"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not acknowledge."),
  });

  const reviewMutation = useMutation({
    mutationFn: (input: {
      caseId: string;
      decision: "accepted_for_assessment" | "declined" | "information_required";
    }) =>
      reviewWelfareCase({
        caseId: input.caseId,
        decision: input.decision,
        reviewNotes: notesByCase[input.caseId],
      }),
    onSuccess: () => {
      toast.success("Case reviewed.");
      queryClient.invalidateQueries({ queryKey: ["ops-welfare-cases"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not review."),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-medium">Welfare cases</h1>
        <p className="text-sm text-muted-foreground">
          Urgent welfare/rescue cases reported by verified foundations, shelters and rescues.
          Urgency alone never grants transport priority, bypasses review, or confirms capacity —
          every case still goes through acknowledgement and assessment here.
        </p>
      </header>

      <div className="space-y-3">
        {casesQuery.data?.map((c) => (
          <div key={c.id} className="rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg font-semibold">
                    {c.animal_name || c.case_number}
                  </span>
                  <Badge className={urgencyStyles[c.urgency]}>
                    {c.urgency === "critical" && <AlertTriangle className="mr-1 size-3" />}
                    {c.urgency}
                  </Badge>
                  {!c.ops_acknowledged && <Badge variant="outline">Not yet acknowledged</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {c.organisations?.name ?? "Unknown organisation"} · {c.reason}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.location_city ?? c.location_country ?? "?"} →{" "}
                  {c.destination_city ?? c.destination_country ?? "?"}
                  {c.deadline && ` · Deadline ${new Date(c.deadline).toLocaleDateString("en-GB")}`}
                </p>
              </div>
              <Badge variant="secondary">{welfareCaseStatusLabels[c.status]}</Badge>
            </div>

            {!c.ops_acknowledged && (
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={acknowledgeMutation.isPending}
                  onClick={() => acknowledgeMutation.mutate(c.id)}
                >
                  Acknowledge
                </Button>
              </div>
            )}

            {(c.status === "submitted" ||
              c.status === "under_review" ||
              c.status === "information_required") && (
              <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                <Textarea
                  rows={2}
                  placeholder="Internal review notes (never shown to the organisation)"
                  value={notesByCase[c.id] ?? ""}
                  onChange={(e) => setNotesByCase({ ...notesByCase, [c.id]: e.target.value })}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={reviewMutation.isPending}
                    onClick={() =>
                      reviewMutation.mutate({ caseId: c.id, decision: "accepted_for_assessment" })
                    }
                  >
                    Accept for assessment
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={reviewMutation.isPending}
                    onClick={() =>
                      reviewMutation.mutate({ caseId: c.id, decision: "information_required" })
                    }
                  >
                    Request more information
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={reviewMutation.isPending}
                    onClick={() => reviewMutation.mutate({ caseId: c.id, decision: "declined" })}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {casesQuery.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No welfare cases reported yet.</p>
        )}
      </div>
    </div>
  );
}
