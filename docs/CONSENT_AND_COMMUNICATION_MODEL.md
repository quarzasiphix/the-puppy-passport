# Consent and communication model

Real-beta Phase C. Verified against the live schema, not rebuilt — Bot 1's own independent audit
already confirmed this mechanism is genuinely well-built (`docs/HIGH_FINDING_CLOSEOUT.md`'s
cross-validation note); this documents its actual real scope.

## Legal document consent (terms / privacy / cookies)

`legal_document_versions`/`user_consents` (`20260101010200_legal_consent_versioning.sql`) — real,
tested, append-only. Recorded automatically at signup for the current version of each document
type. A user can view their own consent history (`"users view their own consent history"`); no
UPDATE/DELETE for ordinary users at all — consent history is immutable evidence of what was agreed
to and when. A user can only ever record consent to a version that's genuinely the current
published one (`with check` joins against `legal_document_versions.is_current`), never an
arbitrary string — closing the obvious forgery angle before it was ever a live bug.

**Content status, distinct from the mechanism**: the mechanism is real; the underlying `/terms` and
`/privacy` text is explicitly seeded as `"2026-07-24-draft"`, pending lawyer review
(`docs/PRODUCTION_READINESS_REPORT.md`). Publishing a new, final version later uses the exact same
mechanism (insert a new `is_current = true` row) — no new engineering required when that day comes.

## Notification category preferences (not the same thing as legal consent)

`notification_preferences` (`20260101008000_notification_preferences.sql`) covers exactly 4
categories: `applications`, `adoption`, `moderation`, `security`. This is an **opt-out** model
(unset defaults to enabled) for in-app notifications specifically, not a legal-consent record —
`security` is hard-coded to always-enabled regardless of any stored preference
(`get_notification_preference()`'s own special case), matching the product principle that mandatory
security notices must never be silenceable.

## Marketing and analytics consent: genuinely not needed yet, not a gap

There is no `marketing` or `analytics` category anywhere in this schema — not because consent
collection was skipped, but because **there is no marketing or analytics feature to consent to**.
Confirmed structurally, not assumed: zero analytics/CRM/email-marketing provider dependency exists
in `package.json` (`docs/FEATURE_LAUNCH_MATRIX.md`). Building a marketing-consent mechanism ahead
of an actual marketing feature would be exactly the kind of speculative architecture this session
has repeatedly avoided elsewhere — when a real analytics or marketing-email feature is built, add
its own category to `notification_preferences` (or a parallel table, if the shape doesn't fit)
following the same established pattern, gated behind real consent before the first send/track call.

## Cookie consent specifically

`legal_document_versions` already includes a `'cookies'` document type and records acceptance the
same way as terms/privacy. There's no cookie _banner_ UI yet (`_public.cookies.tsx` is a static
policy page, not an interactive consent prompt) — consistent with there being no analytics/tracking
script that would need gating behind one. If/when a real analytics provider is ever added, the
cookie-consent UI becomes load-bearing and would need to actually block that script until accepted;
today it would have nothing real to gate.

## Summary: nothing to fix here

This phase found no code gap. Consent versioning is real, correctly scoped, and already
independently verified by a separate audit method. Marketing/analytics consent's absence is
consistent with — not a gap alongside — the confirmed absence of any marketing/analytics feature.
