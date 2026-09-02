import type { PostType } from "./types";

// Pure logic only — no Supabase import here on purpose, so it can be unit-tested standalone under
// the plain Node test runner (tests/unit runs outside Vite, where import.meta.env is unavailable;
// see tests/unit/social-domain.test.ts and domains/reservations/status.ts for the same pattern).

/**
 * "A social availability post is not itself the authoritative commercial listing." True today
 * because this schema has no separate listings table — an availability-shaped post should always
 * reference a real animal (linked_animal_id) that is itself published (animals.is_published =
 * true), never stand alone. Used by the composer to prompt "connect this to a real puppy" instead
 * of silently allowing an unlinked availability claim.
 */
const AVAILABILITY_SHAPED_POST_TYPES: readonly PostType[] = [
  "availability_announcement",
  "litter_announcement",
  "adoption_post",
];

export function postNeedsListingReference(
  postType: PostType,
  linkedAnimalId: string | null,
): boolean {
  return AVAILABILITY_SHAPED_POST_TYPES.includes(postType) && !linkedAnimalId;
}
