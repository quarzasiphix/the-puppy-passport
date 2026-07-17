-- The public "approved private rehoming listings" policy on animals (see
-- 20260101001200_rehoming_reviews.sql) checks rehoming_reviews via an EXISTS subquery. Postgres
-- checks table-level privileges before RLS filtering, so anon needs bare SELECT on
-- rehoming_reviews just for that subquery to execute — RLS on rehoming_reviews itself (owner/admin
-- only) still hides every row from anon, so this grant leaks nothing.
grant select on public.rehoming_reviews to anon;
