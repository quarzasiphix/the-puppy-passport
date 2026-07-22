-- Found while verifying the new group detail page against the real local stack: the page shows a
-- member count to anonymous visitors (consistent with "groups are publicly readable" on `groups`
-- itself), but `group_members` had no anon grant or policy at all — only
-- "group members are readable by authenticated users" (to authenticated). An anonymous visitor's
-- SSR load of /community/groups/$slug crashed with a real 401/42501 ("permission denied for table
-- group_members"), reproduced via curl before this fix. Extends the same full-visibility stance
-- already applied to authenticated users (`using (true)` — every group's membership list is
-- already readable by any signed-in user, not scoped per-group) to anon too, for consistency.
grant select on public.group_members to anon;

create policy "group members are readable by anyone"
  on public.group_members for select
  to anon
  using (true);
