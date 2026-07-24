# Incident Runbooks

Stage BY of the autonomous backend-hardening session (see `docs/AUTONOMOUS_BACKEND_PROGRESS.md`).
No production deployment, on-call rotation, or paging tool exists yet — this is a procedural
reference for whoever operates this system once one does, built entirely from mechanisms this
session actually verified exist (RLS policies, the `/health` endpoint, `audit_logs`, `risk_signals`,
`rate_limit_events`), not a claim that any of these procedures have been exercised against real
production traffic. For a bad-migration incident specifically, see
`docs/BACKUP_AND_DISASTER_RECOVERY.md`'s "Incident response" section (fix-forward only, never edit
a committed migration) — not duplicated here.

## 1. `/health` reports `degraded` / database unreachable

**Symptom**: `GET /health` (Stage BW) returns `503 {"status":"degraded","database":"unreachable"}`,
or every request is failing/timing out.

1. Confirm it's real, not a transient blip: hit `/health` a few times over a short window before
   escalating — a single 503 could be a momentary connection hiccup.
2. Check the Supabase project's own status (dashboard/status page) — this is almost always either
   the Supabase project being paused/down, a connection-string/credential change, or the project
   hitting a plan-tier connection limit, not an application bug (the app itself has no local state
   to corrupt; it's a stateless Cloudflare Worker).
3. If the project is up but still unreachable from the Worker: check whether `VITE_SUPABASE_URL`/
   `VITE_SUPABASE_ANON_KEY` (baked in at build time, per `src/lib/supabase/browser.ts`) match the
   current project — a rotated anon key or a project migration would silently break every request,
   not just `/health`.
4. This is infrastructure-level, not a code fix — there is nothing in this repository to "roll
   back" for a Supabase-side outage.

## 2. A specific RPC is failing for all/most callers

**Symptom**: one workflow (e.g. transport request submission, an ops status change) errors
consistently, while `/health` still reports healthy.

1. Reproduce directly against the RPC via the Supabase client or `npx supabase db query --local -f
   <file.sql>` (the actual diagnostic tool used throughout this session — see
   `docs/DATABASE_TESTING.md`) to get the real Postgres error, not just what the frontend shows
   (Stage BQ's `getFriendlyErrorMessage()` deliberately hides raw technical detail from end users —
   don't diagnose from a toast message).
2. Check `audit_logs` (Stage AE, actor-locked, non-forgeable) for the actual sequence of recent
   writes around the failure window if the RPC is one that logs there (moderation claims, support
   case claims, ops status changes, account deletions).
3. If it's a genuine bug: fix-forward with a new migration (`create or replace function`), never
   edit a committed one — same convention as the bad-migration runbook.
4. If it's a rate-limit rejection being mistaken for a bug: see runbook 3 below.

## 3. Legitimate users are being rate-limited / flagged as risky

**Symptom**: a real user reports "you've done this too many times recently" (the standard
rate-limit message, Stage J) or an account has a `risk_signals` entry that turns out to be a false
positive (Stage BN).

1. Confirm which action and actor: `rate_limit_events` (admin-readable) shows exactly which
   `action_key` and how many recent attempts; `risk_signals` (ops-readable via `is_ops_staff()`)
   shows which threshold was crossed and includes a plain-language `explanation` — both are
   designed to be read by a human making this exact call, not just machine-parsed.
2. **There is currently no manual "reset this user's rate limit" RPC.** The only way a legitimate
   user's limit clears is the window itself elapsing (Stage BU's pruning happens automatically on
   their next attempt after the window passes) — a real, honest gap: if a limit is set too tight
   for a genuine burst of legitimate activity, the only immediate fix today is widening the
   `max_count`/`p_window` argument at the specific `perform enforce_rate_limit(...)` call site (a
   real migration, not a runtime toggle) and waiting for the window to naturally clear.
3. For a `risk_signals` false positive: use `mark_risk_signal_reviewed(p_signal_id, p_is_false_positive
   := true, p_resolution_notes := '...')` — this only ever annotates the record, it never had any
   automatic consequence to begin with (Stage BN's signals are advisory-only by design), so there is
   nothing else to "undo."

## 4. Suspected account compromise or abuse

**Symptom**: a report, moderation case, or risk signal suggests an account is being used
maliciously (credential-stuffed, coordinated abuse, etc.).

1. Suspend the specific role, not the whole profile: `user_roles.status` (already the mechanism
   this session repeatedly tested — see the "suspended role" tests across ops/driver/org-owner
   roles in `tests/db/workflows.test.ts`) revokes role-gated access immediately at the RLS layer,
   without touching the account's other data or requiring account deletion.
2. Every staff action taken during the investigation is already attributable: `audit_logs.
   actor_profile_id` is server-stamped from `auth.uid()`, never client-supplied (Stage AE) — the
   investigating staff member's own actions are on the same non-forgeable record as the incident
   itself.
3. For a suspected full account takeover requiring permanent removal: `account_deletion_requests` →
   `execute_account_deletion()` (Stage AI) anonymizes the profile, but **refuses while a real
   unresolved obligation exists** (an active transport request, reservation, application, or
   un-transferred organisation ownership) — resolve or reassign those first, the function will not
   silently skip them.
4. This is not a payments/fraud runbook — no payment provider is integrated yet
   (`docs/FUNDRAISING_POLICY.md`, `fundraising_contributions.is_simulated` is always forced true at
   the RLS layer), so there is no real financial-fraud surface to respond to today.

## 5. A private/internal document or address appears to have leaked publicly

**Symptom**: an exact pickup/delivery address, an uploaded document, or an internal moderation note
shows up somewhere it shouldn't.

1. Check the relevant RLS policy first, not the frontend — every one of these fields is meant to be
   protected at the database layer independent of any UI (`pickup_address_exact`/
   `destination_address_exact`, `transport_documents`/`welfare_case_documents` Storage buckets,
   `messages.is_internal`/`support_case_messages.is_internal`). If RLS is correct and only the
   frontend displayed something it shouldn't have, that's a frontend bug, not a database breach —
   scope the investigation accordingly before assuming a wider compromise.
2. If it is a real RLS gap: this is the single most common bug class this session found and fixed
   repeatedly (a policy checks row ownership but not a specific column's value, or a GRANT is
   missing despite RLS being correct) — see `docs/AUTONOMOUS_BACKEND_PROGRESS.md`'s stage table for
   the exact shape of every prior instance before assuming this one is novel.
3. Signed URLs (Storage documents) expire quickly by design (5 minutes, Stage AO/S) — a leaked
   signed URL self-expires; a leaked *bucket-public* object would not, so check `storage.buckets.
   public` for the specific bucket involved before assuming the leak is time-limited.

## What this document deliberately does not claim

- That any of these procedures have been exercised against a real incident — none has, because
  there is no production deployment yet.
- A specific escalation contact, paging tool, or SLA response time — no on-call rotation exists;
  that's an organisational decision for whoever operates this in production, not something to
  invent here.
- Coverage of infrastructure this repository doesn't control (Cloudflare-side outages, DNS,
  Supabase's own infrastructure) beyond "check its status page first."
