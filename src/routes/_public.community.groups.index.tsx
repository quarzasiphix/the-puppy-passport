import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { joinGroup, leaveGroup, listGroups, listMyGroupIds } from "@/lib/queries/groups";

import { getFriendlyErrorMessage } from "@/lib/errors";
const GROUP_TYPE_LABELS: Record<string, string> = {
  breed: "Breed community",
  breeders: "Breeders",
  foundation_rescue: "Foundation & rescue",
  adoption: "Adoption",
  transport_route: "Transport route",
  exhibitions: "Exhibitions & events",
  species: "Species community",
};

export const Route = createFileRoute("/_public/community/groups/")({
  head: () => ({ meta: [{ title: "Groups — Havenpaw" }] }),
  component: GroupsPage,
});

function GroupsPage() {
  const { userId, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: listGroups });
  const myGroupIdsQuery = useQuery({
    queryKey: ["my-group-ids", userId],
    queryFn: () => listMyGroupIds(userId!),
    enabled: !!userId,
  });
  const myGroupIds = new Set(myGroupIdsQuery.data ?? []);

  const joinMutation = useMutation({
    mutationFn: (groupId: string) =>
      myGroupIds.has(groupId) ? leaveGroup(userId!, groupId) : joinGroup(userId!, groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-group-ids", userId] });
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not update group.")),
  });

  return (
    <div className="container-page max-w-3xl py-10">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">Community</p>
        <h1 className="mt-2 font-display text-3xl font-medium">Groups</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Practical, focused groups — breed communities, transport routes, foundations, exhibitions
          and more.
        </p>
      </header>

      {groupsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : groupsQuery.isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center">
          <p className="font-medium">Couldn't load groups</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Something went wrong — this isn't the same as there being no groups. Please try again.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => groupsQuery.refetch()}>
            Try again
          </Button>
        </div>
      ) : !groupsQuery.data?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">No groups exist yet — check back soon.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groupsQuery.data.map((group) => (
            <div key={group.id} className="rounded-2xl border border-border/70 bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link
                    to="/community/groups/$slug"
                    params={{ slug: group.slug }}
                    className="font-display text-lg font-semibold hover:underline"
                  >
                    {group.name}
                  </Link>
                  {group.group_type && (
                    <Badge variant="outline" className="ml-2 text-xs font-normal">
                      {GROUP_TYPE_LABELS[group.group_type] ?? group.group_type}
                    </Badge>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Link
                  to="/community/groups/$slug"
                  params={{ slug: group.slug }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  View group <ArrowRight className="size-3" />
                </Link>
                {isSignedIn && (
                  <Button
                    size="sm"
                    variant={myGroupIds.has(group.id) ? "outline" : "default"}
                    disabled={joinMutation.isPending}
                    onClick={() => joinMutation.mutate(group.id)}
                  >
                    <Users className="mr-1 size-3.5" />
                    {myGroupIds.has(group.id) ? "Joined" : "Join"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
