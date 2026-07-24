-- Stage BO (supplemental queue): duplicate detection, part 2 of 2.
--
-- Two genuinely different kinds of "duplicate" exist in this schema, handled two different ways:
--
-- 1. animals.microchip_number is meant to be a real-world physical identifier (ISO 11784/11785) --
-- two different `animals` rows can never legitimately share the same non-null chip number; that's
-- always either a data-entry mistake or an attempt to relist an animal that's already listed
-- elsewhere. Unlike the fuzzy cases below, this is unambiguous enough to be a hard database
-- constraint, not just an advisory signal -- the same "the column's value was never actually
-- validated" gap this session has repeatedly closed elsewhere (Stage BJ's currency check, Stage L's
-- quotation field lock). A case/whitespace-insensitive functional unique index catches the most
-- likely accidental near-duplicates (a re-typed chip number with different casing/whitespace)
-- without requiring a UI/normalisation change out of this stage's scope. Deliberately scoped to
-- `animals` only, not the `transport_request_animals`/`transport_requests` snapshot copies of the
-- same field -- those are legitimately repeated every time the same real animal is transported
-- again, not a second registration of the same identity.
create unique index animals_microchip_number_unique
  on public.animals (lower(trim(microchip_number)))
  where microchip_number is not null and trim(microchip_number) <> '';

-- 2. A duplicate *transport request* (the same requester accidentally submitting the same request
-- twice -- a slow UI double-click, a retried network request that actually succeeded, or someone
-- testing the flow) is fuzzy, not unambiguous like a microchip number -- a hard block would risk
-- rejecting two genuinely different requests that happen to share values (e.g. two different dogs
-- coincidentally named the same, going the same route). This is exactly the shape Stage BN's
-- risk_signals infrastructure exists for: flag it for a human to look at, never auto-block.
--
-- Fires only on an actual *submission* (status becoming 'submitted', whether that's the initial
-- insert or a later draft -> submitted update), not on every draft edit -- drafts are cheap,
-- incomplete, and routinely abandoned/rewritten, so treating every draft insert as a candidate
-- duplicate would be pure noise. Matches on the same requester having another non-final request
-- with the same animal_name/pickup_city/destination_city submitted within the last 24 hours.
create or replace function public.flag_possible_duplicate_transport_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
begin
  if new.status <> 'submitted' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'submitted' then
    return new;
  end if;

  select id into v_match_id
  from public.transport_requests
  where requester_profile_id = new.requester_profile_id
    and id <> new.id
    and status not in ('rejected', 'cancelled_by_customer', 'cancelled_by_operations')
    and lower(trim(coalesce(animal_name, ''))) = lower(trim(coalesce(new.animal_name, '')))
    and pickup_city = new.pickup_city
    and destination_city = new.destination_city
    and created_at > now() - interval '24 hours'
  limit 1;

  if v_match_id is not null then
    perform public.record_risk_signal(
      'possible_duplicate_transport_request',
      new.requester_profile_id,
      'transport_requests',
      'v1',
      format(
        'Submitted a transport request for "%s" (%s -> %s) that looks like a duplicate of an existing request (%s) from the same requester within the last 24 hours.',
        coalesce(new.animal_name, 'an unnamed animal'), new.pickup_city, new.destination_city, v_match_id
      )
    );
  end if;

  return new;
end;
$$;

create trigger transport_request_duplicate_signal
  after insert or update of status on public.transport_requests
  for each row execute function public.flag_possible_duplicate_transport_request();
