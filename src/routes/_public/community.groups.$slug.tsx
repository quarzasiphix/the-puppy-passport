import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Truck, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { ReportDialog } from "@/domains/trust";
import { useAuth } from "@/domains/identity";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import {
  countGroupMembers,
  createGroupPost,
  getGroupBySlug,
  joinGroup,
  leaveGroup,
  listGroupPosts,
  listMyGroupIds,
} from "@/domains/community";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/_public/community/groups/$slug")({
  loader: async ({ params }) => {
    const group = await getGroupBySlug(params.slug).catch(() => null);
    if (!group) throw notFound();
    const memberCount = await countGroupMembers(group.id);
    return { group, memberCount };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.group.name} — Anemalo` : "Group — Anemalo" }],
  }),
  component: GroupDetailPage,
});

function GroupDetailPage() {
  const { group, memberCount } = Route.useLoaderData();
  const { userId, isSignedIn } = useAuth();
  const { t, locale } = useTranslation();
  const queryClient = useQueryClient();
  const [newPost, setNewPost] = useState("");

  const myGroupIdsQuery = useQuery({
    queryKey: ["my-group-ids", userId],
    queryFn: () => listMyGroupIds(userId!),
    enabled: !!userId,
  });
  const isMember = !!myGroupIdsQuery.data?.includes(group.id);

  const membershipMutation = useMutation({
    mutationFn: () => (isMember ? leaveGroup(userId!, group.id) : joinGroup(userId!, group.id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-group-ids", userId] });
      queryClient.invalidateQueries({ queryKey: ["group-posts", group.id] });
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("communityGroups.couldNotUpdateGroup"))),
  });

  // Group-scoped posts are only selectable by members (see 20260101005400_groups.sql) — this is
  // deliberate, not a bug: join to see and take part, not an open public preview.
  const postsQuery = useQuery({
    queryKey: ["group-posts", group.id],
    queryFn: () => listGroupPosts(group.id),
    enabled: isMember,
  });

  const createPostMutation = useMutation({
    mutationFn: () =>
      createGroupPost({ authorProfileId: userId!, groupId: group.id, content: newPost.trim() }),
    onSuccess: () => {
      setNewPost("");
      queryClient.invalidateQueries({ queryKey: ["group-posts", group.id] });
      toast.success(t("communityGroupDetail.postedToGroupToast"));
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, t("communityPage.couldNotPost"))),
  });

  const isTransportRouteGroup = group.group_type === "transport_route";

  return (
    <div className="container-page max-w-2xl py-10">
      <Link
        to="/community/groups"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> {t("communityGroupDetail.allGroups")}
      </Link>

      <header className="rounded-2xl border border-border/70 bg-card p-6">
        <h1 className="font-display text-2xl font-semibold">{group.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="size-3.5" /> {t("communityGroupDetail.memberCountLabel")}:{" "}
            {memberCount}
          </span>
          {isTransportRouteGroup && (
            <Button asChild size="sm" variant="outline">
              <Link to="/transport/request">
                <Truck className="mr-1 size-3.5" />{" "}
                {t("communityGroupDetail.requestTransportForRoute")}
              </Link>
            </Button>
          )}
        </div>
        {isSignedIn && (
          <Button
            className="mt-4"
            variant={isMember ? "outline" : "default"}
            disabled={membershipMutation.isPending}
            onClick={() => membershipMutation.mutate()}
          >
            {isMember
              ? t("communityGroupDetail.leaveGroup")
              : t("communityGroupDetail.joinGroup")}
          </Button>
        )}
      </header>

      {!isSignedIn ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
          {t("communityGroupDetail.signInToJoin")}
        </div>
      ) : !isMember ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
          {t("communityGroupDetail.joinToSee")}
        </div>
      ) : (
        <div className="mt-6">
          <div className="rounded-2xl border border-border/70 bg-card p-4">
            <Textarea
              rows={3}
              placeholder={
                isTransportRouteGroup
                  ? t("communityGroupDetail.transportPlaceholder")
                  : t("communityGroupDetail.sharePlaceholder")
              }
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              {isTransportRouteGroup && (
                <p className="text-xs text-muted-foreground">
                  {t("communityGroupDetail.transportHint")}
                </p>
              )}
              <Button
                size="sm"
                className="ml-auto"
                disabled={!newPost.trim() || createPostMutation.isPending}
                onClick={() => createPostMutation.mutate()}
              >
                {t("communityPage.post")}
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {postsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">{t("communityGroups.loading")}</p>
            ) : !postsQuery.data?.length ? (
              <p className="text-sm text-muted-foreground">
                {t("communityGroupDetail.noPosts")}
              </p>
            ) : (
              postsQuery.data.map((post) => (
                <article key={post.id} className="rounded-2xl border border-border/70 bg-card p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarImage src={post.profiles?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {(post.profiles?.display_name ?? "?").charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      {post.author_profile_id ? (
                        <Link
                          to="/profile/$profileId"
                          params={{ profileId: post.author_profile_id }}
                          className="text-sm font-medium hover:underline"
                        >
                          {post.profiles?.display_name ?? t("communityGroupDetail.member")}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium">
                          {t("communityGroupDetail.member")}
                        </span>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {new Date(post.created_at).toLocaleDateString(
                          locale === "pl" ? "pl-PL" : "en-GB",
                          { day: "numeric", month: "short", year: "numeric" },
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm">{post.content}</p>
                  <div className="mt-3 flex justify-end">
                    <ReportDialog
                      targetType="post"
                      targetId={post.id}
                      triggerLabel={t("communityGroupDetail.report")}
                    />
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
