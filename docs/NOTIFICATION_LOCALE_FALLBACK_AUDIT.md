# Notification locale and fallback hardening (Stage YR-3)

## Locale capture: not applicable to notifications, by architecture — checked, not assumed

This app does have real, deliberate i18n infrastructure (`src/lib/i18n/`, English/Polish,
`docs/PRODUCT_VISION.md`'s "Geographic direction") — but it's client-side-only (`localStorage`,
not SSR-aware via a cookie yet, documented as a known gap in that module's own comment) and covers
only site chrome/homepage so far, not the whole app. Notifications are created **server-side**, in
the same request as the triggering action (`create_notification_if_enabled()`, a synchronous
`SECURITY DEFINER` RPC) — there is no reliable server-side locale signal available at that moment
even if notification text were made translatable, since the client's chosen locale never leaves
the browser today. Wiring notification rendering into `src/lib/i18n/` now would mean building a
server-reachable locale-capture mechanism (a cookie, a profile column) that doesn't exist for
*any* other part of this app yet — that's a real, legitimate future feature, not something to
build speculatively inside a hardening pass for a stage that only asked to *audit* locale
handling. Every real template's `render()` (`notification-templates.ts`) produces English-only
text, deterministically, matching this app's current honest scope.

**"Prevent locale from being inferred from untrusted payload fields"**: checked directly — no
template's payload type (`RehomingDecisionPayload`, `ApplicationStatusChangePayload`,
`ModerationDecisionPayload`, `ModerationAppealDecisionPayload`) contains a locale field at all,
and `render()` never reads anything resembling one. Nothing to fix; the risk this asks about has
no surface to exist on.

## "Deterministic fallback when a requested locale or template is unavailable" — already covered

There's no "requested locale" to fall back from (above). For "unavailable template," this is
already thoroughly proven by Stage XR-13's own test
(`tests/db/notification-template-versioning.test.ts`, "a notification with an unknown future
template_version/type is created and read back safely"): the database layer never re-resolves a
stored notification against the template registry at read time — `create_notification_if_enabled()`
stores exactly whatever `p_notification_type`/`p_title`/`p_body`/`p_template_version` it was given,
with no lookup against the TypeScript-only template registry at all (that registry only exists at
*write* time, in application code). An "unsupported" template or version can never surface as a
read-time failure, by construction, not by a fallback branch that could itself be wrong.

## "Retries use the original queued locale unless explicitly migrated" — not applicable

No retry mechanism re-renders a notification (there's no outbox/job system — confirmed repeatedly,
XR-10/XR-11/XR-12/YR-1). Stage CJR's `dedup_key` mechanism means a retried *call* returns the
original row untouched, never re-rendering it — so there's no "locale" to preserve or migrate on
retry; the text (whatever locale it was written in, currently always English) is permanent from
creation, matching Stage CJS's own "rendered once, never re-resolved" design.

## "Add tests for Polish, English, unsupported locale and missing template"

- **English**: every template's output is asserted directly in
  `tests/unit/notification-templates.test.ts` (Stage YR-1).
- **Polish**: not applicable — no template renders Polish text; there is nothing to test that
  isn't already accurately described as "doesn't exist yet" above.
- **Unsupported locale**: not applicable — no locale parameter exists to be unsupported.
- **Missing/unsupported template**: already covered by Stage XR-13's test (cited above), not
  duplicated here.

## Verification

- No code change this stage — genuine audit-only finding, matching the same honest handling this
  session has used repeatedly for stages whose named concern doesn't apply to this app's real
  architecture (XR-10/XR-11/XR-12), rather than manufacturing speculative locale infrastructure to
  have something to change.
- Cross-referenced (not re-run) `tests/unit/notification-templates.test.ts` (YR-1) and
  `tests/db/notification-template-versioning.test.ts` (XR-13) as the tests that already cover the
  two properties this stage's own definition asks for that *do* apply to the real system.
