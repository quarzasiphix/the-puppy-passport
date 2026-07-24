-- Stage BF (supplemental queue): route execution/stop state machines. route_stops had no
-- uniqueness on (route_id, stop_order) -- two stops on the same route could silently share the
-- same order, making the route's sequence ambiguous (which stop does a driver actually visit
-- first?). route_stops is ops-only-write (single trusted writer, same as vehicles/routes --
-- structurally rules out the self-approval bug class found elsewhere this session), so this isn't
-- a security fix, it's a data-integrity safeguard: a real constraint catches an accidental
-- duplicate order at the database level instead of allowing silently ambiguous route data.
--
-- Deliberately not building a full route/stop status state machine here: routes.status has
-- linear-looking semantics but ops needs real override ability (a route legitimately gets
-- cancelled from any non-terminal state), and this session already learned the hard way (an
-- earlier first-draft lock trigger broke a real workflow before being redesigned) that a
-- restrictive state machine on an ops-trusted table needs the same "explicit reason + audit
-- record" override path the later IR-8 stage is explicitly scoped to build -- adding a partial,
-- unaudited version now would conflict with that dedicated work rather than complement it.
alter table public.route_stops
  add constraint route_stops_unique_order unique (route_id, stop_order);
