create type public.conversation_type as enum ('transport', 'marketplace', 'adoption', 'community', 'support');
create type public.conversation_participant_role as enum (
  'requester', 'ops', 'buyer', 'breeder', 'adopter', 'foundation', 'sender', 'recipient', 'member'
);
create type public.message_kind as enum (
  'customer_info', 'document_request', 'quotation', 'scheduling_update', 'internal_note',
  'handover_instruction', 'general'
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  subject text,
  linked_transport_request_id uuid references public.transport_requests (id),
  linked_animal_id uuid references public.animals (id),
  conversation_type public.conversation_type not null default 'community',
  created_at timestamptz not null default now()
);

create table public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role_in_conversation public.conversation_participant_role not null default 'member',
  unique (conversation_id, profile_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_profile_id uuid not null references public.profiles (id),
  body text not null,
  message_kind public.message_kind not null default 'general',
  is_internal boolean not null default false,
  attachment_url text,
  created_at timestamptz not null default now()
);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

create policy "participants view their conversations"
  on public.conversations for select to authenticated
  using (exists (select 1 from public.conversation_participants cp where cp.conversation_id = id and cp.profile_id = (select auth.uid())));

create policy "ops staff manage all conversations"
  on public.conversations for all to authenticated
  using (public.is_ops_staff()) with check (public.is_ops_staff());

create policy "participants view their own participant rows"
  on public.conversation_participants for select to authenticated
  using (profile_id = (select auth.uid()) or exists (
    select 1 from public.conversation_participants cp where cp.conversation_id = conversation_id and cp.profile_id = (select auth.uid())
  ));

create policy "ops staff manage all conversation participants"
  on public.conversation_participants for all to authenticated
  using (public.is_ops_staff()) with check (public.is_ops_staff());

-- Internal notes are only ever visible to ops/admin, even though they live in the same
-- conversation as customer-facing messages — "internal notes must never be visible to customers".
create policy "participants view non-internal messages in their conversations"
  on public.messages for select to authenticated
  using (
    not is_internal
    and exists (select 1 from public.conversation_participants cp where cp.conversation_id = conversation_id and cp.profile_id = (select auth.uid()))
  );

create policy "participants send messages in their conversations"
  on public.messages for insert to authenticated
  with check (
    sender_profile_id = (select auth.uid())
    and exists (select 1 from public.conversation_participants cp where cp.conversation_id = conversation_id and cp.profile_id = (select auth.uid()))
  );

create policy "ops staff manage all messages"
  on public.messages for all to authenticated
  using (public.is_ops_staff()) with check (public.is_ops_staff());
