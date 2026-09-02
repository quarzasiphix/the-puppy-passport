# Social domain — breeder social network & kennel portal

Status: **DB foundation + kennel page/settings integration shipped (Phase 1 + a slice of Phase 2).**
No feed UI, composer, comment thread UI, or notification wiring yet — see "Deferred" below.

## What existed before this pass

`public.posts`, `public.comments`, `public.reactions`, `public.follows`, `public.groups` +
`public.group_members` already existed (`supabase/migrations/20260101001900_community.sql`) —
built for a generic "community" feature, never wired to any UI (confirmed: zero references to
`posts.image_urls` anywhere in `src/` before this pass). These are **exactly** the right
primitives for the breeder social layer:

- `posts` already had real reference columns, not free-text-only relationships:
  `author_profile_id` / `author_organization_id` ("post as kennel"), `linked_animal_id`,
  `linked_transport_request_id`, `linked_route_id`, `group_id`.
- `follows` already used the safe pattern the brief asks for — nullable target columns + a CHECK
  that exactly one is set + a partial unique index per target — not loose polymorphism.
- `groups`/`group_members` already **are** communities (seeded demo data includes
  breed-specific groups like "Border Collie owners & breeders").

This pass widened these tables rather than building a parallel system.

## What changed (`supabase/migrations/20260903000100`–`20260903000600`)

1. **Enum widening** — `post_type` gained the typed-post vocabulary (photo, video, health_update,
   dog_update, planned_mating, availability_announcement, transport_availability, educational,
   registry_announcement); `post_visibility` gained `private` and `litter_members`.
2. **Posts/comments hardening**:
   - New columns: `posts.linked_litter_id`, `posts.linked_achievement_id`, `posts.deleted_at`,
     `posts.moderation_status`; `comments.parent_comment_id` (replies, one level deep — enforced
     by `check_comment_reply_depth()`, not just convention), `comments.deleted_at/updated_at/is_edited/moderation_status`.
   - **Real gap closed**: `visibility = 'followers'` had no working read policy at all before this
     pass (only `public` and `group` were ever wired) — closed via `can_view_post()`, one shared
     predicate now used by posts, comments, reactions and `post_media` SELECT policies.
   - **Real gap closed**: `"reactions are publicly readable"` was an unconditional `true` — a
     reaction on a private/group-only post was still world-readable. Now scoped to
     `can_view_post()`.
   - Posting-as-kennel widened from owner-only (`owns_org()`) to any active member
     (`is_org_member()`) — matches this schema's own convention for org-scoped resources
     elsewhere (litters, animals) and the product need for a team to post, not just the owner.
   - `moderation_status` is admin/moderator-only to change (`prevent_non_moderator_*` triggers) —
     an author can edit their own content or soft-delete it, never un-hide what a moderator hid.
3. **`follows` expanded targets** — added `followed_animal_id`, `followed_litter_id`,
   `followed_breed_id`, `followed_group_id` (same CHECK-one-of-N + partial-unique-index pattern
   as the original two columns). Added `prevent_invalid_follow_targets()`: no self-follows, no
   following a non-public organisation.
4. **`organisation_site_configurations`** — the controlled kennel-page configuration (theme,
   primary color, visible/ordered sections, language, contact mode, branding). Publicly readable
   (it's what renders the page), owner/admin-writable.
5. **`organisation_domains`** — schema only for future subdomains/custom domains. No DNS,
   provisioning or routing exists. See "Future subdomains" below.
6. **`post_media`** — structured media (type, order, caption, alt text) replacing the unused
   `posts.image_urls text[]` going forward (left in place, not dropped). Private storage bucket
   `post-media`, RLS mirrors `can_view_post()`.
7. **`organisations.plan`** — `'free' | 'pro' | 'website'`, default `'free'` for every existing
   kennel. Backs the capability model below; not billing-enforced (no payment provider exists).

## Core entity distinctions (as implemented)

| Concept | Table |
|---|---|
| User | `auth.users` / `public.profiles` |
| Kennel (also today's "breeder profile" — see note) | `public.organisations` (`org_type='kennel'`\|`'foundation'`\|`'shelter'`) |
| Dog | `public.animals` |
| Litter | `public.litters` |
| Listing | not a separate table — `animals.is_published = true` (see docs/DEFERRED_BACKEND.md) |
| Post | `public.posts` |
| Conversation | `public.conversations` (messaging domain, unchanged) |
| Community | `public.groups` |
| Reservation | `public.reservations` (unchanged) |
| Transport request | `public.transport_requests` (unchanged) |

**Note on "Breeder profile" vs "Kennel":** the brief asks these to be distinct. Today one
`organisations` row is both — there is no separate professional-breeder-identity entity. Splitting
this is a real schema change affecting every kennel-scoped query in the codebase; not done in this
pass (see docs/FILE_MIGRATION_MAP.md's `breeder.ts`/`foundation.ts` follow-up, same underlying
tension). Documented, not silently ignored.

## Posts vs. listings

`Dog/Litter → Listing → Post`. Enforced today by `linked_animal_id`: an availability-shaped post
(`availability_announcement`, `litter_announcement`, `adoption_post`) without a linked animal is
flagged by `postNeedsListingReference()` (`domains/social/services/posts.ts`) so the composer can
prompt "connect this to a real puppy" — there is no separate `listings` table yet to point at
(a "listing" is `animals.is_published = true`), so `linked_animal_id` is the closest real
reference until that split happens.

## Visibility & moderation

`can_view_post(post_id)` (SECURITY DEFINER, `public` schema) is the one predicate every
posts/comments/reactions/post_media SELECT policy uses for third-party viewers: `public` → true,
`group` → `is_group_member()`, `followers` → `is_following_target()`, everything else (`private`,
`litter_members`) → false. Author/admin access comes from their own separate ALL policies, not
this function — deliberately, to keep it a pure "can a stranger see this" answer.

`content_moderation_status` (`visible | hidden | removed`) — shared by posts and comments, only a
moderator/admin can change it (enforced by trigger, not just RLS row-ownership).

## Counts

Comment/reaction/follower counts are always derived (a live `count(*)` or a PostgREST
`(count)` embed) — never a stored, client-incrementable column. See
`domains/social/services/reactions.ts` and `domains/social/services/follows.ts::countFollowers`.

## Kennel portal & SEO

`/breeders/$slug` (existing route, extended) already had `head()` populated per-kennel (title,
description) via TanStack Start's SSR loader — **this stack already SSRs every route by default**
(TanStack Start), so no separate SSG/prerender layer is needed for basic SEO; what was missing was
per-page structured content, not the rendering strategy. This pass adds a read-only "Posts" tab
sourced from `listKennelPosts()`. Open Graph image tags, JSON-LD structured data and a sitemap are
not added yet (see Deferred).

## Future subdomains and custom domains

`organisation_domains` exists with `hostname`, `type` (`anemalo_subdomain`\|`custom_domain`),
`status`, `verification_token`, `is_primary`, a reserved-subdomain list
(`reject_reserved_hostname()`), a hostname-format check, and a unique-hostname index. **No DNS
provisioning, certificate issuance, or request-routing exists** — a future edge/worker layer would
resolve `Host` headers against this table (service-role read, not exposed to the browser) and is
explicitly out of scope for this pass, per the brief.

## Capability model

`domains/breeders/types.ts::getKennelCapabilities(plan)` — one function, three tiers (free / pro /
website), used instead of `plan === "pro"` checks scattered through components. Backed by the real
`organisations.plan` column. Not billing-enforced.

## POK integration boundary

See `docs/POK_INTEGRATION.md`.

## Deferred (not built in this pass)

- Feed/composer/comment-thread UI, pagination, reporting UI for posts (Phase 2 in the brief).
- Personalized/breed/dog/litter feeds beyond the single `listFollowingFeed()` query.
- Litter-owner private communities (explicit membership, growth photos, shared documents) — the
  `litter_members` visibility value exists and is inert (no read policy grants it) specifically so
  this can be added later without a migration that touches existing rows.
- Notification integration for social events (new follower, comment, reaction, etc.) — the
  existing `create_notification_if_enabled()` RPC + category system (messaging domain) is the
  right place to wire these; not done yet.
- Org-follow consolidation: `domains/marketplace/services/buyer-activity.ts`'s
  `followOrg`/`unfollowOrg`/`listFollowedOrgIds` predate this domain and still work; a generic
  `domains/social` follow API now also covers organisations. Not merged in this pass to avoid
  touching 3 working call sites unnecessarily.
- Section drag-reordering, richer theming, multi-language page content, analytics, Facebook/
  Instagram import assistant, custom-domain provisioning.
