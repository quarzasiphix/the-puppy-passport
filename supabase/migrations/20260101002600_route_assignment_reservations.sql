create type public.route_reservation_status as enum (
  'temporarily_held', 'waiting_for_customer_action', 'confirmed', 'expired', 'released', 'cancelled'
);

alter table public.route_assignments
  add column reservation_status public.route_reservation_status not null default 'temporarily_held',
  add column hold_expires_at timestamptz;

-- route_number: a short human-facing identifier, same pattern as transport_requests.request_number.
alter table public.routes add column route_number text unique;

create sequence public.route_number_seq;

create or replace function public.set_route_number()
returns trigger
language plpgsql
as $$
begin
  if new.route_number is null then
    new.route_number := 'RT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.route_number_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

create trigger set_routes_number
  before insert on public.routes
  for each row execute function public.set_route_number();
