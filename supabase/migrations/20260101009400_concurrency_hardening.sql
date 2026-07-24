-- Stage AG (supplemental queue): idempotency/concurrency audit. Three real races found by
-- walking through the concrete concurrent-actor scenarios for reservation creation and
-- conversation creation (both explicitly named in this stage's brief).
--
-- 1) Reservations: nothing stopped two different *approved* applications for the same animal
-- (an org can approve more than one buyer's application for a popular puppy -- nothing prevents
-- that today) from each being converted into a reservation. application_id is unique (one
-- reservation per application), but nothing was unique per animal_id -- a genuine double-sell
-- race if two staff members (or one staff member double-clicking) create two reservations for the
-- same animal from two different approved applications, concurrently or not. A partial unique
-- index closes this atomically at the DB level, not with an application-side check-then-insert
-- that would itself still race.
create unique index reservations_one_active_per_animal
  on public.reservations (animal_id)
  where status <> 'cancelled';

-- 2) start_transport_conversation() (20260101005000_messaging_start_conversation.sql) does a
-- classic check-then-insert: SELECT for an existing conversation, INSERT one if none found. Two
-- concurrent calls for the *same* transport request (e.g. the requester and an ops staff member
-- both opening the thread for the first time at the same moment) can each see "none exists" before
-- either commits, producing two conversations for one transport request. A conversation is meant
-- to be 1:1 with its transport request (the RPC's own SELECT assumes this), so a partial unique
-- index makes the race impossible outright -- the second concurrent INSERT fails with a unique
-- violation instead of silently succeeding twice.
create unique index conversations_one_per_transport_request
  on public.conversations (linked_transport_request_id)
  where conversation_type = 'transport' and linked_transport_request_id is not null;

-- 3) start_application_conversation() has the same check-then-insert race, but its natural key is
-- (animal_id, buyer) -- multiple different buyers legitimately each get their own conversation
-- about the same animal, so a plain unique index on linked_animal_id alone would be wrong. Using a
-- transaction-scoped advisory lock keyed on (animal_id, buyer) instead: a second concurrent call
-- for the same pair blocks until the first commits, then correctly finds and reuses the
-- just-created conversation via its own SELECT instead of creating a duplicate.
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
    if not exists (
      select 1 from public.buyer_applications
      where animal_id = p_animal_id and buyer_id = v_caller
    ) then
      raise exception 'You need an application for this animal before messaging the breeder';
    end if;
    v_buyer := v_caller;
  end if;

  -- Serialize concurrent callers for this exact (animal, buyer) pair for the rest of this
  -- transaction. hashtext() on the concatenated ids keeps this to the single bigint
  -- pg_advisory_xact_lock expects; a hash collision would only ever cost an unnecessary wait, never
  -- incorrect behaviour, since the SELECT-for-existing-conversation below is still the real check.
  perform pg_advisory_xact_lock(hashtext('start_application_conversation:' || p_animal_id::text || ':' || v_buyer::text));

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
