# Moderation runbook

Real, tested mechanisms only — `dashboard.admin.moderation.tsx` (staff) and
`_public.moderation.$caseId.tsx` (affected user's own safe view) are real, live UI.

## Report intake

`submitReport()` (`reports` table) — real, rate-limited (`rate_limit_report_submission`). Reporter
identity is protected from the reported party by design (`"affected user sees their case only via
the safe view"`, `qual = false` on the base table for direct reads).

## Triage → case

`escalateReportToCase()` — a real report becomes a real `moderation_cases` row. Duplicate-case
protection is DB-enforced (a unique index on `report_id`, not just client logic), closed at Stage
YR-15 this session's own predecessor work.

## Claim and decide

`claimModerationCase()` (`claim_moderation_case` RPC) — atomic, server-actor-stamped, race-safe
(two moderators claiming simultaneously resolve to exactly one winner, tested).

**Self-conflict is enforced, not just a policy on paper**: as of this session's HF-3 fix, a
moderator whose own account is the case's `affected_profile_id` cannot claim or decide it — either
via the RPC or a raw update — confirmed by a dedicated regression test, not assumed.

## Decision and audit

`updateModerationCase()` sets status/decision/`decision_explanation`/`public_decision_summary`.
Notify the affected user (`notifyAffectedUserOfDecision()`) — routes through
`create_notification_if_enabled()`, which as of this session's HF-2 fix requires the caller to
genuinely be `is_moderator()` (covers admin) to notify an unrelated user; a moderator notifying the
case's own affected user is always allowed.

## Appeals

`submitModerationAppeal()` — the affected user's own real right, gated by
`affected_profile_id = auth.uid()` server-side (not just client logic), one appeal per case
(DB-enforced), only within a real deadline window. `reviewModerationAppeal()` explicitly rejects
the _same_ moderator who made the original decision reviewing its own appeal — independently
verified logic (not the same mechanism as the HF-3 fix, a separate, older, already-correct check).

## Real scenarios

- **Scam listing / harassment / false breeder profile**: report → escalate → claim → decide →
  notify. No special handling beyond the standard path.
- **The moderator is named in the case** (reported themselves, or the case concerns their own
  account): self-conflict lock applies automatically — the moderator literally cannot claim or
  decide it; an independent moderator must.
- **Appeal**: a genuinely different moderator reviews; the affected user sees the outcome via the
  safe view, never the raw case internals.
- **Emergency / urgent welfare concern**: this table has no distinct "emergency" fast path today —
  treat as immediate manual priority triage by whoever is on duty, not a system-enforced SLA (none
  exists to enforce).

## What this runbook does not claim

No emergency/priority queue mechanism, no SLA timer, no automatic staff paging — none of these
exist in the codebase. Don't promise them in a real communication until they're actually built.
