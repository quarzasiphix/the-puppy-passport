-- Post-transport customer review — one per completed request. Comments stay ops/admin-only (not
-- public) since nothing here has gone through any moderation, matching the earlier decision to
-- never show unmoderated review text publicly (see the honest "reviews aren't available yet"
-- placeholder on breeder profile pages). Anon/authenticated CAN see the aggregate rating on the
-- public transport page via a narrow view that exposes only the number, never the text.
create table public.transport_reviews (
  id uuid primary key default gen_random_uuid(),
  transport_request_id uuid not null unique references public.transport_requests (id) on delete cascade,
  reviewer_profile_id uuid not null references public.profiles (id),
  rating smallint not null check (rating between 1 and 5),
  driver_rating smallint check (driver_rating between 1 and 5),
  would_recommend boolean,
  comment text,
  created_at timestamptz not null default now()
);

alter table public.transport_reviews enable row level security;

create policy "requesters manage their own review"
  on public.transport_reviews for all
  to authenticated
  using (
    reviewer_profile_id = (select auth.uid())
    and exists (
      select 1 from public.transport_requests tr
      where tr.id = transport_request_id and tr.requester_profile_id = (select auth.uid())
    )
  )
  with check (
    reviewer_profile_id = (select auth.uid())
    and exists (
      select 1 from public.transport_requests tr
      where tr.id = transport_request_id and tr.requester_profile_id = (select auth.uid())
    )
  );

create policy "ops staff view all reviews"
  on public.transport_reviews for select
  to authenticated
  using (public.is_ops_staff());

grant select, insert, update, delete on public.transport_reviews to authenticated;

-- Public aggregate only — rating number and count, never the comment text or reviewer identity.
create view public.public_transport_rating
  with (security_invoker = false) as
select
  round(avg(rating)::numeric, 1) as average_rating,
  count(*) as review_count
from public.transport_reviews;

grant select on public.public_transport_rating to anon, authenticated;
