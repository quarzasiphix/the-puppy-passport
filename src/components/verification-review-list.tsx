import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
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

type VerificationRow = {
  id: string;
  user_id: string;
  status: string;
  submitted_data: Record<string, unknown> | null;
  created_at: string;
};

// Shared by the breeder-verification and foundation-verification admin pages — same table, same
// review actions, different verification_type filter.
export function VerificationReviewList({
  verificationType,
  emptyLabel,
}: {
  verificationType: "breeder" | "organisation";
  emptyLabel: string;
}) {
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const query = useQuery({
    queryKey: ["admin-verifications", verificationType],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("user_verifications")
        .select("id, user_id, status, submitted_data, created_at")
        .eq("verification_type", verificationType)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as VerificationRow[];
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("approve_user_verification", { p_verification_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Approved — the organisation is now live.");
      queryClient.invalidateQueries({ queryKey: ["admin-verifications", verificationType] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not approve."),
  });

  const reject = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("user_verifications")
        .update({ status: "rejected", notes: reason })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application rejected.");
      setRejectingId(null);
      setRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-verifications", verificationType] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not reject."),
  });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (query.isError)
    return <p className="text-sm text-destructive">Could not load applications.</p>;
  if (!query.data?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {query.data.map((v) => {
        const data = (v.submitted_data ?? {}) as Record<string, unknown>;
        return (
          <div key={v.id} className="rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-display text-lg font-semibold">
                  {(data.name as string) ?? "Untitled"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {(data.city as string) ?? ""}
                  {data.city && data.country ? ", " : ""}
                  {(data.country as string) ?? ""} · Submitted{" "}
                  {new Date(v.created_at).toLocaleDateString("en-GB")}
                </div>
                {typeof data.description === "string" && (
                  <p className="mt-2 max-w-xl text-sm text-muted-foreground">{data.description}</p>
                )}
              </div>
              <StatusBadge status={v.status} />
            </div>
            {v.status === "pending" && (
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => approve.mutate(v.id)} disabled={approve.isPending}>
                  <CheckCircle2 className="mr-1 size-4" /> Approve
                </Button>
                <AlertDialog
                  open={rejectingId === v.id}
                  onOpenChange={(open) => setRejectingId(open ? v.id : null)}
                >
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <XCircle className="mr-1 size-4" /> Reject
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reject this application?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The applicant will see this reason. This action can't be undone from here.
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
                        onClick={() => reject.mutate({ id: v.id, reason: rejectReason })}
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
        );
      })}
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
