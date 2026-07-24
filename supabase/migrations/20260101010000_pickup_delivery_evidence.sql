-- Stage BG (supplemental queue): proof of pickup/delivery. transport_status_history.evidence_url
-- has existed since the original transport_requests migration but was never wired to anything --
-- confirmed by grep: zero references anywhere in src/. When a driver logs "delivered" or
-- "handover_confirmed", today it's just a bare status string with a timestamp, no photo or
-- signature evidence at all, despite the schema clearly being designed for it (matches the exact
-- same "schema exists, never wired" shape as messages.attachment_url before Stage S, and
-- handover_protocols, which stays out of scope here -- it's a separate, more detailed
-- ops-managed record, not what a driver captures in the field).
--
-- Also found while wiring this: advanceJobStatus() (src/lib/queries/driver.ts), the real function
-- drivers use to progress their job, has the exact same non-atomic + forgeable-actor shape already
-- fixed for changeOpsRequestStatus() (Stage AD) and assignRequestToRoute() (Stage AE) -- two
-- separate client-side writes, with changed_by trusted from a client-supplied driverProfileId.
-- Folded into one atomic RPC with a server-stamped actor, and an optional evidence object path
-- parameter for the real proof-of-pickup/delivery capture.
insert into storage.buckets (id, name, public, file_size_limit)
values ('transport-evidence', 'transport-evidence', false, 20971520)
on conflict (id) do nothing;

create policy "assigned drivers upload evidence for their active jobs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'transport-evidence'
    and public.is_assigned_driver_for_request((storage.foldername(storage.objects.name))[1]::uuid)
  );

create policy "assigned drivers and requesters read evidence for the job"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'transport-evidence'
    and (
      public.is_assigned_driver_for_request((storage.foldername(storage.objects.name))[1]::uuid)
      or exists (
        select 1 from public.transport_requests tr
        where tr.id = (storage.foldername(storage.objects.name))[1]::uuid
          and tr.requester_profile_id = (select auth.uid())
      )
    )
  );

create policy "ops staff manage all transport evidence in storage"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'transport-evidence' and public.is_ops_staff())
  with check (bucket_id = 'transport-evidence' and public.is_ops_staff());

create or replace function public.advance_transport_job_status(
  p_request_id uuid,
  p_new_status public.transport_status,
  p_evidence_object_path text default null,
  p_customer_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_assigned_driver_for_request(p_request_id) then
    raise exception 'You are not the assigned driver for this request.'
      using errcode = 'P0001';
  end if;

  update public.transport_requests set status = p_new_status where id = p_request_id;

  insert into public.transport_status_history (
    transport_request_id, status, changed_by, customer_note, evidence_url
  ) values (
    p_request_id, p_new_status, auth.uid(), p_customer_note, p_evidence_object_path
  );
end;
$$;

revoke all on function public.advance_transport_job_status(uuid, public.transport_status, text, text) from public;
grant execute on function public.advance_transport_job_status(uuid, public.transport_status, text, text) to authenticated;
