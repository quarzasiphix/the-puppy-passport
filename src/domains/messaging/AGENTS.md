# Messaging domain

Direct messaging (conversations tied to an application or a transport request) plus the
notification system (in-app notifications, per-category preferences, versioned templates). No
email provider exists — "confirmed by Stage AC/CJO's own audits — nothing to send to"
(`services/notification-templates.ts:2`).

## What this owns

- `conversation_participants`, `messages` — `listMyConversations`, `listConversationMessages`,
  `sendMessage`, `getSignedAttachmentUrl` (`services/messaging.ts`). Conversation creation goes
  through RPCs, not a direct insert: `start_application_conversation()` /
  `start_transport_conversation()` (`startApplicationConversation`/`startTransportConversation`).
- `notifications`, `notification_preferences` — `listMyNotifications`, `markNotificationRead`,
  `markAllNotificationsRead`, `notifyUser`, `notifyUserFromTemplate`,
  `listMyNotificationPreferences`, `setNotificationPreference` (`services/notifications.ts`).
  Creation is gated by a preference check server-side: `create_notification_if_enabled()` RPC, not
  a plain insert — so `notifyUser`/`notifyUserFromTemplate` can be called unconditionally by any
  caller without each one re-checking the recipient's preferences.
- `services/notification-templates.ts` — the 4 real notification types (Stage H), each a pure
  `render(payload) => {title, body}` function: application status change, rehoming decision,
  moderation decision, moderation appeal decision. `NotificationCategory` =
  `"applications" | "adoption" | "moderation" | "security"` — **"moderation" is already a first-
  class notification category**, consistent with the `trust` domain's already-built
  `moderation_cases`/`moderation_appeals` pipeline (see `trust/AGENTS.md`).

## File structure

- `index.ts` — re-exports `services/messaging`, `services/notifications`,
  `services/notification-templates`, `components/chat-thread`, `components/notification-bell`,
  `components/notification-preferences`.
- `services/messaging.ts` (128 lines) — conversations + messages, described above.
- `services/notifications.ts` (162 lines) — notification list/read state/preferences, plus
  `notificationCategoryLabels` (a hardcoded `Record<NotificationCategory, string>` — not checked in
  this pass whether it's i18n'd elsewhere or genuinely hardcoded).
- `services/notification-templates.ts` (94 lines) — the 4 pure render functions. Deterministic by
  design: "same payload in, same `{title, body}` out, always... never depending on ambient state
  (current time, current locale) beyond what's explicitly passed in" (`:5-7`) — this is precisely
  why the `applicationStatusLabels` fix in the `marketplace` domain (2026-09-12) could **not** just
  call the new `t()`-based label function here: no locale is passed into these templates today, so
  they stayed English-only on purpose rather than silently rendering in whatever locale happened to
  be active on the caller's machine (see `marketplace/services/applications.ts`'s
  `NOTIFICATION_STATUS_LABELS_EN` and the repo-root `TODO.md`).
- `components/chat-thread.tsx`, `notification-bell.tsx`, `notification-preferences.tsx` — the UI
  for each of the above.

## Public API

`index.ts` exports the full surface flatly.

## Known gaps

- No email provider — every "notification" is in-app only; don't assume any user is emailed.
- Notification templates are English-only and take no locale — genuinely a design gap (server-side
  code has no `t()` context), not just an oversight; see `TODO.md`'s "Background notification text
  is English-only" item for the proposed direction (a locale-aware, non-hook translate helper keyed
  off the recipient's `profiles.preferred_language`).
- `notificationCategoryLabels` — not verified in this pass whether it's already i18n'd or a
  leftover hardcoded map; check before assuming either way.

## Related docs

None found by direct citation in this domain beyond the in-code Stage references (AC/CJO/CJS/H) —
no matching top-level `docs/*.md` filename was located in this pass; the stage names likely refer
to internal build-log entries rather than a standalone design doc.

## Last significant change

Not determined from in-domain evidence in this pass beyond the Stage CJS versioning work cited in
`services/notification-templates.ts:1`; file created 2026-09-12 as part of the project-wide
`AGENTS.md` rollout.
