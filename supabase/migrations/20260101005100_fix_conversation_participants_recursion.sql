-- 20260101002000_messaging.sql's "participants view their own participant rows" policy subqueries
-- conversation_participants from within conversation_participants' own policy — the same
-- self-referential shape already fixed once for animals/rehoming_reviews
-- (20260101003800_fix_rehoming_rls_recursion.sql). Postgres refuses to evaluate this (42P17)
-- regardless of actual recursion depth. Never surfaced until now because no UI exercised messaging
-- queries before this pass. Fixed with the same SECURITY DEFINER helper pattern as owns_org().
create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and profile_id = (select auth.uid())
  );
$$;

drop policy "participants view their own participant rows" on public.conversation_participants;

create policy "participants view their own participant rows"
  on public.conversation_participants for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or public.is_conversation_participant(conversation_id)
  );
