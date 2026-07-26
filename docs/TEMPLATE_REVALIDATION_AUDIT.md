# Template revalidation

Stage XR-13 (append-only queue). Revalidates Stage CJS's notification template versioning system
directly, rather than duplicating it — its own explicit scope ("revalidate CJS without duplicate
implementation").

## Revalidated: "unknown version" safety is real, not just a code comment

CJS's own migration comment claims the rendered text is stored permanently at creation and never
re-resolved from the template at read time, so an old or future notification can never fail to
"render." Confirmed directly rather than trusted: `listMyNotifications()`
(`src/lib/queries/notifications.ts`) only ever selects the stored `title`/`body` columns — grepped
every real consumer and found zero code anywhere looks up `notificationTemplates[notification_type]`
to re-render a stored notification. New test in `tests/db/notification-template-versioning.test.ts`
proves this empirically: a notification created with `template_version: 9999` and a
`notification_type` genuinely absent from `notificationTemplates` (confirmed via
`hasOwnProperty`, not assumed) creates and reads back cleanly with no error — the concrete
"current and unknown template versions" compatibility test this stage's own definition names.

## No duplicate implementation

Nothing in `20260101012200_notification_template_versioning.sql` or
`src/lib/notification-templates.ts` was changed this stage. `template_version`'s own `check
(template_version is null or template_version >= 1)` constraint, the 4 real template payload
shapes, and `create_notification_if_enabled()`'s insert-or-return-existing dedup behavior were all
re-verified via the existing and new tests passing, not rebuilt.
