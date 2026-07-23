-- docs/adr/TRANSPORT_DATA_MODEL.md, "How each required scenario is represented" table:
-- transport_documents was keyed only by transport_request_id — no notion of which *party* a
-- document belongs to (an "ownership declaration" and a "pickup authorisation" are both just rows
-- differing by `category`, not linked to the specific party they concern). Additive, nullable,
-- never backfilled: existing documents have no way to know retroactively which party they belonged
-- to, so they stay unlinked exactly as before ("do not invent missing information").
alter table public.transport_documents
  add column transport_party_id uuid references public.transport_parties (id) on delete set null;

-- A document's party must belong to the same transport request the document itself is on —
-- otherwise a party_id from an unrelated request could be attached, which would be meaningless and
-- would leak nothing (RLS still gates by transport_request_id) but would be simply wrong data.
create or replace function public.check_transport_document_party_matches_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.transport_party_id is not null and not exists (
    select 1 from public.transport_parties tp
    where tp.id = new.transport_party_id and tp.transport_request_id = new.transport_request_id
  ) then
    raise exception 'transport_party_id must belong to the same transport request as the document'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger check_transport_document_party_matches_request
  before insert or update on public.transport_documents
  for each row execute function public.check_transport_document_party_matches_request();
