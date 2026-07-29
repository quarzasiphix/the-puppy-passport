# Security-preservation static audit (Phase 22)

## Scope and an honest limitation, stated up front

The five former High findings (HF-1 through HF-5) are enforced at the **database layer** — RLS
policies and triggers, not frontend code discipline — and are already directly tested by dedicated
attack-scenario tests in the 1062-test DB/API suite (real actor, real bypass attempt, real
assertion the write is rejected or silently corrected). A static grep over frontend source code
cannot prove or disprove an RLS policy's correctness; it can only check that the frontend doesn't
*additionally* attempt something suspicious. Building an automated "security guard" script that
implies frontend-code inspection verifies these protections would overstate what static analysis
can actually show — the DB test suite is the real verification, and it already exists. This section
is a manual spot-check for defense-in-depth, not a claim that this replaces the real DB tests.

## What was checked

- **No service-role key or client anywhere in `src/`** (`grep -rln "SERVICE_ROLE" src/`) — clean,
  zero matches. Browser-reachable code never has service-role access, as expected.
- **`accepted_by_customer` (HF-4)** — only 3 references in `src/lib/queries/transport.ts`, all
  read-only (a status-ordering map, a switch-case label, a display-label map). No
  `.update({ accepted_by_customer: ... })` write pattern anywhere in `src/`. The real acceptance
  path goes through `respond_to_quotation()`, an atomic RPC — confirmed untouched by the 52-commit
  frontend integration (not in the conflict ledger, no diff against backend main).
- **`achievements` table writes (HF-5)** — `dashboard.admin.achievement-verification.tsx`'s
  `.update()` calls (setting verification status) are in an admin-only route, but the actual
  security boundary is the `achievement_self_verification_lock` migration/RLS policy, not which
  file calls the update — any client, admin UI or otherwise, is bound by the same RLS regardless.
  `breeder.ts`'s `.from("achievements").insert(payload)` (a breeder submitting a new achievement
  claim) passes through the generated `Insert` type without hardcoding a `verified` flag; even if a
  malicious client crafted a request setting `verified: true` directly, HF-5's RLS lock is what
  actually rejects it — confirmed by the dedicated DB test for this exact scenario.
- **`account_deletion_requests` (HF-1)** — 4 call sites in `src/lib/queries/privacy.ts`; the
  processing call (`markDeletionRequestProcessed`) already uses the current 2-argument form
  (confirmed during integration's own Phase 8 check — see `docs/INTEGRATION_FINAL_REPORT.md`), not
  the old 3-arg form that could pass a client-supplied actor.
- **`moderation_cases` decision writes (HF-3)** — `updateModerationCase()`'s single `.update()`
  call site was already reviewed during integration conflict resolution (ledger entry — not part of
  the 52-commit set, untouched); the self-conflict lock is DB-side (`moderation_case_self_conflict_lock`
  migration), same reasoning as achievements above.
- **Raw error-message rendering in public routes** — found one `error.message` render in
  `_public.reset-password.tsx`. Investigated rather than assumed a bug: this is
  `supabase.auth.updateUser()`'s own error, not a PostgREST/database error. Supabase Auth errors
  are curated, human-readable API responses by design (e.g. "Password should be at least 6
  characters") — a fundamentally different risk class from raw Postgres/PostgREST errors (which can
  leak constraint/column/policy names, exactly what `getFriendlyErrorMessage()` exists to guard
  against). Confirmed this is the established, consistent pattern across the whole codebase —
  `src/lib/auth/actions.ts`'s `signIn`/`signUp` server actions do the same (`return { error:
  error.message }` from `supabase.auth.*` calls specifically). Not a gap; left unchanged.

## Conclusion

No frontend-side regression found for any of the five former High findings. The real assurance for
all five remains the DB-layer RLS/trigger tests, unchanged by this hardening branch and re-run as
part of Phase 24/26.
