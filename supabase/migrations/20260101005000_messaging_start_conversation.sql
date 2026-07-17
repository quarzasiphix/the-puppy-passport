-- The messaging schema (20260101002000_messaging.sql) only ever gave regular users a SELECT
-- policy on conversations/conversation_participants ("participants view their own") — there was no
-- way for a buyer or breeder to create the first row, since you can't be a "participant" of a
-- conversation that doesn't exist yet, and a naive insert-then-select-back also trips the
-- INSERT-as-SELECT RLS trap this project has hit repeatedly elsewhere. Rather than opening broad
-- insert policies on both tables (which would need their own careful relationship checks to avoid
-- becoming a spam vector), this follows the existing SECURITY DEFINER escape-hatch pattern
-- (get_my_profile, owns_org, ...): two narrow RPCs, each only usable by someone who already has a
-- real relationship with the other party.

-- Buyer <-> breeder, scoped to one buyer_applications relationship for one animal. Reused if a
-- conversation between the same two people about the same animal already exists.
create or replace function public.start_application_conversation(
  p_animal_id uuid,
  p_buyer_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_org_owner uuid;
  v_buyer uuid;
  v_conversation_id uuid;
begin
  if v_caller is null then
    raise exception 'Not authenticated';
  end if;

  select o.owner_user_id into v_org_owner
  from public.animals a
  join public.organisations o on o.id = a.organization_id
  where a.id = p_animal_id;

  if v_org_owner is null then
    raise exception 'Animal or its organisation not found';
  end if;

  if v_caller = v_org_owner then
    -- breeder starting/reopening a thread with a specific applicant
    if p_buyer_id is null then
      raise exception 'buyer_id is required when the breeder starts the conversation';
    end if;
    if not exists (
      select 1 from public.buyer_applications
      where animal_id = p_animal_id and buyer_id = p_buyer_id
    ) then
      raise exception 'That buyer has no application for this animal';
    end if;
    v_buyer := p_buyer_id;
  else
    -- buyer starting the conversation about their own application
    if not exists (
      select 1 from public.buyer_applications
      where animal_id = p_animal_id and buyer_id = v_caller
    ) then
      raise exception 'You need an application for this animal before messaging the breeder';
    end if;
    v_buyer := v_caller;
  end if;

  select c.id into v_conversation_id
  from public.conversations c
  where c.conversation_type = 'marketplace'
    and c.linked_animal_id = p_animal_id
    and exists (select 1 from public.conversation_participants cp where cp.conversation_id = c.id and cp.profile_id = v_buyer)
    and exists (select 1 from public.conversation_participants cp where cp.conversation_id = c.id and cp.profile_id = v_org_owner)
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations (conversation_type, linked_animal_id)
  values ('marketplace', p_animal_id)
  returning id into v_conversation_id;

  insert into public.conversation_participants (conversation_id, profile_id, role_in_conversation)
  values
    (v_conversation_id, v_buyer, 'buyer'),
    (v_conversation_id, v_org_owner, 'breeder');

  return v_conversation_id;
end;
$$;

grant execute on function public.start_application_conversation(uuid, uuid) to authenticated;

-- Transport requester <-> operations. Ops staff already see and can write to every conversation
-- via their blanket "ops staff manage all conversations" policy, so this only needs to seat the
-- requester as the one real participant row — any ops account can join in without being added
-- individually.
create or replace function public.start_transport_conversation(p_transport_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_requester uuid;
  v_conversation_id uuid;
begin
  if v_caller is null then
    raise exception 'Not authenticated';
  end if;

  select requester_profile_id into v_requester
  from public.transport_requests
  where id = p_transport_request_id;

  if v_requester is null then
    raise exception 'Transport request not found';
  end if;

  if v_caller <> v_requester and not public.is_ops_staff() then
    raise exception 'Not authorized for this transport request';
  end if;

  select c.id into v_conversation_id
  from public.conversations c
  where c.conversation_type = 'transport'
    and c.linked_transport_request_id = p_transport_request_id
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations (conversation_type, linked_transport_request_id)
  values ('transport', p_transport_request_id)
  returning id into v_conversation_id;

  insert into public.conversation_participants (conversation_id, profile_id, role_in_conversation)
  values (v_conversation_id, v_requester, 'requester');

  return v_conversation_id;
end;
$$;

grant execute on function public.start_transport_conversation(uuid) to authenticated;
