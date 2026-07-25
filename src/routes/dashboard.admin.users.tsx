import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Construction, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  getAccountDeletionBlockers,
  listDeletionRequests,
  markDeletionRequestProcessed,
} from "@/lib/queries/privacy";

export const Route = createFileRoute("/dashboard/admin/users")({
  component: UsersPage,
});

const statusStyles: Record<string, string> = {
  pending: "bg-accent/15 text-accent",
  processed: "bg-success/15 text-success",
  declined: "bg-destructive/10 text-destructive",
};

function UsersPage() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-deletion-requests"], queryFn: listDeletionRequests });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "processed" | "declined" }) =>
      markDeletionRequestProcessed(id, status, userId!),
    onSuccess: () => {
      toast.success("Updated.");
      queryClient.invalidateQueries({ queryKey: ["admin-deletion-requests"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update."),
  });

  const pending = (query.data ?? []).filter((r) => r.status === "pending");

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Users</h1>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg font-semibold">
          Account deletion requests ({pending.length} pending)
        </h2>
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !query.data?.length ? (
          <p className="text-sm text-muted-foreground">No deletion requests.</p>
        ) : (
          <div className="space-y-2">
            {query.data.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4"
              >
                <div>
                  <div className="font-medium">{r.profiles?.display_name ?? "Unknown user"}</div>
                  <div className="text-xs text-muted-foreground">
                    Requested {new Date(r.requested_at).toLocaleDateString("en-GB")}
                  </div>
                  {r.reason && <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>}
                  {r.status === "pending" && <DeletionBlockers profileId={r.profile_id} />}
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusStyles[r.status]}>{r.status}</Badge>
                  {r.status === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ id: r.id, status: "processed" })}
                    >
                      <Trash2 className="mr-1 size-3.5" /> Mark deleted
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          "Mark deleted" anonymises the account (name, email, phone, avatar, city/country are
          cleared; the row itself stays so past transport/order history and audit records remain
          intact). It's blocked if the account still has an active transport request, reservation,
          application, or organisation ownership that hasn't been transferred yet. The Supabase auth
          identity itself (sign-in credentials) is not removed by this action and still needs
          Supabase Studio or the admin API, since that requires the service-role key, which this app
          never has access to from the browser.
        </p>
      </section>

      <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
        <Construction className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">Full user directory not implemented in this phase</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Browse and manage all platform accounts and their roles. Admin role can never be
          self-assigned by a user.
        </p>
      </div>
    </div>
  );
}

// Stage CJI: shows every real blocker that currently applies to this profile, not just the first
// one a failed "Mark deleted" attempt would report -- lets the admin see the whole picture upfront.
function DeletionBlockers({ profileId }: { profileId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["deletion-blockers", profileId],
    queryFn: () => getAccountDeletionBlockers(profileId),
  });

  if (isLoading || !data?.length) return null;

  return <p className="mt-1 text-xs text-destructive">Blocked by: {data.join(", ")}</p>;
}
