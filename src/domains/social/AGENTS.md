# Social domain

The breeder/kennel social layer — posts, comments, reactions, generic follows — built directly on
`posts`/`comments`/`reactions`/`follows`/`groups` (`20260101001900_community.sql`, widened
2026-09-03). See `docs/SOCIAL_DOMAIN.md` for the schema rationale.

## ⚠ Overlaps with the `community` domain — read before touching either

**This domain and `community/services/community.ts` both implement CRUD over the same
`posts`/`comments`/`reactions` tables, independently — two different `createPost` functions with
different signatures exist in two different domains over one table.** Not resolved in this pass.
See `community/AGENTS.md`'s matching note for the full comparison.

**This domain already has `softDeletePost(postId)` (`services/posts.ts`) and
`softDeleteComment(commentId)` (`services/comments.ts`) — `community` has neither.** If a
moderator/admin "remove a post" capability is being planned, start here, not in `community`.
`posts.moderation_status` (`ContentModerationStatus` enum, `types.ts:10`/`48`) and
`posts.deleted_at` already exist as columns — the schema already models moderated/deleted posts,
whether or not a moderator-facing UI currently sets them.

## What this owns

- `posts` — `listKennelPosts`, `listProfilePosts`, `listCommunityPosts`, `listFollowingFeed`,
  `createPost`, `softDeletePost`, `addPostMedia` (`services/posts.ts`, 234 lines). A post is
  explicitly "never the authoritative commercial record — Dog/Litter → Listing → Post"
  (`types.ts:14`); it references real entities via FK columns
  (`linked_animal_id`/`linked_litter_id`/etc.), never free text.
- `comments` — `listPostComments`, `addComment`, `editComment`, `softDeleteComment`
  (`services/comments.ts`).
- `reactions` — `getMyReactionForPost`, `setPostReaction`, `setCommentReaction`
  (`services/reactions.ts`). "Counts are always derived by querying real rows... never a
  client-supplied or client-incrementable aggregate column" (`services/reactions.ts:1-3`).
- `follows` — a **generic** follow API (`services/follows.ts`) covering animal/litter/breed/group
  targets added in `20260903000300_follows_expanded_targets.sql`. Explicitly does **not** cover
  organisation-follow — "Organisation-follow already had a working implementation before this
  domain existed (`domains/marketplace/services/buyer-activity.ts`)... left as-is here rather than
  duplicated; consolidating it onto this generic API is tracked as follow-up in
  `docs/FILE_MIGRATION_MAP.md`" (`services/follows.ts:1-7`). So there are **two follow systems**:
  this domain's generic one, and `marketplace`'s organisation-specific
  `followOrg`/`unfollowOrg`/`listFollowedOrgIds` — both real, neither redundant (different target
  types), but a caller needs to know which one to use for which target.

## File structure

- `index.ts` — re-exports `types`, `status`, `services/posts`, `services/comments`,
  `services/reactions`, `services/follows`, `components/kennel-post-composer`.
- `types.ts` — the full post/comment/media/follow type model, `PostReferences` (which real
  entities a post may link to), `postTypeLabel(t, type)` (i18n'd — "Translated via the i18n `t()`
  function rather than a static Record, since these labels render on public breeder-profile pages",
  `types.ts:128-129`), and `POST_VISIBILITY_LABELS` (**not** i18n'd — plain hardcoded-English
  `Record`, inconsistent with `postTypeLabel` right above it).
- `status.ts` — pure logic, no Supabase import, unit-testable under the plain Node runner (same
  pattern as `reservations/status.ts`). `postNeedsListingReference()` — flags
  availability/litter/adoption-shaped posts that aren't linked to a real published animal, so the
  composer can prompt to connect one instead of allowing an unlinked availability claim.
- `services/posts.ts`, `services/comments.ts`, `services/reactions.ts`, `services/follows.ts` —
  described above.
- `components/kennel-post-composer.tsx` — the breeder-dashboard post composer.

## Public API

`index.ts` exports the full surface flatly.

## Known gaps

- The `community`/`social` overlap on posts/comments/reactions (see the warning above).
- `POST_VISIBILITY_LABELS` (`types.ts:151-157`) is hardcoded English, unlike the `postTypeLabel`
  function three lines above it in the same file.
- Two parallel follow systems (this domain's generic one vs. `marketplace`'s organisation-specific
  one) — consolidation tracked in `docs/FILE_MIGRATION_MAP.md`, not done.

## Related docs

- `docs/SOCIAL_DOMAIN.md` — schema rationale, cited throughout `types.ts`.
- `docs/FILE_MIGRATION_MAP.md` — the follow-system consolidation follow-up.
- `docs/DEFERRED_BACKEND.md` — why "listing" has no dedicated column/table yet.

## Last significant change

Not determined from in-domain evidence in this pass; file created 2026-09-12 as part of the
project-wide `AGENTS.md` rollout, which is also when the `community`/`social` overlap and the
existing `softDeletePost`/`moderation_status` groundwork were first flagged in writing (relevant to
a moderator-role panel under discussion in the same session — see the repo-root `TODO.md`).
