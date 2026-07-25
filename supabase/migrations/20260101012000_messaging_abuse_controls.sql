-- Stage CJQ (third/fourth supplemental queue): messaging abuse controls. Audited
-- conversations/messages (Stage R/S) and support_cases/support_case_messages
-- (Stage BL-addendum/CJP) against this stage's checklist. Most items are already correctly
-- handled and not duplicated here: sender attribution is RLS-enforced
-- (`sender_profile_id = auth.uid()`, `with check`, both tables — never client-trusted), internal-
-- note spoofing was closed at Stage R/the support-case build, conversation/case membership is a
-- live RLS join re-evaluated on every read/write (not a cached grant), message-send flooding is
-- now rate-limited (message_send 30/min since Stage J, support_case_message_send 30/min since
-- Stage CJP), and there is no "leave a conversation"/"remove a participant" feature anywhere in
-- this codebase yet (grepped every query file — zero matches), so "removed-member continued
-- access" has no reachable path to test or fix. "Suspended-role access" doesn't apply here by
-- design: messaging is conversation-membership-based, not role-gated (unlike Stage BD's
-- driver/org-role checks) — a person's own suspended platform ROLE (e.g. their breeder role) does
-- not, and should not, cut off their personal messages with a specific buyer/ops staffer, the same
-- "role suspension revokes role-gated access, not personal identity access" distinction already
-- established at 20260101006100.
--
-- Two real, previously-unenforced gaps found and closed:
--
-- 1. Oversized payload: neither messages.body nor support_case_messages.body had any length bound
--    — a raw API call could insert an arbitrarily large body (megabytes of text), inflating
--    storage and query cost with no legitimate use case; the longest real body anywhere in this
--    schema's seed/tests is 73 characters, so a 10,000-character bound is enormously generous for
--    genuine use while still bounding the worst case.
--
-- 2. Cross-conversation attachment substitution: messages.attachment_url has existed since
--    Stage S with zero validation tying it to the message's own conversation. The one real call
--    site (sendMessage() in src/lib/queries/messaging.ts) always constructs the path itself as
--    `${conversationId}/...` right before upload, so this is not reachable through the real UI —
--    but a raw API call could set attachment_url to a path under a *different* conversation's
--    folder. Storage's own RLS (is_conversation_participant() on the folder-derived UUID,
--    Stage S) already stops that from leaking anything the reader couldn't otherwise see — a
--    signed-URL request for a substituted path still independently requires participancy in the
--    *referenced* conversation — but relying solely on that second layer left the DB row itself
--    able to carry a lie about which conversation an attachment belongs to. A CHECK constraint
--    closes it at the row level too, so it's structurally impossible, not just practically
--    harmless.
alter table public.messages
  add constraint messages_body_length check (char_length(body) <= 10000);

alter table public.support_case_messages
  add constraint support_case_messages_body_length check (char_length(body) <= 10000);

alter table public.messages
  add constraint messages_attachment_url_scoped_to_conversation check (
    attachment_url is null or attachment_url like (conversation_id::text || '/%')
  );
