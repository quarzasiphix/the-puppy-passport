import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Download, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { Badge } from "@/shared/ui/badge";
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
} from "@/shared/ui/alert-dialog";
import { exportMyData, getMyDeletionRequest, requestAccountDeletion } from "../services/privacy";

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AccountPrivacyCard({ userId }: { userId: string }) {
  const [reason, setReason] = useState("");

  const deletionQuery = useQuery({
    queryKey: ["my-deletion-request", userId],
    queryFn: () => getMyDeletionRequest(userId),
  });

  const exportMutation = useMutation({
    mutationFn: () => exportMyData(userId),
    onSuccess: (data) => {
      downloadJson(data, `anemalo-my-data-${new Date().toISOString().slice(0, 10)}.json`);
      toast.success("Downloaded.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not export data."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => requestAccountDeletion(userId, reason || null),
    onSuccess: () => {
      toast.success("Deletion request submitted.");
      deletionQuery.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not submit request."),
  });

  const pendingRequest = deletionQuery.data?.status === "pending" ? deletionQuery.data : null;

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="size-4 text-muted-foreground" />
        <h2 className="font-display text-lg font-semibold">Your data & privacy</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        See the{" "}
        <Link to="/privacy" className="text-primary hover:underline">
          Privacy Policy
        </Link>{" "}
        for what we store and why.
      </p>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 p-3">
          <div>
            <div className="text-sm font-medium">Export your data</div>
            <div className="text-xs text-muted-foreground">
              Download a copy of your profile and activity as a file.
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
          >
            <Download className="mr-1 size-4" /> Export
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 p-3">
          <div>
            <div className="text-sm font-medium">Delete your account</div>
            <div className="text-xs text-muted-foreground">
              {pendingRequest
                ? "Your request is being processed."
                : "Submits a request for our team to permanently delete your account and data."}
            </div>
          </div>
          {pendingRequest ? (
            <Badge className="bg-accent/15 text-accent">
              <Clock className="mr-1 size-3" /> Pending
            </Badge>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-destructive">
                  <Trash2 className="mr-1 size-4" /> Request deletion
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Request account deletion?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This isn't instant — deleting your sign-in itself requires our team's action,
                    which we'll do as soon as we process your request. You'll lose access to any
                    active transport requests, so make sure those are resolved first.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea
                  placeholder="Reason (optional)…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                />
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                  >
                    Submit request
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}
