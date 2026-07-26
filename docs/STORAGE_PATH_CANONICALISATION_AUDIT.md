# Storage path canonicalisation audit

Stage XR-4 (append-only queue). Audited every Storage RLS policy across all 5 buckets
(`kennel-media`, `transport-documents`, `transport-evidence`, `message-attachments`,
`welfare-case-documents`) for path-canonicalisation risk: traversal, tenant mismatch, and object
substitution via a crafted path. **No new gap found** — a genuine, verified "already correct by
consistent design" outcome, not a claim made without checking.

## The convention is uniform across every bucket, verified directly

Every single policy in every bucket uses the exact same shape:
`(storage.foldername(name))[1]::uuid`, then checks that UUID against a domain-specific membership
predicate (`owns_org()`, `tr.requester_profile_id = auth.uid()`, `is_conversation_participant()`,
`is_org_member(wc.organisation_id)`, `is_assigned_driver_for_request()`). Confirmed by grepping
every `storage.foldername(` occurrence in `supabase/migrations/` — zero exceptions, zero buckets
with a different or ad-hoc path scheme.

## Why classic path traversal doesn't apply here

`storage.objects.name` is an opaque text column, not a real filesystem path — Postgres/Supabase
Storage never resolves `..` or `.` segments; `storage.foldername()` just splits the literal string
on `/`. A path like `{legit_id}/../{other_id}/file.txt` would have
`(storage.foldername(name))[1]` literally equal `{legit_id}` (the real first segment, unresolved),
so the RLS check still evaluates correctly against the caller's own real resource id — it can only
ever produce a confusingly-named object still fully scoped to the id that owns it, never a write
into a different tenant's actual folder. Not reachable through any real app upload path either
(every real uploader constructs its own path from a real UUID + sanitised filename, confirmed by
reading `uploadWelfareCaseDocument()`, the transport-document/evidence upload flows, and the
message-attachment upload flow — none ever accepts a raw user-supplied path).

## Uploader identity is never encoded in the path — by design, not oversight

None of the 5 buckets' path conventions include the uploader's own profile id as a path segment
(only the shared resource id — a transport request, a welfare case, a conversation, an
organisation). Uploader/actor identity is tracked in the corresponding metadata table row
(`uploaded_by`, `sender_profile_id`) instead, always server-derived from `auth.uid()` (already
audited and locked in earlier stages, e.g. `stamp_notification_actor`,
`prevent_requester_writes_to_document_review_fields`) — never trusted from the Storage path itself.
This means "canonical uploader path" as a concept doesn't apply to this schema's design at all;
there's no uploader-scoped subfolder to canonicalise.

## The one real historical bug in this exact class — already fixed, already regression-tested

`20260101006300_fix_driver_storage_column_shadowing.sql` (Stage BF, well before this queue) is a
real, previously-shipped instance of a path-canonicalisation bug: `(storage.foldername(name))[1]`
resolved the unqualified `name` to `drivers.name` (a driver's personal name column) instead of
`storage.objects.name`, because the policy joined `public.drivers d`, which happens to also have a
`name` column — a real column-shadowing bug, not a traversal bug, but the same broad category.
Already fixed by fully qualifying every affected reference as `storage.objects.name`, and already
covered by a real regression test (`tests/db/access-control.test.ts`, "assigned-driver document
access (fixed by 20260101006300, storage column-shadowing bug)"). Re-verified this stage: every
policy that joins a table also checked for a same-named `name` column on that joined table —
`welfare_cases` and `conversations` (the two tables joined by policies still using the bare,
unqualified `name`) have no `name` column at all (confirmed via `information_schema.columns`), so
no shadowing risk exists for either; every policy joining `drivers`/`transport_requests` (the
tables that *do* have real shadowing potential) already fully qualifies `storage.objects.name`.

## What this stage did not do

No code, migration, or test change — every real risk this stage's own definition names (traversal,
tenant mismatch, substitution, the shadowing bug class) was already either structurally impossible
given how Storage actually works, or already fixed and tested in an earlier stage. Building a new
test to "prove no traversal is possible" would test a Postgres/Storage platform behaviour this
schema doesn't control, not application logic — correctly not attempted.
