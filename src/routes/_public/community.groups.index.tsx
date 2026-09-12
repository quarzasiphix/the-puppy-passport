import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, ArrowRight } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { useAuth } from "@/domains/identity";
import { joinGroup, leaveGroup, listGroups, listMyGroupIds } from "@/domains/community";
import { useTranslation } from "@/shared/i18n";

import { getFriendlyErrorMessage } from "@/shared/lib/errors";
function groupTypeLabel(t: (key: string) => string, groupType: string): string {
  const map: Record<string, string> = {
    breed: t("communityGroups.groupTypes.breed"),
    breeders: t("communityGroups.groupTypes.breeders"),
    foundation_rescue: t("communityGroups.groupTypes.foundationRescue"),
    adoption: t("communityGroups.groupTypes.adoption"),
    transport_route: t("communityGroups.groupTypes.transportRoute"),
    exhibitions: t("communityGroups.groupTypes.exhibitions"),
    species: t("communityGroups.groupTypes.species"),
  };
  return map[groupType] ?? groupType;
}

export const Route = createFileRoute("/_public/community/groups/")({
  head: () => ({ meta: [{ title: "Groups — Anemalo" }] }),
  component: GroupsPage,
});

function GroupsPage() {
  const { userId, isSignedIn } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const posthog = usePostHog();

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
    onSuccess: (_data, groupId) => {
      posthog.capture("community_group_membership_changed", {
        action: myGroupIds.has(groupId) ? "left" : "joined",
      });
      queryClient.invalidateQueries({ queryKey: ["my-group-ids", userId] });
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("communityGroups.couldNotUpdateGroup"))),
  });

  return (
    <div className="container-page max-w-3xl py-10">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">
          {t("communityGroups.eyebrow")}
        </p>
        <h1 className="mt-2 font-display text-3xl font-medium">{t("communityGroups.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("communityGroups.subtitle")}</p>
      </header>

      {groupsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("communityGroups.loading")}</p>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          {groupsQuery.data?.map((group) => (
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
                      {groupTypeLabel(t, group.group_type)}
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
                  {t("communityGroups.viewGroup")} <ArrowRight className="size-3" />
                </Link>
                {isSignedIn && (
                  <Button
                    size="sm"
                    variant={myGroupIds.has(group.id) ? "outline" : "default"}
                    disabled={joinMutation.isPending}
                    onClick={() => joinMutation.mutate(group.id)}
                  >
                    <Users className="mr-1 size-3.5" />
                    {myGroupIds.has(group.id)
                      ? t("communityGroups.joined")
                      : t("communityGroups.join")}
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
