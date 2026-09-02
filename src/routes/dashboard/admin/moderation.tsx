import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gavel, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import {
  listModerationCases,
  updateModerationCase,
  claimModerationCase,
  notifyAffectedUserOfDecision,
  listAppealsForCase,
  reviewModerationAppeal,
  notifyAppellantOfAppealDecision,
  type ModerationCaseRow,
} from "@/domains/trust";
import { useAuth } from "@/domains/identity";

export const Route = createFileRoute("/dashboard/admin/moderation")({
  component: ModerationPage,
});

const statusStyles: Record<ModerationCaseRow["status"], string> = {
  open: "bg-accent/15 text-accent",
  investigating: "bg-warning/20 text-foreground",
  resolved: "bg-success/15 text-success",
  dismissed: "bg-muted text-muted-foreground",
};

function ModerationPage() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-moderation-cases"], queryFn: listModerationCases });
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [summaryById, setSummaryById] = useState<Record<string, string>>({});
  const [appealsOpenFor, setAppealsOpenFor] = useState<string | null>(null);

  const appealsQuery = useQuery({
    queryKey: ["case-appeals", appealsOpenFor],
    enabled: !!appealsOpenFor,
    queryFn: () => listAppealsForCase(appealsOpenFor!),
  });

  const resolve = useMutation({
    mutationFn: async ({
      id,
      status,
      decision,
    }: {
      id: string;
      status: "resolved" | "dismissed";
      decision: string;
    }) => {
      await updateModerationCase(id, {
        status,
        decision,
        decision_explanation: notesById[id] || null,
        public_decision_summary: summaryById[id] || null,
        resolved_at: new Date().toISOString(),
      });
      const affected = query.data?.find((c) => c.id === id)?.affected_profile_id;
      if (affected) await notifyAffectedUserOfDecision(id, affected);
    },
    onSuccess: () => {
      toast.success("Case updated.");
      queryClient.invalidateQueries({ queryKey: ["admin-moderation-cases"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update case."),
  });

  const investigate = useMutation({
    mutationFn: (id: string) => claimModerationCase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-moderation-cases"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not claim this case."),
  });

  const reviewAppeal = useMutation({
    mutationFn: async (input: {
      appealId: string;
      caseId: string;
      submittedBy: string;
      decision: "upheld" | "overturned";
    }) => {
      await reviewModerationAppeal({
        appealId: input.appealId,
        decision: input.decision,
        outcomeNotes:
          input.decision === "upheld"
            ? "After review, the original decision stands."
            : "After review, the original decision has been overturned.",
      });
      await notifyAppellantOfAppealDecision(
        input.appealId,
        input.caseId,
        input.submittedBy,
        input.decision,
      );
    },
    onSuccess: () => {
      toast.success("Appeal reviewed.");
      queryClient.invalidateQueries({ queryKey: ["case-appeals", appealsOpenFor] });
      queryClient.invalidateQueries({ queryKey: ["admin-moderation-cases"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not review appeal."),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Moderation</h1>
        <p className="text-sm text-muted-foreground">
          Open moderation cases, decisions and appeal status. Decision explanations are never shown
          publicly — only to the affected party and staff.
        </p>
      </header>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !query.data?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <Gavel className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No moderation cases yet — they're created by escalating a report from the Reports page.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {query.data.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {c.target_type.replace(/_/g, " ")}
                    </Badge>
                    <span className="font-medium capitalize">{c.case_type.replace(/_/g, " ")}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Opened {new Date(c.created_at).toLocaleDateString("en-GB")} · target id{" "}
                    <span className="font-mono">{c.target_id.slice(0, 8)}…</span>
                    {c.appeal_status !== "none" && (
                      <>
                        {" "}
                        · appeal:{" "}
                        <span className="capitalize">{c.appeal_status.replace(/_/g, " ")}</span>
                      </>
                    )}
                  </div>
                  {c.decision && (
                    <p className="mt-2 text-sm">
                      <span className="font-medium">Decision: </span>
                      {c.decision}
                    </p>
                  )}
                  {c.decision_explanation && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Internal note: {c.decision_explanation}
                    </p>
                  )}
                  {c.public_decision_summary && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sent to affected user: {c.public_decision_summary}
                    </p>
                  )}
                  {!c.affected_profile_id &&
                    c.target_type !== "user" &&
                    c.target_type !== "animal_listing" && (
                      <p className="mt-1 text-xs text-warning">
                        No affected user resolved automatically for this target type — the case
                        won't be visible to anyone until this is set directly on the row.
                      </p>
                    )}
                </div>
                <Badge className={statusStyles[c.status]}>{c.status}</Badge>
              </div>

              {(c.status === "open" || c.status === "investigating") && (
                <div className="mt-4 space-y-2">
                  {c.status === "open" && (
                    <Button size="sm" variant="outline" onClick={() => investigate.mutate(c.id)}>
                      Start investigating
                    </Button>
                  )}
                  <Textarea
                    rows={2}
                    placeholder="Decision notes (internal only)…"
                    value={notesById[c.id] ?? ""}
                    onChange={(e) => setNotesById({ ...notesById, [c.id]: e.target.value })}
                  />
                  <Textarea
                    rows={2}
                    placeholder="Explanation sent to the affected user (safe, never mentions the reporter)…"
                    value={summaryById[c.id] ?? ""}
                    onChange={(e) => setSummaryById({ ...summaryById, [c.id]: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        resolve.mutate({ id: c.id, status: "resolved", decision: "action_taken" })
                      }
                      disabled={resolve.isPending}
                    >
                      <CheckCircle2 className="mr-1 size-4" /> Resolve — action taken
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        resolve.mutate({ id: c.id, status: "dismissed", decision: "no_action" })
                      }
                      disabled={resolve.isPending}
                    >
                      <XCircle className="mr-1 size-4" /> Dismiss — no action
                    </Button>
                  </div>
                </div>
              )}

              {c.status === "resolved" && c.appeal_status !== "none" && (
                <div className="mt-4 border-t border-border/60 pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAppealsOpenFor(appealsOpenFor === c.id ? null : c.id)}
                  >
                    {appealsOpenFor === c.id ? "Hide appeal" : "View appeal"}
                  </Button>
                  {appealsOpenFor === c.id && (
                    <div className="mt-3 space-y-2">
                      {appealsQuery.data?.map((a) => (
                        <div key={a.id} className="rounded-lg border border-border/60 p-3 text-sm">
                          <p>{a.statement}</p>
                          {a.status === "submitted" || a.status === "under_review" ? (
                            c.assigned_moderator_id === userId ? (
                              <p className="mt-2 text-xs text-warning">
                                You made the original decision on this case — another moderator must
                                review this appeal.
                              </p>
                            ) : (
                              <div className="mt-2 flex gap-2">
                                <Button
                                  size="sm"
                                  disabled={reviewAppeal.isPending}
                                  onClick={() =>
                                    reviewAppeal.mutate({
                                      appealId: a.id,
                                      caseId: c.id,
                                      submittedBy: a.submitted_by,
                                      decision: "overturned",
                                    })
                                  }
                                >
                                  Overturn decision
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={reviewAppeal.isPending}
                                  onClick={() =>
                                    reviewAppeal.mutate({
                                      appealId: a.id,
                                      caseId: c.id,
                                      submittedBy: a.submitted_by,
                                      decision: "upheld",
                                    })
                                  }
                                >
                                  Uphold decision
                                </Button>
                              </div>
                            )
                          ) : (
                            <Badge variant="secondary" className="mt-2">
                              {a.status}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
