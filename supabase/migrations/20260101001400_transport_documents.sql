create type public.transport_document_category as enum (
  'passport', 'microchip_confirmation', 'vaccination_information', 'rabies_vaccination',
  'health_certificate', 'veterinary_examination', 'traces_reference', 'breeder_documentation',
  'foundation_documentation', 'ownership_declaration', 'sale_agreement', 'adoption_agreement',
  'transport_authorisation', 'pickup_authorisation', 'handover_protocol', 'other'
);

create type public.transport_document_status as enum (
  'missing', 'uploaded', 'under_review', 'accepted', 'rejected', 'expired', 'not_applicable'
);

create table public.transport_documents (
  id uuid primary key default gen_random_uuid(),
  transport_request_id uuid not null references public.transport_requests (id) on delete cascade,
  category public.transport_document_category not null,
  file_url text,
  status public.transport_document_status not null default 'missing',
  uploaded_by uuid references public.profiles (id),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.transport_documents enable row level security;

-- Documents are never public. Only the requester (upload/view their own) and ops/admin (review)
-- can see them — explicitly called out in the brief as never exposed publicly.
create policy "requesters manage documents on their own request"
  on public.transport_documents for all
  to authenticated
  using (
    exists (
      select 1 from public.transport_requests tr
      where tr.id = transport_request_id and tr.requester_profile_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.transport_requests tr
      where tr.id = transport_request_id and tr.requester_profile_id = (select auth.uid())
    )
  );

create policy "ops staff manage all transport documents"
  on public.transport_documents for all
  to authenticated
  using (public.is_ops_staff())
  with check (public.is_ops_staff());
