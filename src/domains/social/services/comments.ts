import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { CommentRow, CommentSummary } from "../types";

type CommentQueryRow = CommentRow & {
  profiles: { display_name: string | null; avatar_url: string | null } | null;
};

const commentSelect = `
  id, post_id, author_profile_id, content, parent_comment_id, moderation_status, deleted_at,
  is_edited, created_at, updated_at,
  profiles!comments_author_profile_id_fkey(display_name, avatar_url)
`;

function mapComment(r: CommentQueryRow): CommentSummary {
  const isDeleted = r.deleted_at !== null || r.moderation_status !== "visible";
  return {
    id: r.id,
    postId: r.post_id,
    parentCommentId: r.parent_comment_id,
    authorProfileId: r.author_profile_id,
    authorName: r.profiles?.display_name ?? "Anemalo member",
    authorAvatarUrl: r.profiles?.avatar_url ?? null,
    // Soft-deleted/moderated content keeps its place in the thread (replies may reference it) but
    // never shows its real text — matches "use soft deletion where discussion continuity requires
    // it."
    content: isDeleted ? "" : r.content,
    isEdited: r.is_edited,
    isDeleted,
    createdAt: r.created_at,
    replies: [],
  };
}

/** One level of nesting only — matches the DB's own check_comment_reply_depth() trigger. Returns
 * top-level comments with their direct replies attached, oldest first. */
export async function listPostComments(postId: string): Promise<CommentSummary[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("comments")
    .select(commentSelect)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = ((data ?? []) as unknown as CommentQueryRow[]).map(mapComment);
  const byId = new Map(rows.map((c) => [c.id, c]));
  const roots: CommentSummary[] = [];
  for (const c of rows) {
    if (c.parentCommentId) {
      byId.get(c.parentCommentId)?.replies.push(c);
    } else {
      roots.push(c);
    }
  }
  return roots;
}

export async function addComment(
  authorProfileId: string,
  postId: string,
  content: string,
  parentCommentId?: string | null,
): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      author_profile_id: authorProfileId,
      content,
      parent_comment_id: parentCommentId ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function editComment(commentId: string, content: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("comments")
    .update({ content, is_edited: true })
    .eq("id", commentId);
  if (error) throw error;
}

export async function softDeleteComment(commentId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId);
  if (error) throw error;
}
