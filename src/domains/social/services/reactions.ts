import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ReactionType } from "../types";

// Counts are always derived by querying real rows (here, or via the `reactions(count)` embed in
// posts.ts) — never a client-supplied or client-incrementable aggregate column. See
// docs/SOCIAL_DOMAIN.md "Counts are always derived."

export async function getMyReactionForPost(
  profileId: string,
  postId: string,
): Promise<ReactionType | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("reactions")
    .select("reaction_type")
    .eq("post_id", postId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data?.reaction_type ?? null;
}

/** Idempotent toggle: reacting again with the same type removes it, a different type replaces it. */
export async function setPostReaction(
  profileId: string,
  postId: string,
  reactionType: ReactionType | null,
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (reactionType === null) {
    const { error } = await supabase
      .from("reactions")
      .delete()
      .eq("post_id", postId)
      .eq("profile_id", profileId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("reactions")
    .upsert(
      { post_id: postId, profile_id: profileId, reaction_type: reactionType },
      { onConflict: "profile_id,post_id" },
    );
  if (error) throw error;
}

export async function setCommentReaction(
  profileId: string,
  commentId: string,
  reactionType: ReactionType | null,
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (reactionType === null) {
    const { error } = await supabase
      .from("reactions")
      .delete()
      .eq("comment_id", commentId)
      .eq("profile_id", profileId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("reactions")
    .upsert(
      { comment_id: commentId, profile_id: profileId, reaction_type: reactionType },
      { onConflict: "profile_id,comment_id" },
    );
  if (error) throw error;
}
