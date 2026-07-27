# Export and deletion consistency (Stage YR-12)

Cross-references `exportMyData()`'s 10 categories (`src/lib/queries/privacy.ts`) against what
`execute_account_deletion()` actually anonymises (Stage AI, re-verified against the live function
definition), superseding the equivalent, now-stale table in `docs/PRIVACY_DATA_LIFECYCLE.md`
(Stage O, written before account-deletion execution existed).

## The cross-reference

| Export category | Touched by `execute_account_deletion()`? | Why |
|---|---|---|
| `profile` | **Yes** — `display_name`/`first_name`/`last_name`/`email`/`phone`/`avatar_url`/`city`/`country` nulled, `is_deleted = true` | The one category this RPC exists to anonymise |
| `roles` (`user_roles`) | No | Not personal data — a role grant, not identifying content; retained so historical role context (e.g. "was this person an approved breeder at the time") stays accurate |
| `transport_requests` | No — request content (route, dates) untouched | Operational/audit-trail record; `transport_status_history`, `route_assignments`, and every audit-trail FK referencing this row would break under a hard delete (the exact FK-design finding `docs/PRIVACY_DATA_LIFECYCLE.md` already documented) |
| `reservations` | No | Same — a real commercial commitment's history, referenced by the seller's own records |
| `buyer_applications` | No | Same — a breeder/foundation's own application history for animals they manage references this |
| `saved_animals` | No | Not personal data beyond the FK itself; harmless to retain, no third party ever sees it (RLS-scoped to the owner only) |
| `route_waitlist_entries` | No | Operational record, same reasoning as `transport_requests` |
| `community_posts` | No — post content untouched | Retained the same way any social platform retains a deleted user's posts with an anonymised byline — the post's own RLS/public display already shows `profiles.display_name` (now null) wherever it's rendered, so no identity leaks through it |
| `sent_messages` | No — message body untouched | The other party's own conversation history; deleting content out from under them would corrupt *their* record, not just the deleted user's |
| `notifications` | No | Purely the (now-anonymised) user's own inbox; no third party ever sees it |

**Only `profile` is anonymised. Every other category is deliberately, explicitly retained** — this
matches the exact FK-safety reasoning `docs/PRIVACY_DATA_LIFECYCLE.md` already established
("never a hard delete... audit-trail FK columns have no ON DELETE action") and is the correct
design, not a gap: a "right to erasure" request is answered by anonymising the identifying profile
fields, not by corrupting other people's operational records or breaking referential integrity
across the schema.

## "Data visible in export is either removed, anonymised or explicitly retained under documented product integrity rules" — now true by this document's own existence

Before this stage, that retention decision was implicit (the FK-safety reasoning existed, but
nothing enumerated *which specific export categories* it applies to). This document is that
enumeration — the table above is the "documented product integrity rules" this stage's own
definition asks for.

## "Prevent export after deletion from reconstructing public identity" — checked, no gap

`exportMyData()` is always called by the subject about themselves (RLS-scoped to `auth.uid()` on
every query inside it) — it is never a path for a *third party* to learn a deleted user's former
identity. A deleted user's own historical posts/messages/requests still contain their real content
(by design, above), but rendering them anywhere in the app already displays the now-nulled
`profiles.display_name` — there is no separate code path that would reconstruct the original name
from the export or from any public view. Nothing to fix.

## "Respect legal holds and unresolved obligations" — already enforced upstream

`execute_account_deletion()` already refuses to run at all while an active legal hold or unresolved
obligation exists (transport request, reservation, application, organisation ownership — Stage AI,
re-verified). Since deletion itself is blocked, `exportMyData()` never needs its own separate
legal-hold check — there is no "half-deleted" intermediate state for it to encounter.

## Verification

- No code change this stage — a genuine cross-reference/documentation deliverable, matching what
  the stage's own definition asks for. Every claim above was checked against the live function
  definitions and query files, not carried over from the stale `docs/PRIVACY_DATA_LIFECYCLE.md`
  table.
