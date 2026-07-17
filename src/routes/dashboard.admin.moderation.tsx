import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gavel, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  listModerationCases,
  updateModerationCase,
  type ModerationCaseRow,
} from "@/lib/queries/moderation";

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
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-moderation-cases"], queryFn: listModerationCases });
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const resolve = useMutation({
    mutationFn: ({
      id,
      status,
      decision,
    }: {
      id: string;
      status: "resolved" | "dismissed";
      decision: string;
    }) =>
      updateModerationCase(id, {
        status,
        decision,
        decision_explanation: notesById[id] || null,
        resolved_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      toast.success("Case updated.");
      queryClient.invalidateQueries({ queryKey: ["admin-moderation-cases"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update case."),
  });

  const investigate = useMutation({
    mutationFn: (id: string) => updateModerationCase(id, { status: "investigating" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-moderation-cases"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update case."),
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
