create type public.quotation_status as enum (
  'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'replaced'
);

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  transport_request_id uuid not null references public.transport_requests (id) on delete cascade,
  service_type public.transport_service_type not null,
  pickup text,
  destination text,
  planned_date_range text,
  estimated_route text,
  base_price numeric(10, 2),
  optional_services jsonb not null default '[]'::jsonb,
  total_price numeric(10, 2),
  currency text not null default 'EUR',
  expiry_date date,
  assumptions text,
  document_conditions text,
  cancellation_conditions text,
  status public.quotation_status not null default 'draft',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_quotations_updated_at
  before update on public.quotations
  for each row execute function public.set_updated_at();

alter table public.quotations enable row level security;

-- Draft quotations are ops-internal; only sent-or-later quotations are visible to the requester —
-- "do not show a guaranteed price before review" applies here too.
create policy "requesters view sent quotations on their own request"
  on public.quotations for select
  to authenticated
  using (
    status != 'draft'
    and exists (
      select 1 from public.transport_requests tr
      where tr.id = transport_request_id and tr.requester_profile_id = (select auth.uid())
    )
  );

create policy "requesters accept or reject their own quotation"
  on public.quotations for update
  to authenticated
  using (
    exists (
      select 1 from public.transport_requests tr
      where tr.id = transport_request_id and tr.requester_profile_id = (select auth.uid())
    )
  )
  with check (status in ('accepted', 'rejected'));

create policy "ops staff manage all quotations"
  on public.quotations for all
  to authenticated
  using (public.is_ops_staff())
  with check (public.is_ops_staff());
