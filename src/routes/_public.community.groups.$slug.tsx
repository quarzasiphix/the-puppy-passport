import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Truck, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ReportDialog } from "@/components/report-dialog";
import { useAuth } from "@/hooks/use-auth";
import { getFriendlyErrorMessage } from "@/lib/errors";
import {
  countGroupMembers,
  createGroupPost,
  getGroupBySlug,
  joinGroup,
  leaveGroup,
  listGroupPosts,
  listMyGroupIds,
} from "@/lib/queries/groups";
import { useTranslation } from "@/lib/i18n";
import { formatDate } from "@/lib/presentation/date";

export const Route = createFileRoute("/_public/community/groups/$slug")({
  loader: async ({ params }) => {
    const group = await getGroupBySlug(params.slug).catch(() => null);
    if (!group) throw notFound();
    const memberCount = await countGroupMembers(group.id);
    return { group, memberCount };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.group.name} — Havenpaw` : "Group — Havenpaw" }],
  }),
  component: GroupDetailPage,
});

function GroupDetailPage() {
  const { group, memberCount } = Route.useLoaderData();
  const { locale } = useTranslation();
  const { userId, isSignedIn } = useAuth();
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
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not update group.")),
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
      toast.success("Posted to the group.");
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not post.")),
  });

  const isTransportRouteGroup = group.group_type === "transport_route";

  return (
    <div className="container-page max-w-2xl py-10">
      <Link
        to="/community/groups"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> All groups
      </Link>

      <header className="rounded-2xl border border-border/70 bg-card p-6">
        <h1 className="font-display text-2xl font-semibold">{group.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="size-3.5" /> {memberCount} member{memberCount === 1 ? "" : "s"}
          </span>
          {isTransportRouteGroup && (
            <Button asChild size="sm" variant="outline">
              <Link to="/transport/request">
                <Truck className="mr-1 size-3.5" /> Request transport for this route
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
            {isMember ? "Leave group" : "Join group"}
          </Button>
        )}
      </header>

      {!isSignedIn ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
          Sign in and join to see and post updates in this group.
        </div>
      ) : !isMember ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
          Join this group to see and post updates.
        </div>
      ) : (
        <div className="mt-6">
          <div className="rounded-2xl border border-border/70 bg-card p-4">
            <Textarea
              rows={3}
              placeholder={
                isTransportRouteGroup
                  ? "e.g. Need to transport a dog from Łódź to Rotterdam around 18 August…"
                  : "Share something with this group…"
              }
              aria-label={
                isTransportRouteGroup ? "Describe your transport need" : "Post to this group"
              }
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              {isTransportRouteGroup && (
                <p className="text-xs text-muted-foreground">
                  Describing a transport need here? Use the button above to submit it as a real,
                  searchable transport request instead of leaving it as text.
                </p>
              )}
              <Button
                size="sm"
                className="ml-auto"
                disabled={!newPost.trim() || createPostMutation.isPending}
                onClick={() => createPostMutation.mutate()}
              >
                Post
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {postsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : postsQuery.isError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                <p className="font-medium">Couldn't load posts</p>
                <p className="mt-1 text-muted-foreground">
                  Something went wrong — this isn't the same as there being no posts yet.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => postsQuery.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : !postsQuery.data?.length ? (
              <p className="text-sm text-muted-foreground">No posts yet in this group.</p>
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
                          {post.profiles?.display_name ?? "Member"}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium">Member</span>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {formatDate(post.created_at, locale, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm">{post.content}</p>
                  <div className="mt-3 flex justify-end">
                    <ReportDialog targetType="post" targetId={post.id} triggerLabel="Report" />
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
