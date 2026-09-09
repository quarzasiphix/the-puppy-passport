import { Badge } from "@/shared/ui/badge";
import { POST_TYPE_LABELS } from "@/domains/social";
import { EmptyState } from "./empty-state";
import { Newspaper } from "lucide-react";
import type { Posts } from "./types";

export function PostsList({ posts }: { posts: Posts }) {
  if (posts.length === 0) {
    return (
      <EmptyState icon={Newspaper} title="No posts yet">
        Updates about litters, dogs and milestones will show up here once this kennel starts
        posting.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <article key={post.id} className="rounded-2xl border border-border/70 bg-card p-6">
          <div className="flex items-center justify-between gap-3">
            <Badge variant="secondary">{POST_TYPE_LABELS[post.type]}</Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(post.createdAt).toLocaleDateString("en-GB")}
            </span>
          </div>
          {post.content && <p className="mt-3 text-sm">{post.content}</p>}
          {post.media.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {post.media.slice(0, 6).map((m) => (
                <img
                  key={m.id}
                  src={m.url}
                  alt={m.altText ?? ""}
                  className="aspect-square rounded-lg object-cover"
                />
              ))}
            </div>
          )}
          {(post.reactionCount > 0 || post.commentCount > 0) && (
            <div className="mt-3 text-xs text-muted-foreground">
              {post.reactionCount > 0 && `${post.reactionCount} reactions`}
              {post.reactionCount > 0 && post.commentCount > 0 && " · "}
              {post.commentCount > 0 && `${post.commentCount} comments`}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
