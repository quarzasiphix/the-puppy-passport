# Trust domain

Covers two separate but related systems: **organisation trust claims** (self-reported credentials
with an admin-verified status) and the **reports → moderation cases → appeals** pipeline. Not the
same thing as `user_verifications` (identity/breeder/driver approval, owned by `identity`) — see
`services/trust-claims.ts:3-8`'s own note on the boundary: "'Identity verified' and 'Kennel
verified' are NOT part of this table... this file only covers the three claims with no existing
home: association, pedigrees, health_documents."

## What this owns

- `organisation_trust_claims` (write path not in this domain — only read via the
  `public_organisation_trust_claims` view, `services/trust-claims.ts:54`). Claim types:
  `association | pedigrees | health_documents` (`services/trust-claims.ts:10`). Statuses:
  `unverified | pending | verified | rejected`.
- `reports` — `submitReport`/`listReports`/`dismissReport` (`services/moderation.ts:17-83`).
  Target types: `animal_listing | organisation | post | message | user`
  (`services/moderation.ts:4`).
- `moderation_cases` — `listModerationCases`/`updateModerationCase`, plus RPCs
  `escalate_report_to_case` and `claim_moderation_case` (the latter added specifically to fix a
  race + a forgeable-actor bug in a former plain client-side UPDATE, see
  `services/moderation.ts:139-143`).
- `moderation_appeals` — `getMyAppealForCase`/`submitModerationAppeal` (RPC
  `submit_moderation_appeal`) on the affected user's side, `listAppealsForCase`/
  `reviewModerationAppeal` (RPC `review_moderation_appeal`) on the moderator's side.
- `my_moderation_case_view` — the affected user's own safe read of their case
  (`getMyModerationCase`, `services/moderation.ts:175-184`), backing `_public.moderation.$caseId.tsx`
  (not in this domain, but the only current discovery path per the comment at
  `services/moderation.ts:150-152`).

## File structure

- `index.ts` — re-exports `services/moderation`, `services/trust-claims`,
  `components/report-dialog`, `components/verification-review-list`.
- `services/moderation.ts` — everything under "What this owns" above except trust claims. Also two
  notification helpers, `notifyAffectedUserOfDecision` and `notifyAppellantOfAppealDecision`, both
  needed because the underlying RPCs "never notify... the client makes a second call after the
  write succeeds" (`services/moderation.ts:253-254` — found as a real gap: "an appellant previously
  had no way to learn their appeal was resolved").
- `services/trust-claims.ts` — the three-claim read model described above; write path (submitting
  a claim, admin verifying it) is not implemented in this file — only public/aggregate reads.
- `components/report-dialog.tsx` — the "Report" button + reason picker used across animal listings,
  organisation profiles, posts, messages and users. Hardcoded English `reasonLabels` map keyed by
  `ReportTargetType` — **not i18n'd** (matches the "many hardcoded-English shared label maps" class
  of gap already being fixed elsewhere this session, e.g. `applicationStatusLabels`).
- `components/verification-review-list.tsx` — shared admin approve/reject list for `breeder`/
  `organisation` `user_verifications` rows (used by `dashboard/admin/breeder-verification.tsx` and
  `foundation-verification.tsx`). This is the **`user_verifications` review UI, not a
  `moderation_cases` review UI** — despite living in this domain, it's a different pipeline than
  the reports/cases system above. As of 2026-09-12 its reject action calls the new
  `reject_user_verification` RPC (added this session) rather than a raw table update.
- `components/moderation-panel.tsx` (added 2026-09-12) — `ModerationPanel`, the moderation-cases
  review UI referenced as missing below until this pass. Renders `listModerationCases()`, the
  existing claim/resolve/appeal-review flow, **plus real enforcement actions** per `target_type`:
  hide/unhide a post, unpublish/republish an `animal_listing`, suspend/reinstate an `organisation`.
  `dashboard/admin/moderation.tsx` is a thin wrapper around this one component (there is no
  separate moderator dashboard — see the note below).
- `components/reports-panel.tsx` (added 2026-09-12) — `ReportsPanel`, same extraction pattern for
  the reports-triage UI, wrapped by `dashboard/admin/reports.tsx`.

## Public API

`index.ts` exports all of the above flatly — no curation, the whole domain surface is public.

## Known gaps

- `report-dialog.tsx`'s `reasonLabels` (and the dialog's own UI strings — "Report this", "Send
  report", etc.) are hardcoded English, not wired to `useTranslation()`. Same for the new
  `moderation-panel.tsx`/`reports-panel.tsx` — deliberately left in English, matching this
  project's own rule that internal staff tooling (ops/admin/moderator) stays untranslated; only the
  customer-facing edge is localized.
- Trust-claim **submission** (a breeder actually filing an `association`/`pedigrees`/
  `health_documents` claim with evidence) and **admin verification of a claim** are not present in
  `trust-claims.ts` — only the public read side (`getPublicTrustClaims`/`getTrustClaimMap`) exists
  here. Where/whether a write path exists elsewhere in the codebase was not checked in this pass.
  The WNI (weterynaryjny numer inspektoratu) proposal in `docs/BREEDER_VERIFICATION_AND_TRUST.md`
  would add a 4th claim type here (`veterinary_registration`) — not built yet.
- **Resolved 2026-09-12** (was open until this pass): moderation-case decisions used to only ever
  write a free-text `decision` string — nothing actually happened to the reported content, and no
  RLS policy let a plain moderator write to `posts`/`animals`/`organisations` in the first place
  (the `prevent_non_moderator_post_moderation_changes()` trigger's moderator branch was unreachable
  dead code for exactly this reason). Fixed via three new `SECURITY DEFINER` RPCs in
  `20260912001000_moderator_enforcement_actions.sql` — `moderator_set_post_moderation_status`,
  `moderator_set_comment_moderation_status`, `moderator_set_animal_published`,
  `moderator_set_organisation_suspended` — wrapped as `setPostModerationStatus`/
  `setCommentModerationStatus`/`setAnimalPublished`/`setOrganisationSuspended` in
  `services/moderation.ts`, wired into `moderation-panel.tsx`'s per-`target_type` action buttons.
  `dashboard/admin.tsx`'s guard now accepts `["moderator", "admin"]` (was `admin`-only) so a plain
  `moderator`-role account can actually reach any of this — one shared dashboard rather than a
  parallel `dashboard/moderator` tree (tried first, then deliberately consolidated same-day per
  product decision — see `TODO.md`); `adminNavFor(isAdmin)` in `navigation.ts` hides the genuinely
  sensitive items (users/fundraising/audit-logs/settings) from a moderator's nav, and each of those
  four routes also carries its own `requireRole(["admin"])` so nav-hiding isn't the only gate.
- Not yet built: an equivalent enforcement action for `target_type = 'user'` (temporarily
  restricting a user account itself, as opposed to their organisation) — no per-profile
  suspend/ban mechanism exists anywhere in the schema as of this pass (see `TODO.md`).

## Related docs

- `supabase/migrations/20260909001000_breeder_trust_claims.sql` — the trust-claims schema, cited
  directly in `services/trust-claims.ts:3`.
- Comments reference "Stage CJG" (soft-dismissal of reports) and "Stage BN"
  (`risk_signals.multiple_independent_reports`, mentioned as unwired) — the specific stage docs
  for these weren't located by filename in this pass; grep `docs/` for "CJG"/"BN" or these exact
  phrases if you need the source design doc.

## Last significant change

2026-09-12: added the moderator enforcement-action RPCs + `moderation-panel.tsx`/`reports-panel.tsx`
+ the new `dashboard/moderator` route tree (see "Known gaps" above for the full shape). Same day,
earlier: `verification-review-list.tsx`'s reject action switched from a raw `user_verifications`
table UPDATE to the `reject_user_verification` RPC (part of the breeder self-registration rework —
see `docs/BREEDER_VERIFICATION_AND_TRUST.md` and the repo-root `TODO.md`).
