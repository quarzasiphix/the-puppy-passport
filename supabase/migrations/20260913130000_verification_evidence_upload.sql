-- Closes a gap tracked in TODO.md since 2026-09-12: "No document-upload UI in breeder onboarding
-- ... user_verifications.evidence_url exists in the schema but nothing ever writes to it."
-- Requested 2026-09-13: settings should let a breeder attach verification documents (WNI, kennel
-- club registration proof, etc.), reusing this existing column rather than a new document table.
--
-- Private bucket, not the public `kennel-media` one (20260101002200_storage.sql) — an ID/
-- registration document is never meant to be publicly viewable, only by its owner and staff who
-- review it. Object path convention `{user_id}/...`, matching `evidence_url`'s meaning: it's
-- evidence FOR a specific user's verification, and a user has at most one row per
-- verification_type (the table's own unique constraint), so their own folder is unambiguous
-- without needing the verification id in the path too.
insert into storage.buckets (id, name, public, file_size_limit)
values ('verification-evidence', 'verification-evidence', false, 20971520)
on conflict (id) do nothing;

create policy "users manage their own verification evidence files"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'verification-evidence' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'verification-evidence' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "staff read all verification evidence files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'verification-evidence' and (public.is_admin() or public.is_moderator()));

-- The one sanctioned way to set evidence_url — mirrors request_reservation_deposit()'s shape
-- (a narrow, single-purpose RPC rather than widening user_verifications' RLS update policy, which
-- today only allows the owner to edit while status = 'not_started'; evidence is exactly the kind
-- of thing a breeder should still be able to add after submitting, e.g. in response to
-- 'more_information_required'). p_evidence_path is a storage object path, not a public URL — the
-- private bucket above means every read goes through a short-lived signed URL generated on demand
-- (src/lib/storage/media.ts getSignedFileUrl), never a persisted bare link.
create or replace function public.submit_verification_evidence(
  p_verification_id uuid,
  p_evidence_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_verification public.user_verifications%rowtype;
begin
  select * into v_verification from public.user_verifications
  where id = p_verification_id for update;
  if not found then
    raise exception 'Verification not found.' using errcode = 'P0002';
  end if;

  if v_verification.user_id <> auth.uid() and not public.is_admin() then
    raise exception 'You can only attach evidence to your own verification.' using errcode = '42501';
  end if;

  if v_verification.status in ('approved', 'rejected', 'expired', 'suspended') then
    raise exception 'This verification is already closed and can no longer be updated.'
      using errcode = 'P0001';
  end if;

  update public.user_verifications
  set evidence_url = p_evidence_path
  where id = p_verification_id;
end;
$$;

revoke all on function public.submit_verification_evidence(uuid, text) from public;
grant execute on function public.submit_verification_evidence(uuid, text) to authenticated;
