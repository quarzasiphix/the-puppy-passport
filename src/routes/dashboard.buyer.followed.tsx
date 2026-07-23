import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import {
  listFollowedBreeders,
  listFollowedFoundations,
  unfollowOrg,
} from "@/lib/queries/buyer-activity";
import { foundationOrgTypeLabel } from "@/components/cards";

import { getFriendlyErrorMessage } from "@/lib/errors";
export const Route = createFileRoute("/dashboard/buyer/followed")({
  component: FollowedOrganisations,
});

function FollowedOrganisations() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const breedersQuery = useQuery({
    queryKey: ["my-followed-breeders", userId],
    enabled: !!userId,
    queryFn: () => listFollowedBreeders(userId!),
  });
  const foundationsQuery = useQuery({
    queryKey: ["my-followed-foundations", userId],
    enabled: !!userId,
    queryFn: () => listFollowedFoundations(userId!),
  });

  const unfollowMutation = useMutation({
    mutationFn: (orgId: string) => unfollowOrg(userId!, orgId),
    onSuccess: () => {
      toast.success("Unfollowed.");
      queryClient.invalidateQueries({ queryKey: ["my-followed-breeders", userId] });
      queryClient.invalidateQueries({ queryKey: ["my-followed-foundations", userId] });
      queryClient.invalidateQueries({ queryKey: ["followed-org-ids", userId] });
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not update.")),
  });

  const isLoading = breedersQuery.isLoading || foundationsQuery.isLoading;
  const breeders = breedersQuery.data ?? [];
  const foundations = foundationsQuery.data ?? [];
  const isEmpty = !isLoading && breeders.length === 0 && foundations.length === 0;

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Followed profiles</h1>
        <p className="text-sm text-muted-foreground">
          You'll be notified when they publish new litters or adoption listings.
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : isEmpty ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <p className="font-medium">Not following anyone yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Follow a breeder or foundation from their profile page to see their updates here.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link to="/breeders" className="text-sm text-primary hover:underline">
              Browse verified breeders
            </Link>
            <Link to="/foundations" className="text-sm text-primary hover:underline">
              Browse foundations
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {breeders.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Breeders
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {breeders.map((b) => (
                  <OrgTile
                    key={b.id}
                    cover={b.cover}
                    name={b.kennel}
                    location={[b.city, b.country].filter(Boolean).join(", ")}
                    viewHref={{ to: "/breeders/$slug", params: { slug: b.slug } }}
                    onUnfollow={() => unfollowMutation.mutate(b.id)}
                    unfollowPending={unfollowMutation.isPending}
                  />
                ))}
              </div>
            </section>
          )}
          {foundations.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Foundations & rescues
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {foundations.map((f) => (
                  <OrgTile
                    key={f.id}
                    cover={f.cover}
                    name={f.name}
                    badge={foundationOrgTypeLabel[f.orgType]}
                    location={[f.city, f.country].filter(Boolean).join(", ")}
                    viewHref={{ to: "/foundations/$slug", params: { slug: f.slug } }}
                    onUnfollow={() => unfollowMutation.mutate(f.id)}
                    unfollowPending={unfollowMutation.isPending}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function OrgTile({
  cover,
  name,
  badge,
  location,
  viewHref,
  onUnfollow,
  unfollowPending,
}: {
  cover: string;
  name: string;
  badge?: string;
  location: string;
  viewHref: { to: "/breeders/$slug" | "/foundations/$slug"; params: { slug: string } };
  onUnfollow: () => void;
  unfollowPending: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <img src={cover} alt="" className="aspect-[16/9] w-full object-cover" />
      <div className="p-4">
        <div className="flex items-center gap-2">
          <div className="font-display text-lg font-semibold">{name}</div>
          {badge && (
            <Badge variant="secondary" className="text-xs font-normal">
              {badge}
            </Badge>
          )}
        </div>
        {location && <div className="text-sm text-muted-foreground">{location}</div>}
        <div className="mt-4 flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to={viewHref.to} params={viewHref.params}>
              View profile
            </Link>
          </Button>
          <Button size="sm" variant="ghost" disabled={unfollowPending} onClick={onUnfollow}>
            Unfollow
          </Button>
        </div>
      </div>
    </div>
  );
}
