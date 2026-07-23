# Frontend query-key / cache map

Every React Query key used in public and buyer-facing frontend code on this branch, what it holds,
what invalidates it, and known dependent pages. Built by grepping every `queryKey: [...]` literal
across `src/routes/_public.*`, `src/routes/dashboard.buyer.*`, and shared components — not a
speculative framework, just documentation of what already exists so cache-key drift (the exact bug
class fixed twice this session — `saved-animal-ids`/`my-saved-animals` and `followed-profile-ids`/
`is-following-profile`) is easier to catch in review.

## Rule this map exists to enforce

**Whenever two query keys represent the same underlying server-side fact from the user's point of
view (e.g. "is X saved/followed"), every mutation that changes that fact must invalidate every key
that reads it.** Three real bugs of exactly this shape were found and fixed this session:

| Fact | Keys that must invalidate together | Fixed in |
|---|---|---|
| Saved animals | `saved-animal-ids`, `my-saved-animals` | `useIsSaved` in `cards.tsx` (already correct — this session's baseline) |
| Followed organisations | `followed-org-ids`, `my-followed-breeders`, `my-followed-foundations` | earlier session |
| Followed profiles (people) | `followed-profile-ids`, `is-following-profile` | this session, `_public.profile.$profileId.tsx` |

## Key-by-key inventory

| Key | Read by | Params | Mutated/invalidated by |
|---|---|---|---|
| `auth-state` | `use-auth.ts` (app-wide) | — | sign in/out actions |
| `my-roles` | role-gated routes | userId | role approval (backend) |
| `my-profile` | `dashboard.buyer.profile.tsx` | userId | profile update (same page) |
| `saved-animal-ids` | every card (`useIsSaved`) | userId | save/unsave (`useIsSaved`) |
| `my-saved-animals` | `dashboard.buyer.saved.tsx`, buyer overview preview | userId | save/unsave (`useIsSaved`) |
| `followed-org-ids` | community feed (`isFromFollowed`) | userId | follow/unfollow org |
| `my-followed-breeders` / `my-followed-foundations` | `dashboard.buyer.followed.tsx` | userId | follow/unfollow org |
| `followed-profile-ids` | community feed (`isFromFollowed`) | userId | follow/unfollow **profile** (`_public.profile.$profileId.tsx`) |
| `is-following-profile` | `_public.profile.$profileId.tsx` | userId, profileId | follow/unfollow profile (same page) |
| `my-puppy-application` / `my-adoption-application` | puppy/adoption detail pages | animalId, userId | application insert (same page) |
| `my-applications` | `dashboard.buyer.applications.tsx`, buyer overview | userId | withdraw application |
| `my-reservations` | `dashboard.buyer.reservations.tsx` | userId | backend-owned (breeder confirms) — read-only from here |
| `reservation-transport-requests` | same page | userId, animalIds | backend-owned transport state — read-only |
| `my-transport-requests` / `my-transport-drafts` | `dashboard.buyer.transport.tsx`, buyer overview | userId | draft delete (same page); submission is a separate route |
| `my-quotations` | `dashboard.buyer.quotations.tsx` | userId | accept/decline quotation (same page) |
| `my-conversations` | `dashboard.buyer.messages.tsx` | userId | polled every 10s (`refetchInterval`), not mutation-invalidated |
| `transport-conversation` | `dashboard.buyer.transport.tsx` `RequestCard` | requestId | — (opened on demand) |
| `my-notifications` | `NotificationBell` | userId | mark-read / mark-all-read (same component) |
| `my-org-verification` | `_public.create-breeder.tsx` | userId | new verification submission (same page) |
| `groups` / `my-group-ids` | `_public.community.groups.index.tsx` | userId (group-ids only) | join/leave group |
| `group-posts` | `_public.community.groups.$slug.tsx` | groupId | new post (same page) |
| `public-posts` | `_public.community.index.tsx` | — | new post (same page) |
| `post-comments` / `post-comment-counts` | community feed + group feed | postIds | new comment |
| `my-post-reactions` / `post-reaction-counts` | community feed + group feed | userId, postIds | like/unlike |
| `campaign-public-contributions` | fundraising detail (feature-flagged, disabled by default) | campaignId | new contribution |
| `all-published-puppies` / `breed-sizes` | `_public.find-your-dog.tsx` | — | static-ish, no mutation invalidates these (read-only discovery data) |
| `likely-route-match` | puppy detail transport estimate | destination | recalculated per input change, not cached across mutations |

## Known accepted non-invalidation

`my-conversations` relies on `refetchInterval: 10000` rather than mutation-driven invalidation —
acceptable for a near-real-time inbox where the buyer isn't the only actor who can add a message
(the other party, or operations, can also post), so no local mutation could invalidate it correctly
anyway. Documented here so a future reviewer doesn't mistake this for an oversight.
