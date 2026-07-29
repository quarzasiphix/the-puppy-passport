import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Award, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export const Route = createFileRoute("/dashboard/admin/achievement-verification")({
  component: AchievementVerificationPage,
});

type PendingAchievement = {
  id: string;
  title: string;
  issuing_body: string | null;
  achieved_on: string | null;
  evidence_url: string | null;
  verification_status: string;
  created_at: string;
  parent_dogs: { registered_name: string } | null;
  organisations: { name: string } | null;
};

async function listAllAchievements() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("achievements")
    .select(
      "id, title, issuing_body, achieved_on, evidence_url, verification_status, created_at, parent_dogs(registered_name), organisations!achievements_kennel_id_fkey(name)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PendingAchievement[];
}

function AchievementVerificationPage() {
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const query = useQuery({ queryKey: ["admin-achievements"], queryFn: listAllAchievements });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("achievements")
        .update({ verification_status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Approved — now visible on the kennel's public page.");
      queryClient.invalidateQueries({ queryKey: ["admin-achievements"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not approve."),
  });

  const reject = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("achievements")
        .update({
          verification_status: "rejected",
          admin_notes: reason,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rejected.");
      setRejectingId(null);
      setRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-achievements"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not reject."),
  });

  const pending = (query.data ?? []).filter((a) => a.verification_status === "pending");
  const decided = (query.data ?? []).filter((a) => a.verification_status !== "pending");

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Achievement verification</h1>
        <p className="text-sm text-muted-foreground">
          Review uploaded evidence for breeder-claimed titles and diplomas.
        </p>
      </header>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : pending.length === 0 ? (
        <div className="mb-6 rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <Award className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Nothing awaiting review.</p>
        </div>
      ) : (
        <div className="mb-8 space-y-3">
          {pending.map((a) => (
            <div key={a.id} className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {a.title}{" "}
                    <span className="text-sm text-muted-foreground">
                      — {a.parent_dogs?.registered_name ?? "?"} · {a.organisations?.name ?? "?"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[
                      a.issuing_body,
                      a.achieved_on && new Date(a.achieved_on).toLocaleDateString("en-GB"),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {a.evidence_url && (
                    <a
                      href={a.evidence_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View evidence <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
                <Badge className="bg-accent/15 text-accent">Pending</Badge>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => approve.mutate(a.id)} disabled={approve.isPending}>
                  <CheckCircle2 className="mr-1 size-4" /> Approve
                </Button>
                <AlertDialog
                  open={rejectingId === a.id}
                  onOpenChange={(open) => setRejectingId(open ? a.id : null)}
                >
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <XCircle className="mr-1 size-4" /> Reject
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reject this achievement?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The breeder will see this reason.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Textarea
                      aria-label="Rejection reason"
                      placeholder="Reason — e.g. evidence unclear, request clearer photo…"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                    />
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setRejectReason("")}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => reject.mutate({ id: a.id, reason: rejectReason })}
                        disabled={!rejectReason.trim() || reject.isPending}
                      >
                        Confirm rejection
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <div>
          <h2 className="mb-3 font-display text-lg font-semibold">Reviewed</h2>
          <div className="space-y-2">
            {decided.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3 text-sm"
              >
                <span>
                  {a.title} — {a.parent_dogs?.registered_name ?? "?"} ·{" "}
                  {a.organisations?.name ?? "?"}
                </span>
                <Badge
                  className={
                    a.verification_status === "approved"
                      ? "bg-success/15 text-success"
                      : "bg-destructive/10 text-destructive"
                  }
                >
                  {a.verification_status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
