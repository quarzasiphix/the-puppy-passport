import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
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
import {
  approveRehomingReview,
  listRehomingReviews,
  rejectRehomingReview,
} from "@/lib/queries/rehoming";

export const Route = createFileRoute("/dashboard/admin/listings")({
  component: ListingsPage,
});

function ListingsPage() {
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const query = useQuery({ queryKey: ["admin-rehoming-reviews"], queryFn: listRehomingReviews });

  const approve = useMutation({
    mutationFn: ({
      id,
      animalId,
      ownerProfileId,
    }: {
      id: string;
      animalId: string;
      ownerProfileId: string;
    }) => approveRehomingReview(id, animalId, ownerProfileId),
    onSuccess: () => {
      toast.success("Approved — the listing is now public.");
      queryClient.invalidateQueries({ queryKey: ["admin-rehoming-reviews"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not approve."),
  });

  const reject = useMutation({
    mutationFn: ({
      id,
      reason,
      ownerProfileId,
    }: {
      id: string;
      reason: string;
      ownerProfileId: string;
    }) => rejectRehomingReview(id, reason, ownerProfileId),
    onSuccess: () => {
      toast.success("Submission rejected.");
      setRejectingId(null);
      setRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-rehoming-reviews"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not reject."),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Listings</h1>
        <p className="text-sm text-muted-foreground">
          Review private rehoming submissions before they go public. General moderation of published
          breeder/adoption listings is a later phase.
        </p>
      </header>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !query.data?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">No rehoming submissions yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {query.data.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-display text-lg font-semibold">
                    {r.animals?.name ?? "Unnamed dog"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {r.animals?.breeds?.name ?? "Mixed breed"} · submitted by{" "}
                    {r.profiles?.display_name ?? "Unknown"}
                    {r.profiles?.city && ` · ${r.profiles.city}, ${r.profiles.country}`} ·{" "}
                    {new Date(r.created_at).toLocaleDateString("en-GB")}
                  </div>
                  <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Reason: </span>
                    {r.reason_for_rehoming}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ownership declaration: {r.ownership_declaration ? "Confirmed" : "Not confirmed"}
                  </p>
                  {r.admin_notes && (
                    <p className="mt-1 text-xs text-destructive">Rejection note: {r.admin_notes}</p>
                  )}
                </div>
                <StatusBadge status={r.admin_status} />
              </div>
              {r.admin_status === "pending" && (
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      approve.mutate({
                        id: r.id,
                        animalId: r.animal_id,
                        ownerProfileId: r.owner_profile_id,
                      })
                    }
                    disabled={approve.isPending}
                  >
                    <CheckCircle2 className="mr-1 size-4" /> Approve
                  </Button>
                  <AlertDialog
                    open={rejectingId === r.id}
                    onOpenChange={(open) => setRejectingId(open ? r.id : null)}
                  >
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <XCircle className="mr-1 size-4" /> Reject
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reject this submission?</AlertDialogTitle>
                        <AlertDialogDescription>
                          The owner will see this reason. This action can't be undone from here.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <Textarea
                        placeholder="Reason for rejection…"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={3}
                      />
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setRejectReason("")}>
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            reject.mutate({
                              id: r.id,
                              reason: rejectReason,
                              ownerProfileId: r.owner_profile_id,
                            })
                          }
                          disabled={!rejectReason.trim() || reject.isPending}
                        >
                          Confirm rejection
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved")
    return (
      <Badge className="bg-success/15 text-success">
        <CheckCircle2 className="mr-1 size-3" /> Approved
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge className="bg-destructive/10 text-destructive">
        <XCircle className="mr-1 size-3" /> Rejected
      </Badge>
    );
  return (
    <Badge className="bg-accent/15 text-accent">
      <Clock className="mr-1 size-3" /> Pending
    </Badge>
  );
}
