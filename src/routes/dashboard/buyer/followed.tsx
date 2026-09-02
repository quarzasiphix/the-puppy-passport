import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/domains/identity";
import { listFollowedBreeders, unfollowOrg } from "@/domains/marketplace";

import { getFriendlyErrorMessage } from "@/shared/lib/errors";
export const Route = createFileRoute("/dashboard/buyer/followed")({
  component: FollowedBreeders,
});

function FollowedBreeders() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["my-followed-breeders", userId],
    enabled: !!userId,
    queryFn: () => listFollowedBreeders(userId!),
  });

  const unfollowMutation = useMutation({
    mutationFn: (orgId: string) => unfollowOrg(userId!, orgId),
    onSuccess: () => {
      toast.success("Unfollowed.");
      queryClient.invalidateQueries({ queryKey: ["my-followed-breeders", userId] });
      queryClient.invalidateQueries({ queryKey: ["followed-org-ids", userId] });
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not update.")),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Followed breeders</h1>
        <p className="text-sm text-muted-foreground">
          You'll be notified when they publish new litters.
        </p>
      </header>
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !query.data?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <p className="font-medium">Not following any breeders yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Follow a kennel from its profile page to see their updates here.
          </p>
          <Link to="/breeders" className="mt-3 inline-block text-sm text-primary hover:underline">
            Browse verified breeders
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {query.data.map((b) => (
            <div key={b.id} className="overflow-hidden rounded-2xl border border-border/70 bg-card">
              <img src={b.cover} alt="" className="aspect-[16/9] w-full object-cover" />
              <div className="p-4">
                <div className="font-display text-lg font-semibold">{b.kennel}</div>
                <div className="text-sm text-muted-foreground">
                  {b.city}, {b.country}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/breeders/$slug" params={{ slug: b.slug }}>
                      View kennel
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={unfollowMutation.isPending}
                    onClick={() => unfollowMutation.mutate(b.id)}
                  >
                    Unfollow
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
