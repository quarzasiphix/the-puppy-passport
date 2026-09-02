import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { FollowTarget, FollowTargetType } from "../types";

// Generic follow API covering the target types added in
// supabase/migrations/20260903000300_follows_expanded_targets.sql (animal/litter/breed/group).
// Organisation-follow already had a working implementation before this domain existed
// (domains/marketplace/services/buyer-activity.ts — followOrg/unfollowOrg/listFollowedOrgIds,
// used by the live public kennel page) and is left as-is here rather than duplicated; consolidating
// it onto this generic API is tracked as follow-up in docs/FILE_MIGRATION_MAP.md, not done in this
// pass to avoid touching working code unnecessarily.

const TARGET_COLUMN = {
  profile: "followed_profile_id",
  organisation: "followed_organization_id",
  animal: "followed_animal_id",
  litter: "followed_litter_id",
  breed: "followed_breed_id",
  group: "followed_group_id",
} as const satisfies Record<FollowTargetType, string>;

type TargetColumn = (typeof TARGET_COLUMN)[FollowTargetType];

// One homogeneous row shape with every target column present (all but one explicitly null) —
// supabase-js's generated Insert type rejects a discriminated union of narrower per-branch shapes
// (it validates against every union member at once, wanting fields required in one branch but
// absent in another), so building a dynamic-key or narrowed-per-case object doesn't typecheck even
// though each individual shape is valid at the database layer (the follows_target CHECK is what
// actually enforces "exactly one").
function buildFollowRow(followerProfileId: string, target: FollowTarget) {
  return {
    follower_profile_id: followerProfileId,
    followed_profile_id: target.type === "profile" ? target.id : null,
    followed_organization_id: target.type === "organisation" ? target.id : null,
    followed_animal_id: target.type === "animal" ? target.id : null,
    followed_litter_id: target.type === "litter" ? target.id : null,
    followed_breed_id: target.type === "breed" ? target.id : null,
    followed_group_id: target.type === "group" ? target.id : null,
  };
}

export async function isFollowing(
  followerProfileId: string,
  target: FollowTarget,
): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  const column: TargetColumn = TARGET_COLUMN[target.type];
  const { data, error } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_profile_id", followerProfileId)
    .eq(column, target.id)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function followTarget(followerProfileId: string, target: FollowTarget): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("follows")
    .insert(buildFollowRow(followerProfileId, target));
  // A duplicate follow is not an error from the caller's point of view — the partial unique index
  // per target type already makes this idempotent at the database layer.
  if (error && !error.message.toLowerCase().includes("duplicate")) throw error;
}

export async function unfollowTarget(
  followerProfileId: string,
  target: FollowTarget,
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const column: TargetColumn = TARGET_COLUMN[target.type];
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_profile_id", followerProfileId)
    .eq(column, target.id);
  if (error) throw error;
}

export async function listFollowedIds(
  followerProfileId: string,
  type: FollowTargetType,
): Promise<string[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("follows")
    .select(
      "followed_profile_id, followed_organization_id, followed_animal_id, followed_litter_id, followed_breed_id, followed_group_id",
    )
    .eq("follower_profile_id", followerProfileId);
  if (error) throw error;

  const column = TARGET_COLUMN[type];
  return (data ?? []).map((r) => r[column as keyof typeof r]).filter((v): v is string => !!v);
}

/** Follower count is always derived from real rows — never stored/incrementable client-side. */
export async function countFollowers(target: FollowTarget): Promise<number> {
  const supabase = getSupabaseBrowserClient();
  const column: TargetColumn = TARGET_COLUMN[target.type];
  const { count, error } = await supabase
    .from("follows")
    .select("id", { count: "exact", head: true })
    .eq(column, target.id);
  if (error) throw error;
  return count ?? 0;
}
