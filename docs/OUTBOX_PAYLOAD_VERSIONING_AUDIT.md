# Outbox payload versioning audit

Stage XR-12 (append-only queue). Audited every place this schema stores a structured event
payload for later reading, for the requirements this stage names: explicit event name/version,
safe behaviour on an unsupported/unknown version, stable ids, and privacy-safe payload content.

## The one real "outbox-shaped" producer already has this — built at Stage CJS

`notifications` is the only genuine event-payload producer in this schema with a real downstream
*reader* whose behaviour depends on the payload's shape (the notification bell/list UI). Stage CJS
already built exactly what this stage asks for: `notification_type` (the event name),
`template_version` (an explicit, persisted version stamp — `check (template_version is null or
template_version >= 1)`), deterministic rendering via a pure function
(`src/lib/notification-templates.ts`), and — critically — the rendered text is stored permanently
at creation time and *never re-resolved from the template at read time*, so an old notification can
never fail to "render" even if the current template code has moved on to a newer version. Stable
ids (the notification's own `id`, plus CJR's `dedup_key` for the underlying event). Privacy-safe
payloads: every template payload type (`RehomingDecisionPayload`, `ApplicationStatusChangePayload`,
`ModerationDecisionPayload`, `ModerationAppealDecisionPayload`) carries only ids/labels the
recipient is already entitled to see, confirmed by reading all 4 payload shapes directly. Not
rebuilt or duplicated here — this is exactly what Stage XR-13 ("template revalidation... without
duplicate implementation") is the dedicated stage for.

## The other candidate: `audit_logs.before`/`after` — confirmed no real versioning need

`audit_logs` also stores structured `jsonb` event payloads (`before`/`after`), one per audited
action, written across dozens of migrations this session with no consistent shape or version
field. Checked whether this is a real gap the same way notifications needed closing: **it isn't** —
confirmed by grep that zero code anywhere (`src/lib/queries/*.ts`, every route file, including the
one real audit-log viewer, `dashboard.admin.audit-logs.tsx`) ever programmatically reads or parses
`before`/`after` at all. These payloads are write-only forensic snapshots for a human directly
querying the database, not a machine-consumed event stream with a reader that could break on a
shape drift. Adding an explicit version field to a payload nothing ever parses back would be
speculative schema churn with no real consumer to protect — the same "no reachable need" judgment
this session has applied consistently elsewhere.

## No other real outbox/event-payload system exists

Re-confirmed alongside Stages XR-10/XR-11: no email provider, no webhook dispatch, no external
integration of any kind that would need a versioned outbound event contract. Nothing built or
changed this stage.
