// Stage YR-1 (notification producer inventory): drift coverage for notification templates. Pure
// TypeScript, no Supabase/network dependency — runs standalone via `npm run test:unit`, distinct
// from tests/db (which needs a live local Supabase stack) and tests/e2e (which needs a browser).
//
// The real gap this closes: `category` used to be a second, independently-suppliable argument to
// notifyUserFromTemplate() alongside `templateId` — nothing tied the two together, so a future
// call site could type-check fine while sending a template under a mismatched preference category
// (a real, silent behavior bug: the recipient's preference for the *wrong* category would gate a
// notification they never got a chance to opt in or out of under its *actual* category). Fixed by
// moving `category` onto the template definition itself — this test proves every template
// genuinely declares one of the four real categories, and that `render()` is a pure function
// (same payload in, same output out), the two properties the whole notification-versioning design
// (Stage CJS) depends on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { notificationTemplates } from "../../src/domains/messaging/services/notification-templates.ts";

const REAL_CATEGORIES = new Set(["applications", "adoption", "moderation", "security"]);

test("every notification template declares a real category and a positive version", () => {
  for (const [templateId, template] of Object.entries(notificationTemplates)) {
    assert.ok(
      REAL_CATEGORIES.has(template.category),
      `${templateId} declares an unrecognised category: ${template.category}`,
    );
    assert.ok(
      Number.isInteger(template.version) && template.version >= 1,
      `${templateId}'s version must be a positive integer, matching the DB's own ` +
        `notifications_template_version_positive check constraint`,
    );
  }
});

test("rehoming templates are always 'adoption', never any other category", () => {
  assert.equal(notificationTemplates.rehoming_approved.category, "adoption");
  assert.equal(notificationTemplates.rehoming_rejected.category, "adoption");
});

test("moderation templates are always 'moderation'", () => {
  assert.equal(notificationTemplates.moderation_decision.category, "moderation");
  assert.equal(notificationTemplates.moderation_appeal_decision.category, "moderation");
});

test("application_status_change is always 'applications'", () => {
  assert.equal(notificationTemplates.application_status_change.category, "applications");
});

test("render() is a pure function of its payload — same input always produces the same output", () => {
  const payload = { animalId: "test-animal-id" };
  const first = notificationTemplates.rehoming_approved.render(payload);
  const second = notificationTemplates.rehoming_approved.render(payload);
  assert.deepEqual(first, second);
});

test("moderation_appeal_decision renders distinct, correct text for each real decision value", () => {
  const overturned = notificationTemplates.moderation_appeal_decision.render({
    caseId: "case-1",
    decision: "overturned",
  });
  const upheld = notificationTemplates.moderation_appeal_decision.render({
    caseId: "case-1",
    decision: "upheld",
  });
  assert.notEqual(overturned.title, upheld.title);
  assert.ok(/successful/i.test(overturned.title));
  assert.ok(/reviewed/i.test(upheld.title));
});

test("no template's category is ever 'security' — that category exists but has no real producer yet", () => {
  // Documented, not a bug: get_notification_preference() (20260101008000_notification_
  // preferences.sql) already hard-codes 'security' as always-enabled regardless of preference —
  // real, correct, already-tested infrastructure — but nothing in this app currently creates a
  // notification under it. See docs/NOTIFICATION_PRODUCER_INVENTORY.md. This test exists so that
  // if a future template genuinely needs it, this assertion is the one place to update alongside
  // that decision, not a silent accident.
  for (const template of Object.values(notificationTemplates)) {
    assert.notEqual(template.category, "security");
  }
});
