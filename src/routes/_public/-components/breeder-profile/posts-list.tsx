import { Badge } from "@/shared/ui/badge";
import { postTypeLabel } from "@/domains/social";
import { EmptyState } from "./empty-state";
import { Newspaper } from "lucide-react";
import type { Posts } from "./types";
import { useTranslation } from "@/shared/i18n";

// Polish plural forms of "reakcja"/"komentarz" depend on the count, so these build the final
// fragment directly rather than through a single dot-path key — see the i18n file header /
// CLAUDE.md note on interpolation not being supported by t().
function plReactionsWord(n: number): string {
  if (n === 1) return "reakcja";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "reakcje";
  return "reakcji";
}
function plCommentsWord(n: number): string {
  if (n === 1) return "komentarz";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "komentarze";
  return "komentarzy";
}

export function PostsList({ posts }: { posts: Posts }) {
  const { t, locale } = useTranslation();
  if (posts.length === 0) {
    return (
      <EmptyState icon={Newspaper} title={t("communityPage.noPostsTitle")}>
        {t("postsListEmptyDesc")}
      </EmptyState>
    );
  }
  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <article key={post.id} className="rounded-2xl border border-border/70 bg-card p-6">
          <div className="flex items-center justify-between gap-3">
            <Badge variant="secondary">{postTypeLabel(t, post.type)}</Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(post.createdAt).toLocaleDateString(locale === "pl" ? "pl-PL" : "en-GB")}
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
              {post.reactionCount > 0 &&
                (locale === "pl"
                  ? `${post.reactionCount} ${plReactionsWord(post.reactionCount)}`
                  : `${post.reactionCount} reactions`)}
              {post.reactionCount > 0 && post.commentCount > 0 && " · "}
              {post.commentCount > 0 &&
                (locale === "pl"
                  ? `${post.commentCount} ${plCommentsWord(post.commentCount)}`
                  : `${post.commentCount} comments`)}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
