import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// Public profile pages (hierarchy pillar 2/3 in docs/PRODUCT_VISION.md — trusted profiles and
// social discovery). Only ever selects the columns anon/authenticated are actually granted on
// `profiles` (see 20260101003100_profiles_anon_public_columns.sql,
// 20260101003600_profiles_anon_location.sql, 20260101003200_profiles_contact_lockdown.sql) —
// never email/phone/first_name/last_name.
export type PublicProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
};

export async function getPublicProfile(profileId: string): Promise<PublicProfile | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, city, country")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type ProfilePostRow = {
  id: string;
  content: string | null;
  post_type: string;
  created_at: string;
};

export async function listPublicPostsByAuthor(profileId: string): Promise<ProfilePostRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("posts")
    .select("id, content, post_type, created_at")
    .eq("author_profile_id", profileId)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export type PublicOrgLink = {
  slug: string;
  orgType: "kennel" | "foundation" | "shelter" | "rescue";
};

// Whether an organisation this profile owns is public+approved, so the page can offer a link into
// its full portfolio (breeder profiles at /breeders/$slug, foundation/shelter/rescue profiles at
// /foundations/$slug — this page doesn't duplicate either, it just points to the right one).
export async function getPublicOrgLinkForOwner(profileId: string): Promise<PublicOrgLink | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("organisations")
    .select("slug, org_type")
    .eq("owner_user_id", profileId)
    .in("org_type", ["kennel", "foundation", "shelter", "rescue"])
    .eq("verification_status", "approved")
    .eq("is_public", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { slug: data.slug, orgType: data.org_type as PublicOrgLink["orgType"] };
}

export async function listFollowedProfileIds(followerId: string): Promise<string[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("follows")
    .select("followed_profile_id")
    .eq("follower_profile_id", followerId)
    .not("followed_profile_id", "is", null);
  if (error) throw error;
  return (data ?? []).map((r) => r.followed_profile_id!).filter(Boolean);
}

export async function isFollowingProfile(followerId: string, profileId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_profile_id", followerId)
    .eq("followed_profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function followProfile(followerId: string, profileId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("follows")
    .insert({ follower_profile_id: followerId, followed_profile_id: profileId });
  if (error) throw error;
}

export async function unfollowProfile(followerId: string, profileId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_profile_id", followerId)
    .eq("followed_profile_id", profileId);
  if (error) throw error;
}
