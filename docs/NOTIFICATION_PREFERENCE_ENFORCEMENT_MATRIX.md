# Notification preference enforcement matrix (Stage YR-2)

Complements `docs/NOTIFICATION_PRODUCER_INVENTORY.md` (Stage YR-1), which maps every notification
producer to its category. This document is the other half: for each of the 4 real categories, is
it optional or mandatory, and — the actually security-relevant question — *where* is that
enforced.

## The matrix

| Category | Optional or mandatory | Enforced where | UI control |
|---|---|---|---|
| `applications` | Optional (defaults to enabled) | `get_notification_preference()` reads the stored row, defaulting to `true` if none exists | Toggle in `NotificationPreferences` |
| `adoption` | Optional (defaults to enabled) | Same | Toggle |
| `moderation` | Optional (defaults to enabled) | Same | Toggle |
| `security` | **Mandatory — cannot be disabled** | `get_notification_preference()` hard-codes `return true` before ever reading the stored row for this category (`20260101008000_notification_preferences.sql`) | Toggle rendered but `disabled`, labelled "(always on)" — a UI convenience only, not the real boundary |

## Where enforcement actually happens (and where it deliberately does not)

`get_notification_preference()` is called exactly once per notification, from inside
`create_notification_if_enabled()` — a single `SECURITY DEFINER` RPC that is the *only* insert
path into `public.notifications` reachable from client code (confirmed: `notifications`' own RLS
INSERT policies are all `is_admin()`/`is_ops_staff()`-gated or actor-locked, never open to a plain
"insert your own notification" path — see `20260101002100_platform.sql`,
`20260101003900_notifications_admin_create.sql`,
`20260101004900_notifications_org_owner_notify_applicants.sql`).

This is real server-side enforcement, not merely a UI convention:
`tests/db/notification-preferences.test.ts` proves `get_notification_preference()` itself is not
directly callable at all (Stage XR-2's grant lock) — a client can only ever observe its effect
through `create_notification_if_enabled()`'s own return value (a real id, or `null`), never query
or bypass the check directly.

**Deliberately not re-checked at read time**: the `notifications` SELECT policy ("users manage
their own notifications") is pure ownership (`profile_id = auth.uid()`), with no join back to
`notification_preferences`. This is correct, not a gap — preference is a *creation-time* gate
("should this event become a notification at all"), never a *visibility* filter on notifications
that already exist. `tests/db/notification-preferences.test.ts` now proves this explicitly:
disabling a category after a notification already exists leaves that notification completely
untouched (still readable, still mark-as-read-able, never retroactively hidden or deleted) — the
exact "prevent preference changes from mutating historical queued events unexpectedly" property
this stage's own definition asks for. There is no delivery/outbox pipeline in this app (confirmed
repeatedly, XR-10/XR-11/XR-12) that would ever revisit a past notification row, so this property
holds structurally, not just by the current test's luck.

## "Legal-hold, account, ownership-transfer and critical transport messages cannot be disabled"

Checked against the real producer inventory (Stage YR-1): **none of these currently produce a
notification at all** — the only 5 real producers are rehoming approval/rejection, application
status change, and moderation decision/appeal decision. There is nothing to make mandatory that
doesn't exist yet. This was checked, not assumed: grepped every `notifyUserFromTemplate`/
`notifyUser` call site (5 total, all already inventoried) and confirmed none relate to legal
holds, account lifecycle, ownership transfer, or transport status. Building speculative
notification producers for workflows that don't currently notify anyone, just to have something to
mark "mandatory," would be exactly the invented-scope this session's standing discipline avoids.
If any of those four areas gets a real notification producer in the future, it should default to
`security` (the one already-correct mandatory category) rather than inventing a fifth category.

## Verification

- New test in `tests/db/notification-preferences.test.ts`: creates a real notification, disables
  its category afterward, and proves the notification is completely unaffected (still exists,
  still correct content, still normally mark-as-read-able) — the retroactivity property.
- Existing coverage in the same file (unchanged, re-verified) already proves: default opt-in,
  per-category suppression, `security`'s unconditional override (including a direct attempt to
  disable it on the stored row), cross-user isolation on the preferences table itself, and a real
  call site (`application_status_change`) respecting the live preference.
- `npx tsc --noEmit`, `npx eslint tests/db/notification-preferences.test.ts` — clean.
- Full `npm run test:db` — see commit for exact count, verified on a fresh reset plus one more run
  without reset.
- No migration this stage (no schema/RLS change — this stage found existing enforcement already
  correct and closed a real test-coverage gap in the "history isn't retroactively affected"
  property, plus documented the matrix itself).
