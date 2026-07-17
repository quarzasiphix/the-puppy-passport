-- A community-visible transport request is shown on public/community pages stripped down to the
-- non-sensitive columns only — exact addresses, document numbers, phone numbers and any party's
-- personal profile ids are never included, regardless of what RLS on the base table would allow.
--
-- Deliberately NOT security_invoker: transport_requests has no RLS policy granting anon/broad
-- authenticated access at all (see transport_requests migration — only the requester, named
-- parties and ops/admin can read the base table). This view is the *only* sanctioned path to
-- community_visible rows for everyone else, and it works precisely because it runs with the
-- view owner's privileges and hand-picks a safe column list — the opposite failure mode (an
-- invoker-rights view) would require a base-table policy that grants anon row access, which would
-- then also expose every other column (exact addresses, phone, doc numbers) since RLS is
-- row-level, not column-level.
create view public.public_transport_requests
as
select
  id,
  request_number,
  request_purpose,
  pickup_country,
  pickup_area_approx,
  destination_country,
  destination_area_approx,
  earliest_date,
  latest_date,
  flexible_dates,
  requested_service_type,
  size_category,
  breed_free_text,
  status,
  created_at
from public.transport_requests
where visibility = 'community_visible';

grant select on public.public_transport_requests to anon, authenticated;
