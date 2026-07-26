# Export object lifecycle audit

Stage XR-14 (append-only queue). Audited `exportMyData()` (`src/lib/queries/privacy.ts`) — the
only real data-export feature in this app — for the concrete lifecycle concerns this stage names:
object ownership, signed access, expiry, forbidden data, and duplicate files.

## Not applicable as a Storage-object lifecycle — confirmed, not assumed

`exportMyData()` performs a set of direct, RLS-scoped database reads (`get_my_profile()`,
`user_roles`, `transport_requests`, `reservations`, `buyer_applications`, `saved_animals`,
waitlist entries, `posts`, sent messages excluding internal notes, `notifications`) and returns
the assembled JSON **directly to the caller in the same request** — confirmed by reading the full
function body. There is no Storage bucket, no generated export file, no signed URL, and no
asynchronous "your export is ready" flow anywhere in this codebase. Every one of this stage's named
concerns (object ownership, signed access, expiry, duplicate files) describes protecting a
generated *file* that outlives the request that created it — there is no such file here to
protect.

## The real, already-closed concerns for this export — cross-referenced, not re-audited

Already covered by an earlier stage (referenced in `docs/AUTONOMOUS_BACKEND_PROGRESS.md`'s own
prior entry for this feature): every query inside `exportMyData()` is filtered by the caller's own
id column, reports/moderation notes/internal messages/other-tenant data are never selected at all,
and a forged `userId` argument (simulating a client bug) still can't pull another user's data —
proven by `tests/db/data-export.test.ts`. Not re-duplicated here.

## What would need to exist before this stage's own definition becomes applicable

If a future data-export feature ever generates a real downloadable file (e.g. a large CSV/ZIP
written to Storage for a genuinely large account's history, rather than a synchronous JSON
response), the concrete requirements this stage names should be designed in from the start: the
file's Storage path scoped to the exporting user only, a signed URL with a bounded TTL (matching
the 300-second pattern already established for every other private bucket in this schema — see
`docs/SIGNED_URL_PERMISSION_LOSS.md`), a real expiry/cleanup policy so old export files don't
accumulate indefinitely, and de-duplication so repeated export requests don't leave multiple stale
copies of the same data. Not designed speculatively here — no real trigger for building it exists
yet (nothing in this schema's current scale needs an async export path over a synchronous one).
