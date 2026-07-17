-- Newer Supabase CLI versions default `auto_expose_new_tables` to false (see the comment in
-- config.toml): tables created by `postgres` are no longer auto-exposed to the Data API roles
-- (anon/authenticated) via implicit GRANTs. Every table in this schema already encodes the
-- correct access intent in its RLS policies' `to anon` / `to authenticated` clauses — this
-- migration just makes the matching table-level GRANTs explicit so PostgREST can reach the
-- tables at all. RLS remains the actual row-level security boundary; these GRANTs only open the
-- outer gate for the roles each table's policies already name. Tables with no `anon` policy are
-- deliberately left un-granted for anon (private_addresses, transport_requests, etc. stay
-- unreachable to anonymous requests even at the grant level, not just via RLS).

-- Tables with at least one policy `to anon` (and `authenticated`): public read, authenticated
-- read/write (still governed by each table's own RLS policies).
grant select on
  public.animal_images,
  public.animals,
  public.breeds,
  public.comments,
  public.groups,
  public.litters,
  public.organisations,
  public.parent_dogs,
  public.posts,
  public.pricing_rules,
  public.reactions,
  public.transport_operator_authorisations
to anon;

grant select, insert, update, delete on
  public.animal_images,
  public.animals,
  public.breeds,
  public.comments,
  public.groups,
  public.litters,
  public.organisations,
  public.parent_dogs,
  public.posts,
  public.pricing_rules,
  public.reactions,
  public.transport_operator_authorisations
to authenticated;

-- Tables with only `to authenticated` policies: no anon access at all, even at the grant level.
grant select, insert, update, delete on
  public.animal_ownership_history,
  public.audit_logs,
  public.buyer_applications,
  public.compliance_reviews,
  public.conversation_participants,
  public.conversations,
  public.drivers,
  public.follows,
  public.group_members,
  public.handover_protocols,
  public.messages,
  public.moderation_cases,
  public.notifications,
  public.organisation_members,
  public.private_addresses,
  public.profiles,
  public.quotations,
  public.rehoming_reviews,
  public.reports,
  public.reservations,
  public.route_assignments,
  public.route_stops,
  public.routes,
  public.saved_animals,
  public.saved_posts,
  public.transport_documents,
  public.transport_parties,
  public.transport_requests,
  public.transport_status_history,
  public.user_roles,
  public.user_verifications,
  public.vehicles
to authenticated;
