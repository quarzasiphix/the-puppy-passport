import { useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { getFriendlyErrorMessage } from "@/lib/errors";
import {
  getMyModerationCase,
  getMyAppealForCase,
  submitModerationAppeal,
} from "@/lib/queries/moderation";

export const Route = createFileRoute("/_public/moderation/$caseId")({
  component: MyModerationCasePage,
});

const statusStyles: Record<string, string> = {
  open: "bg-accent/15 text-accent",
  investigating: "bg-accent/15 text-accent",
  resolved: "bg-success/15 text-success",
  dismissed: "bg-muted text-muted-foreground",
};

const appealStatusLabels: Record<string, string> = {
  submitted: "Appeal submitted — awaiting review",
  under_review: "Appeal under review",
  upheld: "Appeal reviewed — original decision upheld",
  overturned: "Appeal reviewed — decision overturned",
};

function MyModerationCasePage() {
  const { caseId } = useParams({ from: "/_public/moderation/$caseId" });
  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const [statement, setStatement] = useState("");

  const caseQuery = useQuery({
    queryKey: ["my-moderation-case", caseId],
    enabled: isSignedIn,
    queryFn: () => getMyModerationCase(caseId),
  });
  const appealQuery = useQuery({
    queryKey: ["my-moderation-appeal", caseId],
    enabled: isSignedIn && !!caseQuery.data,
    queryFn: () => getMyAppealForCase(caseId),
  });

  const appealMutation = useMutation({
    mutationFn: () => submitModerationAppeal({ caseId, statement }),
    onSuccess: () => {
      toast.success("Your appeal has been submitted.");
      queryClient.invalidateQueries({ queryKey: ["my-moderation-appeal", caseId] });
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not submit your appeal.")),
  });

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-sm text-muted-foreground">Sign in to view this case.</p>
      </div>
    );
  }

  if (caseQuery.isLoading) {
    return <p className="mx-auto max-w-md p-8 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!caseQuery.data) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="font-display text-xl font-medium">Case not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This case doesn't exist, or doesn't concern your account.
        </p>
      </div>
    );
  }

  const c = caseQuery.data;
  const canAppeal =
    c.status === "resolved" &&
    c.appeal_status === "none" &&
    c.appeal_deadline &&
    new Date(c.appeal_deadline) > new Date();

  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="font-display text-2xl font-medium">Moderation decision</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Opened {new Date(c.created_at).toLocaleDateString("en-GB")}
      </p>

      <div className="mt-4 flex items-center gap-2">
        <Badge className={statusStyles[c.status] ?? ""}>{c.status.replace(/_/g, " ")}</Badge>
      </div>

      <div className="mt-4 rounded-xl border border-border/70 bg-card p-4">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Explanation
        </div>
        <p className="mt-1 text-sm">
          {c.public_decision_summary ||
            "No further explanation has been provided for this case yet."}
        </p>
      </div>

      {c.status === "resolved" && (
        <div className="mt-6">
          {appealQuery.data ? (
            <div className="rounded-xl border border-border/70 bg-card p-4">
              <div className="text-sm font-medium">
                {appealStatusLabels[appealQuery.data.status]}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{appealQuery.data.statement}</p>
              {appealQuery.data.outcome_notes && (
                <p className="mt-2 text-sm">
                  <span className="font-medium">Outcome: </span>
                  {appealQuery.data.outcome_notes}
                </p>
              )}
            </div>
          ) : canAppeal ? (
            <div>
              <h2 className="font-display text-lg font-semibold">Appeal this decision</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                You can appeal once. Explain why you believe this decision should be reviewed — this
                isn't a legal process, but a genuine second look by a different moderator.
              </p>
              <Textarea
                rows={5}
                className="mt-3"
                placeholder="Explain why you're appealing this decision…"
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
              />
              <Button
                className="mt-3"
                disabled={!statement || appealMutation.isPending}
                onClick={() => appealMutation.mutate()}
              >
                Submit appeal
              </Button>
            </div>
          ) : c.appeal_status === "none" ? (
            <p className="text-sm text-muted-foreground">
              The window to appeal this decision has closed.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
