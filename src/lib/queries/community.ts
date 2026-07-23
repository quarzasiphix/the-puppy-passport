import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export type PostRow = {
  id: string;
  author_profile_id: string | null;
  author_organization_id: string | null;
  post_type: string;
  content: string | null;
  created_at: string;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
  organisations: { name: string; slug: string; logo_url: string | null; org_type: string } | null;
};

const postSelect =
  "id, author_profile_id, author_organization_id, post_type, content, created_at, profiles!posts_author_profile_id_fkey(display_name, avatar_url), organisations!posts_author_organization_id_fkey(name, slug, logo_url, org_type)";

export async function listPublicPosts() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("posts")
    .select(postSelect)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as PostRow[];
}

export async function createPost(payload: { authorProfileId: string; content: string }) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("posts").insert({
    author_profile_id: payload.authorProfileId,
    content: payload.content,
    post_type: "general",
    visibility: "public",
  });
  if (error) throw error;
}

export async function listReactionCounts(postIds: string[]) {
  if (!postIds.length) return new Map<string, number>();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("reactions").select("post_id").in("post_id", postIds);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    if (!r.post_id) continue;
    counts.set(r.post_id, (counts.get(r.post_id) ?? 0) + 1);
  }
  return counts;
}

export async function listMyReactedPostIds(userId: string, postIds: string[]) {
  if (!postIds.length) return new Set<string>();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("reactions")
    .select("post_id")
    .eq("profile_id", userId)
    .in("post_id", postIds);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.post_id).filter((id): id is string => !!id));
}

export async function listCommentCounts(postIds: string[]) {
  if (!postIds.length) return new Map<string, number>();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("comments").select("post_id").in("post_id", postIds);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const c of data ?? []) {
    counts.set(c.post_id, (counts.get(c.post_id) ?? 0) + 1);
  }
  return counts;
}

export async function toggleLike(postId: string, userId: string, currentlyLiked: boolean) {
  const supabase = getSupabaseBrowserClient();
  if (currentlyLiked) {
    const { error } = await supabase
      .from("reactions")
      .delete()
      .eq("post_id", postId)
      .eq("profile_id", userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("reactions")
    .insert({ post_id: postId, profile_id: userId, reaction_type: "like" });
  if (error) throw error;
}

export type CommentRow = {
  id: string;
  post_id: string;
  author_profile_id: string;
  content: string;
  created_at: string;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
};

export async function listComments(postId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("comments")
    .select(
      "id, post_id, author_profile_id, content, created_at, profiles!comments_author_profile_id_fkey(display_name, avatar_url)",
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CommentRow[];
}

export async function createComment(postId: string, authorProfileId: string, content: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("comments")
    .insert({ post_id: postId, author_profile_id: authorProfileId, content });
  if (error) throw error;
}
