import type { Database } from "@/lib/supabase/types";

// Types for the breeder social layer — built directly on the existing posts/comments/reactions/
// follows/groups tables (supabase/migrations/20260101001900_community.sql, widened in
// 20260903000100-20260903000600). See docs/SOCIAL_DOMAIN.md for the schema rationale.

export type PostType = Database["public"]["Enums"]["post_type"];
export type PostVisibility = Database["public"]["Enums"]["post_visibility"];
export type ReactionType = Database["public"]["Enums"]["reaction_type"];
export type ContentModerationStatus = Database["public"]["Enums"]["content_moderation_status"];
export type PostMediaType = Database["public"]["Enums"]["post_media_type"];

/**
 * A post is never the authoritative commercial record — Dog/Litter → Listing → Post. These are
 * the entities a post may reference, via real foreign keys on the posts row (linked_animal_id,
 * linked_litter_id, linked_transport_request_id, linked_route_id, linked_achievement_id,
 * group_id), never encoded only in free-text content. `listing` has no column yet because this
 * schema has no separate listings table — a "listing" is currently `animals.is_published = true`
 * (see docs/DEFERRED_BACKEND.md); linked_animal_id already covers "this post is about this dog's
 * listing" until that split happens. `pedigree` similarly has no column yet — no pedigree table
 * exists (domains/pedigrees is contract-only).
 */
export type PostReferences = {
  kennelId: string | null; // author_organization_id
  animalId: string | null; // linked_animal_id — a dog, and today also a dog's listing
  litterId: string | null; // linked_litter_id
  achievementId: string | null; // linked_achievement_id
  transportRequestId: string | null; // linked_transport_request_id
  routeId: string | null; // linked_route_id
  groupId: string | null; // group_id — set only when visibility = 'group'
};

export type PostRow = {
  id: string;
  author_profile_id: string | null;
  author_organization_id: string | null;
  post_type: PostType;
  content: string | null;
  image_urls: string[];
  linked_transport_request_id: string | null;
  linked_animal_id: string | null;
  linked_route_id: string | null;
  linked_litter_id: string | null;
  linked_achievement_id: string | null;
  group_id: string | null;
  visibility: PostVisibility;
  auto_published: boolean;
  moderation_status: ContentModerationStatus;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PostAuthorSummary = {
  profileId: string | null;
  organisationId: string | null;
  name: string;
  avatarUrl: string | null;
};

/** The view model every feed/timeline surface renders. */
export type PostSummary = {
  id: string;
  type: PostType;
  content: string | null;
  media: PostMediaSummary[];
  visibility: PostVisibility;
  author: PostAuthorSummary;
  references: PostReferences;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  reactionCount: number;
  viewerReaction: ReactionType | null;
};

export type PostMediaRow = {
  id: string;
  post_id: string;
  media_type: PostMediaType;
  media_url: string;
  display_order: number;
  caption: string | null;
  alt_text: string | null;
};

export type PostMediaSummary = {
  id: string;
  type: PostMediaType;
  url: string;
  order: number;
  caption: string | null;
  altText: string | null;
};

export type CommentRow = {
  id: string;
  post_id: string;
  author_profile_id: string;
  content: string;
  parent_comment_id: string | null;
  moderation_status: ContentModerationStatus;
  deleted_at: string | null;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
};

export type CommentSummary = {
  id: string;
  postId: string;
  parentCommentId: string | null;
  authorProfileId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  content: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  replies: CommentSummary[];
};

/** Mirrors the follows table's own "exactly one target column" shape — never loose polymorphism. */
export type FollowTargetType = "profile" | "organisation" | "animal" | "litter" | "breed" | "group";

export type FollowTarget = { type: FollowTargetType; id: string };

// Translated via the i18n `t()` function rather than a static Record, since these labels render on
// public breeder-profile pages — see src/shared/i18n/index.tsx. Pass `useTranslation().t`.
export function postTypeLabel(t: (key: string) => string, type: PostType): string {
  const map: Record<PostType, string> = {
    general: t("socialPostTypes.general"),
    transport_update: t("socialPostTypes.transportUpdate"),
    route_announcement: t("socialPostTypes.routeAnnouncement"),
    litter_announcement: t("socialPostTypes.litterAnnouncement"),
    adoption_post: t("socialPostTypes.adoptionPost"),
    achievement: t("socialPostTypes.achievement"),
    photo: t("socialPostTypes.photo"),
    video: t("socialPostTypes.video"),
    health_update: t("socialPostTypes.healthUpdate"),
    dog_update: t("socialPostTypes.dogUpdate"),
    planned_mating: t("socialPostTypes.plannedMating"),
    availability_announcement: t("socialPostTypes.availabilityAnnouncement"),
    transport_availability: t("socialPostTypes.transportAvailability"),
    educational: t("socialPostTypes.educational"),
    registry_announcement: t("socialPostTypes.registryAnnouncement"),
  };
  return map[type];
}

export const POST_VISIBILITY_LABELS: Record<PostVisibility, string> = {
  public: "Public",
  followers: "Followers only",
  group: "Community",
  litter_members: "Litter owners only",
  private: "Only me",
};
