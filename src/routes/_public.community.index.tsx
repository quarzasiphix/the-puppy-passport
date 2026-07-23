import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Heart, MessageCircle, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ReportDialog } from "@/components/report-dialog";
import { useAuth } from "@/hooks/use-auth";
import {
  createComment,
  createPost,
  listComments,
  listCommentCounts,
  listMyReactedPostIds,
  listPublicPosts,
  listReactionCounts,
  toggleLike,
  type PostRow,
} from "@/lib/queries/community";
import { listFollowedOrgIds } from "@/lib/queries/buyer-activity";
import { listFollowedProfileIds } from "@/lib/queries/profile";
import { useTranslation, type Locale } from "@/lib/i18n";
import { orgProfileRoute } from "@/lib/org-routing";

// Intl locale tags for date formatting — kept separate from the app's bare "en"/"pl" locale codes
// so date order/punctuation matches each language's convention (UK day-month-year vs Polish).
const DATE_LOCALE: Record<Locale, string> = { en: "en-GB", pl: "pl-PL" };

import { getFriendlyErrorMessage } from "@/lib/errors";
// Plain-language labels for post_type — real content-type separation (docs/PRODUCT_VISION.md
// hierarchy pillar 3), not a generic feed. No linked-content preview (animal/transport/route) yet
// — seed data has no posts using those fields, and building an unverified preview against private-
// adjacent tables (transport_requests) wasn't worth the risk this pass; see
// docs/IMPLEMENTATION_PLAN.md phase 12.
const POST_TYPE_LABELS: Record<string, string> = {
  general: "General",
  transport_update: "Transport update",
  route_announcement: "Planned route",
  litter_announcement: "Litter announcement",
  adoption_post: "Adoption",
  achievement: "Achievement",
};

export const Route = createFileRoute("/_public/community/")({
  head: () => ({ meta: [{ title: "Community — Havenpaw" }] }),
  component: CommunityPage,
});

function authorName(p: PostRow) {
  return p.organisations?.name ?? p.profiles?.display_name ?? "Havenpaw member";
}

function CommunityPage() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [newPost, setNewPost] = useState("");

  const postsQuery = useQuery({ queryKey: ["public-posts"], queryFn: listPublicPosts });
  const posts = postsQuery.data ?? [];
  const postIds = posts.map((p) => p.id);

  const reactionCountsQuery = useQuery({
    queryKey: ["post-reaction-counts", postIds],
    queryFn: () => listReactionCounts(postIds),
    enabled: postIds.length > 0,
  });
  const commentCountsQuery = useQuery({
    queryKey: ["post-comment-counts", postIds],
    queryFn: () => listCommentCounts(postIds),
    enabled: postIds.length > 0,
  });
  const myReactionsQuery = useQuery({
    queryKey: ["my-post-reactions", userId, postIds],
    queryFn: () => listMyReactedPostIds(userId!, postIds),
    enabled: !!userId && postIds.length > 0,
  });

  // A real, honest first pass at "recommendations should consider followed profiles" (see
  // docs/PRODUCT_VISION.md pillar 3) — posts from people/kennels you follow surface first, clearly
  // labelled as such, rather than a fake engagement-optimised ranking. Location/interests/saved-
  // searches/joined-groups signals are explicitly not built yet (see docs/IMPLEMENTATION_PLAN.md
  // phase 12) — no schema or settings UI exists for them.
  const followedProfileIdsQuery = useQuery({
    queryKey: ["followed-profile-ids", userId],
    queryFn: () => listFollowedProfileIds(userId!),
    enabled: !!userId,
  });
  const followedOrgIdsQuery = useQuery({
    queryKey: ["followed-org-ids", userId],
    queryFn: () => listFollowedOrgIds(userId!),
    enabled: !!userId,
  });
  const followedProfileIds = new Set(followedProfileIdsQuery.data ?? []);
  const followedOrgIds = new Set(followedOrgIdsQuery.data ?? []);
  const isFromFollowed = (p: PostRow) =>
    (!!p.author_profile_id && followedProfileIds.has(p.author_profile_id)) ||
    (!!p.author_organization_id && followedOrgIds.has(p.author_organization_id));
  const followedPosts = posts.filter(isFromFollowed);
  const otherPosts = posts.filter((p) => !isFromFollowed(p));

  const createPostMutation = useMutation({
    mutationFn: () => createPost({ authorProfileId: userId!, content: newPost.trim() }),
    onSuccess: () => {
      setNewPost("");
      queryClient.invalidateQueries({ queryKey: ["public-posts"] });
      toast.success("Posted.");
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not post.")),
  });

  return (
    <div className="container-page max-w-2xl py-10">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">Community</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-medium">Community</h1>
          <Link to="/community/groups" className="text-sm font-medium text-primary hover:underline">
            Browse groups →
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Updates, questions and stories from breeders, foundations and fellow dog people.
        </p>
      </header>

      {userId ? (
        <div className="mb-6 rounded-2xl border border-border/70 bg-card p-4">
          <Textarea
            rows={3}
            placeholder="Share something with the community…"
            aria-label="Share something with the community"
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
          />
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              disabled={!newPost.trim() || createPostMutation.isPending}
              onClick={() => createPostMutation.mutate()}
            >
              Post
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-4 text-center text-sm text-muted-foreground">
          Sign in to post, like and comment.
        </div>
      )}

      {postsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : postsQuery.isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center">
          <p className="font-medium">Couldn't load the community feed</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Something went wrong — this isn't the same as there being no posts yet.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => postsQuery.refetch()}>
            Try again
          </Button>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <Users className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No posts yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Be the first to share something with the community.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {followedPosts.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-accent">
                From people and kennels you follow
              </h2>
              <div className="space-y-4">
                {followedPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    likeCount={reactionCountsQuery.data?.get(post.id) ?? 0}
                    commentCount={commentCountsQuery.data?.get(post.id) ?? 0}
                    liked={myReactionsQuery.data?.has(post.id) ?? false}
                    userId={userId}
                  />
                ))}
              </div>
            </div>
          )}
          <div>
            {followedPosts.length > 0 && (
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                More from the community
              </h2>
            )}
            <div className="space-y-4">
              {otherPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  likeCount={reactionCountsQuery.data?.get(post.id) ?? 0}
                  commentCount={commentCountsQuery.data?.get(post.id) ?? 0}
                  liked={myReactionsQuery.data?.has(post.id) ?? false}
                  userId={userId}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PostCard({
  post,
  likeCount,
  commentCount,
  liked,
  userId,
}: {
  post: PostRow;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  userId: string | null | undefined;
}) {
  const queryClient = useQueryClient();
  const { locale } = useTranslation();
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");

  const commentsQuery = useQuery({
    queryKey: ["post-comments", post.id],
    queryFn: () => listComments(post.id),
    enabled: showComments,
  });

  const likeMutation = useMutation({
    mutationFn: () => toggleLike(post.id, userId!, liked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post-reaction-counts"] });
      queryClient.invalidateQueries({ queryKey: ["my-post-reactions"] });
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not update.")),
  });

  const commentMutation = useMutation({
    mutationFn: () => createComment(post.id, userId!, newComment.trim()),
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["post-comments", post.id] });
      queryClient.invalidateQueries({ queryKey: ["post-comment-counts"] });
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not comment.")),
  });

  return (
    <article className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarImage
            src={post.organisations?.logo_url ?? post.profiles?.avatar_url ?? undefined}
          />
          <AvatarFallback>{authorName(post).charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2 font-medium">
            {post.author_organization_id && post.organisations ? (
              <Link
                to={orgProfileRoute(post.organisations.org_type)}
                params={{ slug: post.organisations.slug }}
                className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {authorName(post)}
              </Link>
            ) : post.author_profile_id ? (
              <Link
                to="/profile/$profileId"
                params={{ profileId: post.author_profile_id }}
                className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {authorName(post)}
              </Link>
            ) : (
              authorName(post)
            )}
            {post.post_type !== "general" && (
              <Badge variant="outline" className="text-xs font-normal">
                {POST_TYPE_LABELS[post.post_type] ?? post.post_type}
              </Badge>
            )}
          </div>
          <time
            dateTime={post.created_at}
            title={new Date(post.created_at).toLocaleString(DATE_LOCALE[locale])}
            className="block text-xs text-muted-foreground"
          >
            {new Date(post.created_at).toLocaleDateString(DATE_LOCALE[locale], {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </time>
        </div>
      </div>
      {post.content && <p className="mt-3 whitespace-pre-wrap text-sm">{post.content}</p>}
      <div className="mt-4 flex items-center gap-4 border-t border-border/60 pt-3 text-sm text-muted-foreground">
        <button
          type="button"
          disabled={!userId || likeMutation.isPending}
          onClick={() => likeMutation.mutate()}
          aria-label={liked ? "Unlike this post" : "Like this post"}
          aria-pressed={liked}
          className={`inline-flex items-center gap-1.5 hover:text-accent disabled:opacity-50 ${liked ? "text-accent" : ""}`}
        >
          <Heart className={`size-4 ${liked ? "fill-accent" : ""}`} /> {likeCount || ""}
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          aria-expanded={showComments}
          aria-label={showComments ? "Hide comments" : "Show comments"}
          className="inline-flex items-center gap-1.5 hover:text-foreground"
        >
          <MessageCircle className="size-4" /> {commentCount || ""}
        </button>
        <ReportDialog targetType="post" targetId={post.id} triggerLabel="Report" />
      </div>

      {showComments && (
        <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
          {commentsQuery.data?.map((c) => (
            <div key={c.id} className="flex gap-2 text-sm">
              <Avatar className="size-6">
                <AvatarImage src={c.profiles?.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">
                  {(c.profiles?.display_name ?? "?").charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <Link
                  to="/profile/$profileId"
                  params={{ profileId: c.author_profile_id }}
                  className="font-medium hover:underline"
                >
                  {c.profiles?.display_name ?? "Member"}
                </Link>{" "}
                <span className="text-muted-foreground">{c.content}</span>
              </div>
            </div>
          ))}
          {userId && (
            <div className="flex gap-2">
              <Textarea
                rows={1}
                placeholder="Write a comment…"
                aria-label="Write a comment"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-0"
              />
              <Button
                size="icon"
                variant="outline"
                aria-label="Send comment"
                disabled={!newComment.trim() || commentMutation.isPending}
                onClick={() => commentMutation.mutate()}
              >
                <Send className="size-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
