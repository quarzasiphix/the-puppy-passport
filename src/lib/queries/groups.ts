import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// No caller passes a limit today, so this cap is invisible against the current dataset — same
// unbounded-fetch class of gap Q-1 closed for listPublishedPuppies (src/lib/queries/marketplace.ts).
const DEFAULT_PAGE_SIZE = 200;

export type GroupRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  group_type: string | null;
};

export async function listGroups(): Promise<GroupRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, slug, description, group_type")
    .order("name")
    .limit(DEFAULT_PAGE_SIZE);
  if (error) throw error;
  return data ?? [];
}

export async function getGroupBySlug(slug: string): Promise<GroupRow | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, slug, description, group_type")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listMyGroupIds(profileId: string): Promise<string[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("profile_id", profileId);
  if (error) throw error;
  return (data ?? []).map((r) => r.group_id);
}

export async function joinGroup(profileId: string, groupId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("group_members")
    .insert({ profile_id: profileId, group_id: groupId });
  if (error) throw error;
}

export async function leaveGroup(profileId: string, groupId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("profile_id", profileId)
    .eq("group_id", groupId);
  if (error) throw error;
}

export async function countGroupMembers(groupId: string): Promise<number> {
  const supabase = getSupabaseBrowserClient();
  const { count, error } = await supabase
    .from("group_members")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId);
  if (error) throw error;
  return count ?? 0;
}

export type GroupPostRow = {
  id: string;
  author_profile_id: string | null;
  post_type: string;
  content: string | null;
  created_at: string;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
};

export async function listGroupPosts(groupId: string): Promise<GroupPostRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, author_profile_id, post_type, content, created_at, profiles!posts_author_profile_id_fkey(display_name, avatar_url)",
    )
    .eq("group_id", groupId)
    .eq("visibility", "group")
    .order("created_at", { ascending: false })
    .limit(DEFAULT_PAGE_SIZE);
  if (error) throw error;
  return (data ?? []) as unknown as GroupPostRow[];
}

export async function createGroupPost(payload: {
  authorProfileId: string;
  groupId: string;
  content: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("posts").insert({
    author_profile_id: payload.authorProfileId,
    group_id: payload.groupId,
    content: payload.content,
    post_type: "general",
    visibility: "group",
  });
  if (error) throw error;
}
