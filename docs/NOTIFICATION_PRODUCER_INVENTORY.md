# Notification producer inventory (Stage YR-1)

This app has no email/push provider (confirmed by earlier audits — Stage AC/CJO, revalidated by
XR-14) and no background job/outbox worker system (confirmed repeatedly — Stages XR-10/XR-11/
XR-12). "Notification" in this codebase means exactly one thing: a row in `public.notifications`,
created synchronously, in the same request as the triggering action, via
`create_notification_if_enabled()` — there is no separate outbox table, no async delivery, no
retry queue. This inventory reflects that real, current architecture rather than assuming a job
system this codebase doesn't have.

## The pipeline (one path, every producer goes through it)

```
call site → notifyUserFromTemplate({ profileId, templateId, dedupKey?, payload })
          → notificationTemplates[templateId].render(payload)   (pure, versioned, in TS)
          → notifyUser({ ...rendered, category: template.category, templateVersion })
          → create_notification_if_enabled() RPC                (SECURITY DEFINER, in SQL)
              → get_notification_preference(profile_id, category)  — 'security' always true,
                every other category defaults to enabled until the recipient opts out
              → insert ... on conflict (profile_id, dedup_key) where dedup_key is not null
                do nothing, returning id                            — Stage CJR's dedup guarantee
              → if no row was inserted (a real duplicate), re-select and return the existing id
```

Every real producer in this app goes through `notifyUserFromTemplate()` — there is no second,
lower-level producer bypassing the template registry (`notifyUser()` is exported and could be
called directly with hand-built title/body text, but no call site actually does this; every real
notification is templated).

## Real producers (5 call sites, 5 templates)

| Call site | Template ID | Category | Version | Dedup key | Mandatory? |
|---|---|---|---|---|---|
| `approveRehomingReview()` (`rehoming.ts`) | `rehoming_approved` | `adoption` | 1 | `rehoming_review:<id>:approved` | No — opt-out |
| `rejectRehomingReview()` (`rehoming.ts`) | `rehoming_rejected` | `adoption` | 1 | `rehoming_review:<id>:rejected` | No — opt-out |
| application status change (`applications.ts`) | `application_status_change` | `applications` | 1 | `application:<id>:<status>` (keyed per-status, so a later different transition still notifies) | No — opt-out |
| `notifyAffectedUserOfDecision()` (`moderation.ts`) | `moderation_decision` | `moderation` | 1 | `moderation_case:<caseId>:decision` | No — opt-out |
| `notifyAppellantOfAppealDecision()` (`moderation.ts`) | `moderation_appeal_decision` | `moderation` | 1 | `moderation_appeal:<appealId>:decision` | No — opt-out |

**Locale**: every template's `render()` produces English text only — there is no locale parameter
or per-user locale capture anywhere in this pipeline. This app has no i18n/locale infrastructure
at all yet (confirmed by grep — no `i18n`, no locale column on `profiles`), so this isn't a gap
relative to a feature that doesn't exist; it's simply out of scope until localisation is a real
product requirement. Documented here so YR-3 (locale/fallback hardening) doesn't have to
rediscover this.

**Recipient rule**: every producer above takes `profileId` directly from data already fetched and
authorized earlier in the same call (the review's `owner_profile_id`, the application's
`buyer_profile_id`, the case's `affected_profile_id`/appeal's `submitted_by`) — never a
client-supplied "who to notify" argument, so there's no forgeable-recipient surface to close here.

## The `security` category: real infrastructure, currently no producer

`get_notification_preference()` (`20260101008000_notification_preferences.sql`) already
hard-codes `p_category = 'security'` as always-enabled, unconditionally, regardless of the
recipient's stored preference — a real, already-correct, already-tested mandatory-notification
mechanism. But **no code path in this app currently creates a notification under it** — confirmed
by grep, zero `category: "security"` call sites exist. This is not a bug to fix reflexively:
the two most obvious candidate security events were checked and are deliberately *not* good fits
for a user-facing notification:

- **`place_legal_hold()`**: notifying the subject would tip off someone potentially under an active
  fraud/compliance investigation — the opposite of what a legal hold is for. Real-world legal-hold
  practice is silent by design.
- **`execute_account_deletion()`**: by the time it runs, the profile is anonymised — there's no
  live, notifiable identity left to reach, and the request that triggered it was the user's own.

No other genuinely reachable security event (password/email change, new-device sign-in) exists in
this app yet — those are entirely Supabase Auth/GoTrue's own internal mechanism, not something
this app's own `notifications` pipeline observes. `tests/unit/notification-templates.test.ts`
includes an explicit "no template is ever `security`" assertion — not because one shouldn't exist
in principle, but so a future producer added under this category is a deliberate decision recorded
alongside that test, not a silent accident either way.

## Fixed this stage: category/template drift

`category` used to be a second, independently-suppliable argument to `notifyUserFromTemplate()`
alongside `templateId` — nothing tied the two together at the type level, so a future call site
could type-check fine while sending, say, `rehoming_approved` under `category: "moderation"`,
silently gating a rehoming notification on the recipient's *moderation* preference instead of
their real `adoption` preference. Fixed by moving `category` onto the template definition itself
(the single source of truth) and removing it from `notifyUserFromTemplate()`'s own argument list —
a caller can no longer specify a mismatched category, closed at the type level, not by convention
or a runtime check. `NotificationCategory` moved from `notifications.ts` to
`notification-templates.ts` (re-exported from its old location for every existing import) to avoid
a circular import between the two.

## Verification

- `npx tsc --noEmit` — clean; this alone proves the category/template coupling now holds for every
  real call site (a mismatched or removed `category` argument would no longer compile).
- `npx eslint` on every changed file — clean.
- New `tests/unit/notification-templates.test.ts` (new `npm run test:unit`, pure-logic, no
  Supabase dependency) — 7/7 passing: every template declares a real category and positive
  version, category assignments match the table above, `render()` is proven pure, appeal-decision
  text genuinely differs per outcome, and the "no `security` producer yet" fact is pinned.
- Full `npm run test:db`: unaffected (no schema/migration change this stage — purely a TypeScript
  refactor of an existing, already-tested pipeline), still 948/948 on 2 consecutive runs.
- `npm run build` — clean.
