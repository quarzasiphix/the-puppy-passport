-- Same missing-GRANT gotcha documented in 20260101002900_table_grants.sql (Supabase's
-- auto_expose_new_tables=false means a table's RLS policies alone don't make it reachable via the
-- Data API — a table-level GRANT is also required). Found by calling create_transport_draft()
-- directly against a real local database and hitting "permission denied for table
-- transport_request_animals" despite its RLS policies being correct. No anon grant, matching
-- transport_parties — this table has no `to anon` policy at all.
grant select, insert, update, delete on public.transport_request_animals to authenticated;
