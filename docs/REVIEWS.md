# Reviews (permanent, reservation-anchored trust record)

Status: **live**, applied 2026-09-11 as `supabase/migrations/20260911000100_reviews_and_gallery.sql`
(that migration also adds the standalone gallery — see `docs/STORAGE_AND_MEDIA.md` /
`docs/BREEDER_SITE_SDK.md` for that half). Built at the user's explicit direction: *"users who
actually reserve puppies in the future can leave public reviews that can't be deleted."*

## Model

A review (`public.organisation_reviews`) is either:

- **`source='platform'`** — created by `submit_reservation_review()` for a buyer's own
  **`completed`** `reservations` row → `verification_level='verified_buyer'`. This is the **only**
  way a new review is ever created. There is no anonymous or unverified review-creation path.
- **`source='legacy_import'`** — hand-backfilled from a breeder's pre-Anemalo site (e.g. GRYFIN
  YORK's testimonials). `verification_level` stays `'unverified'` — no Anemalo reservation exists
  for a pre-platform purchase. **GRYFIN's 19 legacy testimonials are not backfilled yet** — this
  session only captured a summary (sample author names, "all rating 5") in
  `.gryfin-migration/snapshot.json`, not the verbatim content per row, and fabricating review text
  attributed to real people would be wrong. Backfill once the exact rows are re-read from the
  Gryfin project (reconnect Supabase MCP to `eqggerrzfwlfqibcdyjy`) — see `docs/GRYFIN_IMPORT.md`.

## Immutability

**No UPDATE/DELETE RLS policy exists for `authenticated` at all.** Every write goes through one of
three `SECURITY DEFINER` RPCs, each touching only its own fields:

| RPC | Who | Touches |
|---|---|---|
| `submit_reservation_review(reservation_id, rating, content, photo_url?)` | the buyer, once per completed reservation (unique index on `reservation_id`) | inserts the row |
| `respond_to_review(review_id, response)` | any active `organisation_members` row (`is_org_member`) | `breeder_response` / `breeder_response_at` only |
| `set_review_moderation_status(review_id, status, reason?)` | admin/ops (`is_admin() or is_ops_staff()`) | `moderation_status` only — **hides, never deletes**; logs an `audit_logs` row |

Content, rating, author, reservation link — none of it can change after creation, and nothing in
the API deletes a row. Genuine legal erasure (GDPR) is a manual, superuser SQL action entirely
outside RLS, deliberately not exposed as an application feature.

Public reads (`anon`/`authenticated`) see `moderation_status='visible'` reviews of approved+public
kennels; a reviewer can always see their own regardless of moderation state; admins see all.

## The gateway projection

`api.anemalo.com/v1/site-content` returns `reviews[]` — an anon-safe column list
(`reviewer_display_name, rating, content, photo_url, source, verification_level,
breeder_response, breeder_response_at, published_at, animal_id`), deliberately **without**
`reservation_id` or `reviewer_profile_id`. Ordered most-recent-first.

## Not built yet

- The buyer-facing UI to call `submit_reservation_review()` after a reservation reaches
  `completed` (no route/component exists — the RPC and gateway projection are ready for it).
- A breeder-panel screen to call `respond_to_review()`.
- An admin/ops moderation screen for `set_review_moderation_status()`.
- Photo attachment: `submit_reservation_review`'s `p_photo_url` expects an already-uploaded URL.
  **Not a trivial reuse of `media.upload`** — that route's `requireOrgMember` step authorizes an
  *org member* uploading their *kennel's* media; a review photo is uploaded by the *buyer*
  reviewing a kennel they don't belong to. Needs its own auth shape (e.g. `requireAuth` only,
  keyed by the reviewer's own profile id or the reservation id, not `orgId`) — design when the
  review-submission UI is built, not before.
- GRYFIN's 19 legacy testimonials (above).
