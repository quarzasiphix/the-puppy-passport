import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  PostAuthorSummary,
  PostReferences,
  PostRow,
  PostSummary,
  PostType,
  PostVisibility,
} from "../types";

const postSelect = `
  id, author_profile_id, author_organization_id, post_type, content, image_urls,
  linked_transport_request_id, linked_animal_id, linked_route_id, linked_litter_id,
  linked_achievement_id, group_id, visibility, auto_published, moderation_status, deleted_at,
  created_at, updated_at,
  profiles!posts_author_profile_id_fkey(display_name, avatar_url),
  organisations!posts_author_organization_id_fkey(name, logo_url),
  post_media(id, media_type, media_url, display_order, caption, alt_text),
  comments(count),
  reactions(count)
`;

type PostQueryRow = PostRow & {
  profiles: { display_name: string | null; avatar_url: string | null } | null;
  organisations: { name: string; logo_url: string | null } | null;
  post_media: {
    id: string;
    media_type: string;
    media_url: string;
    display_order: number;
    caption: string | null;
    alt_text: string | null;
  }[];
  comments: { count: number }[];
  reactions: { count: number }[];
};

function mapAuthor(r: PostQueryRow): PostAuthorSummary {
  if (r.author_organization_id && r.organisations) {
    return {
      profileId: null,
      organisationId: r.author_organization_id,
      name: r.organisations.name,
      avatarUrl: r.organisations.logo_url,
    };
  }
  return {
    profileId: r.author_profile_id,
    organisationId: null,
    name: r.profiles?.display_name ?? "Havenpaw member",
    avatarUrl: r.profiles?.avatar_url ?? null,
  };
}

function mapReferences(r: PostQueryRow): PostReferences {
  return {
    kennelId: r.author_organization_id,
    animalId: r.linked_animal_id,
    litterId: r.linked_litter_id,
    achievementId: r.linked_achievement_id,
    transportRequestId: r.linked_transport_request_id,
    routeId: r.linked_route_id,
    groupId: r.group_id,
  };
}

function mapPost(r: PostQueryRow): PostSummary {
  return {
    id: r.id,
    type: r.post_type,
    content: r.content,
    media: (r.post_media ?? [])
      .slice()
      .sort((a, b) => a.display_order - b.display_order)
      .map((m) => ({
        id: m.id,
        type: m.media_type as PostSummary["media"][number]["type"],
        url: m.media_url,
        order: m.display_order,
        caption: m.caption,
        altText: m.alt_text,
      })),
    visibility: r.visibility,
    author: mapAuthor(r),
    references: mapReferences(r),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    commentCount: r.comments?.[0]?.count ?? 0,
    reactionCount: r.reactions?.[0]?.count ?? 0,
    // Per-viewer reaction is intentionally not embedded here (would need a per-user filter that
    // can't be expressed in one shared select) — see getMyReactionForPost() below.
    viewerReaction: null,
  };
}

export async function listKennelPosts(organisationId: string): Promise<PostSummary[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("posts")
    .select(postSelect)
    .eq("author_organization_id", organisationId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return ((data ?? []) as unknown as PostQueryRow[]).map(mapPost);
}

export async function listProfilePosts(profileId: string): Promise<PostSummary[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("posts")
    .select(postSelect)
    .eq("author_profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return ((data ?? []) as unknown as PostQueryRow[]).map(mapPost);
}

export async function listCommunityPosts(groupId: string): Promise<PostSummary[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("posts")
    .select(postSelect)
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return ((data ?? []) as unknown as PostQueryRow[]).map(mapPost);
}

/**
 * The personalised following feed — kennels/breeders the viewer follows, chronological, no
 * engagement-ranking. RLS still governs what actually comes back (a followed kennel's
 * followers-only post only appears here because can_view_post() independently confirms the
 * follow relationship server-side); this query only narrows *whose* posts to ask for.
 */
export async function listFollowingFeed(profileId: string): Promise<PostSummary[]> {
  const supabase = getSupabaseBrowserClient();
  const { data: follows, error: followsError } = await supabase
    .from("follows")
    .select("followed_profile_id, followed_organization_id")
    .eq("follower_profile_id", profileId);
  if (followsError) throw followsError;

  const profileIds = (follows ?? [])
    .map((f) => f.followed_profile_id)
    .filter((v): v is string => !!v);
  const orgIds = (follows ?? [])
    .map((f) => f.followed_organization_id)
    .filter((v): v is string => !!v);
  if (profileIds.length === 0 && orgIds.length === 0) return [];

  const orFilter = [
    profileIds.length ? `author_profile_id.in.(${profileIds.join(",")})` : null,
    orgIds.length ? `author_organization_id.in.(${orgIds.join(",")})` : null,
  ]
    .filter(Boolean)
    .join(",");

  const { data, error } = await supabase
    .from("posts")
    .select(postSelect)
    .or(orFilter)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as unknown as PostQueryRow[]).map(mapPost);
}

export type CreatePostInput = {
  postType: PostType;
  content: string | null;
  visibility: PostVisibility;
  authorOrganizationId?: string | null;
  linkedAnimalId?: string | null;
  linkedLitterId?: string | null;
  linkedAchievementId?: string | null;
  linkedTransportRequestId?: string | null;
  groupId?: string | null;
};

export async function createPost(authorProfileId: string, input: CreatePostInput): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_profile_id: input.authorOrganizationId ? null : authorProfileId,
      author_organization_id: input.authorOrganizationId ?? null,
      post_type: input.postType,
      content: input.content,
      visibility: input.visibility,
      linked_animal_id: input.linkedAnimalId ?? null,
      linked_litter_id: input.linkedLitterId ?? null,
      linked_achievement_id: input.linkedAchievementId ?? null,
      linked_transport_request_id: input.linkedTransportRequestId ?? null,
      group_id: input.groupId ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function softDeletePost(postId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) throw error;
}

export async function addPostMedia(
  postId: string,
  media: {
    mediaType: "image" | "video";
    mediaUrl: string;
    order: number;
    caption?: string | null;
    altText?: string | null;
  },
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("post_media").insert({
    post_id: postId,
    media_type: media.mediaType,
    media_url: media.mediaUrl,
    display_order: media.order,
    caption: media.caption ?? null,
    alt_text: media.altText ?? null,
  });
  if (error) throw error;
}
