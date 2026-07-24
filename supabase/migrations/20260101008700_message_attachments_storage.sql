-- Stage S (supplemental queue): attachments. messages.attachment_url has existed on the schema
-- since the original messaging migration (20260101002000_messaging.sql) but was never wired to
-- anything -- no Storage bucket, no RLS, no upload UI (confirmed by grep: zero references to
-- attachment_url anywhere in src/). This adds the missing backend layer, following the exact same
-- private-bucket-plus-signed-URL pattern already established for transport-documents/
-- welfare-case-documents (never a public link; access gated by a real relationship check, not
-- security-through-obscurity of an unguessable path).
--
-- Object path convention: `{conversation_id}/...`, matching transport-documents' own
-- `{transport_request_id}/...` convention. Read/write are both scoped to conversation
-- participants via the same is_conversation_participant() helper the messages/
-- conversation_participants RLS already relies on (added in
-- 20260101005100_fix_conversation_participants_recursion.sql) -- so a message attachment is
-- exactly as protected as the conversation it belongs to, no separate/weaker check invented here.
insert into storage.buckets (id, name, public, file_size_limit)
values ('message-attachments', 'message-attachments', false, 20971520)
on conflict (id) do nothing;

create policy "participants read their conversation's attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'message-attachments'
    and public.is_conversation_participant((storage.foldername(name))[1]::uuid)
  );

create policy "participants upload to their conversation's attachments"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'message-attachments'
    and public.is_conversation_participant((storage.foldername(name))[1]::uuid)
  );

create policy "ops staff manage all message attachments in storage"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'message-attachments' and public.is_ops_staff())
  with check (bucket_id = 'message-attachments' and public.is_ops_staff());
