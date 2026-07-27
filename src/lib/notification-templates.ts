// Stage CJS (third/fourth supplemental queue): notification template versioning. This app has no
// email provider (confirmed by Stage AC/CJO's own audits — nothing to send to) and no marketing
// template editor is being built here; the real, honest scope is the 4 notification types that
// already exist (Stage H), formalized as pure, versioned render functions instead of ad-hoc inline
// title/body string construction repeated at each call site. Each template's `render` is a pure
// function of its payload — same payload in, same {title, body} out, always — so a notification's
// persisted text is fully deterministic and testable, never depending on ambient state (current
// time, current locale) beyond what's explicitly passed in.
//
// The rendered text is stored permanently on the notifications row at creation time (Stage H) —
// never re-rendered from the template at read time — so a future template change can never
// silently alter the wording of a notification a user already received, including one returned
// again by CJR's own dedup path on a retry. `template_version` is recorded alongside the rendered
// text purely as an audit trail of which version of this logic produced it, not something a reader
// re-resolves later; `20260101012200_notification_template_versioning.sql`'s
// `check (template_version is null or template_version >= 1)` is the one thing the database itself
// enforces, so a caller can never persist a nonsensical version number.
// Stage YR-1 (notification producer inventory): `category` used to be a second, independently
// suppliable argument to notifyUserFromTemplate() alongside `templateId` -- nothing tied the two
// together, so a future call site could type-check fine while passing a template designed for one
// preference category (e.g. "adoption") under a mismatched one (e.g. "moderation"), silently
// gating it on the wrong preference. `category` now lives on the template definition itself, the
// single source of truth, and notifyUserFromTemplate() derives it -- a caller can no longer get
// this wrong, closed at the type level rather than by convention or a runtime check.
export type NotificationCategory = "applications" | "adoption" | "moderation" | "security";

export type RehomingDecisionPayload = { animalId: string };
export type ApplicationStatusChangePayload = { animalName: string; statusLabel: string };
export type ModerationDecisionPayload = { caseId: string };
export type ModerationAppealDecisionPayload = { caseId: string; decision: "upheld" | "overturned" };

export const notificationTemplates = {
  rehoming_approved: {
    version: 1,
    category: "adoption" as NotificationCategory,
    render: (payload: RehomingDecisionPayload) => ({
      title: "Your rehoming listing was approved",
      body: "It's now visible to people looking to adopt on Havenpaw.",
      linkUrl: `/adoptions/${payload.animalId}`,
    }),
  },
  rehoming_rejected: {
    version: 1,
    category: "adoption" as NotificationCategory,
    render: (payload: { notes: string }) => ({
      title: "Your rehoming submission wasn't approved",
      body: payload.notes,
      linkUrl: null as string | null,
    }),
  },
  application_status_change: {
    version: 1,
    category: "applications" as NotificationCategory,
    render: (payload: ApplicationStatusChangePayload) => ({
      title: `Update on your application for ${payload.animalName}`,
      body: payload.statusLabel,
      linkUrl: "/dashboard/buyer/applications" as string | null,
    }),
  },
  moderation_decision: {
    version: 1,
    category: "moderation" as NotificationCategory,
    render: (payload: ModerationDecisionPayload) => ({
      title: "A moderation decision affects you",
      body: "Havenpaw has made a decision on a report involving you. You can view it and, if eligible, appeal it.",
      linkUrl: `/moderation/${payload.caseId}`,
    }),
  },
  moderation_appeal_decision: {
    version: 1,
    category: "moderation" as NotificationCategory,
    render: (payload: ModerationAppealDecisionPayload) => ({
      title:
        payload.decision === "overturned"
          ? "Your appeal was successful"
          : "Your appeal was reviewed",
      body:
        payload.decision === "overturned"
          ? "A different moderator reviewed your appeal and overturned the original decision."
          : "A different moderator reviewed your appeal. The original decision stands.",
      linkUrl: `/moderation/${payload.caseId}`,
    }),
  },
} as const;

export type NotificationTemplateId = keyof typeof notificationTemplates;

// An explicit mapped type (rather than `Parameters<(typeof notificationTemplates)[T]["render"]>`)
// so a generic `T extends NotificationTemplateId` correctly narrows to *one* template's payload
// shape per call — indexing into a union of function types instead produces an intersection of
// every template's parameters, which is never satisfiable by a single real payload.
export type NotificationTemplatePayloads = {
  [K in NotificationTemplateId]: Parameters<(typeof notificationTemplates)[K]["render"]>[0];
};
