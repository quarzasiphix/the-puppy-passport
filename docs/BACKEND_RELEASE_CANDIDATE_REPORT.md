# Backend Release-Candidate Report — First Supplemental Queue (Stages R–AP)

Stage AP of the autonomous backend-hardening session (see `docs/AUTONOMOUS_BACKEND_PROGRESS.md`
for the full per-commit log). Closes the first supplemental queue. The session continues directly
into the second supplemental queue (Stage BA onward) per the standing instruction not to stop —
this report is a checkpoint, not an end-of-session summary.

## Verification results (re-run fresh for this report, not carried over from memory)

- **Starting HEAD** (end of the original queue, Stage Q): `594116f` → **ending HEAD** (Stage AO):
  `e4c6e44`.
- **Migration count**: 98 files, **no duplicate numeric prefixes**
  (`ls supabase/migrations/*.sql | sed -E 's#.*/([0-9]+)_.*#\1#' | sort | uniq -d` → empty).
- **Fresh `supabase db reset`**: applies all 98 migrations and seed data cleanly.
- **`npm run test:db`**: **490/490 passing**, verified on a fresh reset and again without reset
  (two full consecutive clean runs for this report specifically).
- **`npx tsc --noEmit`**: clean, zero errors.
- **`npm run build`**: clean, zero errors/warnings, Cloudflare Worker output generated.
- **`src/routeTree.gen.ts`**: consistent with a fresh build (`git diff --quiet` after `npm run
  build`).
- **Full-repo `npm run lint`**: **38 errors, 13 warnings** — the exact same pre-existing baseline
  first documented at Stage K and re-verified at Stage Q, entirely in untouched, frontend-owned
  files. No new lint regressions across the whole R–AP range.
- **No push, deploy, or production mutation performed** — every change is a local commit only.
- **`ux-marketplace-frontend-pass`/its worktree were never entered or modified** — confirmed via
  `git worktree list` at the start of this queue and no file operations targeting that path at any
  point in R–AP.

## Stages R–AP: what actually changed (real findings, not busywork)

Ten stages produced a real code/schema fix, each with a positive-and-negative regression test.
Nine stages audited a real subsystem and found the existing design already correct — reported
honestly as "no fix needed" rather than manufacturing a change to have something to commit. One
stage (AC) found a genuinely unbuilt feature (no email delivery exists at all) and correctly
deferred it rather than inventing a provider integration without real credentials.

**Real gaps found and closed** (chronological):

1. **R — Messaging**: a conversation participant could self-mark their own message
   `is_internal = true`, spoofing a trusted ops-only note channel.
2. **S — Attachments**: `messages.attachment_url` existed but was completely unwired (no bucket,
   no RLS, no UI) — built the missing backend layer plus a real, minimal UI.
3. **T — Listing lifecycle**: two self-approval bugs — an owner could insert their own
   `rehoming_reviews` row pre-approved (bypassing moderation for private-rehoming listings), and a
   buyer could insert their own `buyer_applications` row pre-approved (bypassing org review).
4. **W — Search/discovery**: indexed the public marketplace's actual hot query columns
   (`is_published`, `org_type`/`verification_status`/`is_public`), none of which were indexed.
5. **Z — Quotation/pricing**: closed a real test-coverage gap (zero tests existed for
   `pricing_rules` RLS or for a customer's complete inability to insert a quotation).
6. **AA — Fundraising**: an organisation could self-declare its own campaign `target_reached`/
   `partially_funded` — outcome states meant to reflect real fundraising activity, not
   self-reported, shown publicly with no correlation to the real collected total.
7. **AD — Transactional domain events**: `changeOpsRequestStatus()` did three non-atomic
   client-side writes (one with an unchecked error) and trusted a client-supplied actor —
   replaced with one atomic, server-actor-stamped RPC.
8. **AE — Audit-log quality**: `audit_logs`' INSERT policy never restricted `actor_profile_id` —
   any ops account could credit a different profile as an entry's actor, project-wide. Also fixed
   `assignRequestToRoute()`'s identical non-atomicity/forgeable-actor shape.
9. **AG — Idempotency/concurrency**: three real races — reservations had no per-animal uniqueness
   (a genuine double-sell race), and both conversation-starting RPCs had classic check-then-insert
   races producing duplicate conversations under concurrent calls.
10. **AI — Deletion execution**: account deletion was request-tracking only; built the real
    anonymisation RPC (never a hard delete, per Stage L's FK-constraint finding), with concrete
    unresolved-obligation blockers.
11. **AO — Security red-team**: the most serious single finding this queue — `transport_documents`
    had zero column restriction for the requesting party, allowing self-approval forgery and,
    worse, **document substitution after a real ops approval** (swapping the underlying file while
    the row still showed the original approval). Also closed a smaller ops-to-ops actor-forgery gap
    in the same fix.

**Confirmed already correct, documented, no code change** (U, V, X, AB, AF, AJ): multi-species
foundation, taxonomy tables, application/handover state-machine boundaries, fundraising
compliance-flag gating, feature-flag/market-config wiring, and support tooling — each audited
against the same rigor as the fixes above, each with a specific, checkable reason nothing needed
to change.

**Genuinely unbuilt features, correctly deferred rather than faked** (Y, AC): ownership-transfer
recording (no code path anywhere actually transfers `animals.owner_profile_id` yet — a missing
business action, not a missing audit trail) and email delivery (no provider integration exists at
all, and building one needs real credentials this session cannot use).

**Non-code stages** (AK, AL, AM, AN — documentation, migration re-audit, test factory, load
readiness): each produced a real, verified artifact — a new `docs/BACKUP_AND_DISASTER_RECOVERY.md`,
a re-confirmed migration-safety audit plus a newly-documented `CREATE INDEX CONCURRENTLY`
limitation, a shared test factory closing real duplication across 5 files, and a confirmed (not
assumed) finding that ops/admin list queries are already bounded by `supabase/config.toml`'s
`max_rows = 1000` — with the real follow-up flagged that this config doesn't automatically carry
over to production.

## Test suite growth this queue

395 → 490 tests (+95), across 11 new test files, all verified for repeatability (fresh reset + at
least one more run without reset every stage; a third run for the concurrency-touching stage AG).

## Known open items carried forward into the second supplemental queue

See `docs/AUTONOMOUS_BACKEND_PROGRESS.md`'s "Known open items carried forward" section for the
full, current list, kept there rather than duplicated here to avoid the two drifting apart. As of
this report, the list includes: no state-machine enforcement on driver-set transport status
transitions (Stage M finding, explicitly reserved for the dedicated later state-machine stages),
~127 unindexed foreign-key columns (Stage N finding, deliberately not indexed without real usage
data), marketplace search's unpaginated full fetch (Stage W finding, blocked on frontend-owned
files), no ownership-transfer business action (Stage Y), no email delivery provider (Stage AC), and
support-case management explicitly deferred to Stage BL.

## Launch status

Unchanged from Stage P's reconciliation: the two real remaining launch blockers are both
business/account steps (a production Supabase project, a production Cloudflare deployment), not
code gaps. Nothing in this queue touched either.

## Next

Per the standing instruction, this session continues directly into the second supplemental queue
(Stage BA onward — background jobs and scheduler foundation) without pausing here, followed by the
third and fourth supplemental queues (Stages CJA–CJZ, CKA–CKZ) appended mid-session.
