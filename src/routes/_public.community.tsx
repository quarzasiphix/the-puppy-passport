import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Heart, MessageCircle, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/_public/community")({
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

  const createPostMutation = useMutation({
    mutationFn: () => createPost({ authorProfileId: userId!, content: newPost.trim() }),
    onSuccess: () => {
      setNewPost("");
      queryClient.invalidateQueries({ queryKey: ["public-posts"] });
      toast.success("Posted.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not post."),
  });

  return (
    <div className="container-page max-w-2xl py-10">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">Community</p>
        <h1 className="mt-2 font-display text-3xl font-medium">Community</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Updates, questions and stories from breeders, foundations and fellow dog people.
        </p>
      </header>

      {userId ? (
        <div className="mb-6 rounded-2xl border border-border/70 bg-card p-4">
          <Textarea
            rows={3}
            placeholder="Share something with the community…"
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
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <Users className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No posts yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Be the first to share something with the community.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
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
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update."),
  });

  const commentMutation = useMutation({
    mutationFn: () => createComment(post.id, userId!, newComment.trim()),
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["post-comments", post.id] });
      queryClient.invalidateQueries({ queryKey: ["post-comment-counts"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not comment."),
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
          <div className="font-medium">
            {!post.author_organization_id && post.author_profile_id ? (
              <Link
                to="/profile/$profileId"
                params={{ profileId: post.author_profile_id }}
                className="hover:underline"
              >
                {authorName(post)}
              </Link>
            ) : (
              authorName(post)
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(post.created_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
        </div>
      </div>
      {post.content && <p className="mt-3 whitespace-pre-wrap text-sm">{post.content}</p>}
      <div className="mt-4 flex items-center gap-4 border-t border-border/60 pt-3 text-sm text-muted-foreground">
        <button
          type="button"
          disabled={!userId || likeMutation.isPending}
          onClick={() => likeMutation.mutate()}
          className={`inline-flex items-center gap-1.5 hover:text-accent disabled:opacity-50 ${liked ? "text-accent" : ""}`}
        >
          <Heart className={`size-4 ${liked ? "fill-accent" : ""}`} /> {likeCount || ""}
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="inline-flex items-center gap-1.5 hover:text-foreground"
        >
          <MessageCircle className="size-4" /> {commentCount || ""}
        </button>
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
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-0"
              />
              <Button
                size="icon"
                variant="outline"
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
