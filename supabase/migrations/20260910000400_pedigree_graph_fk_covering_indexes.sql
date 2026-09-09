-- Post-apply performance-advisor fixup (unindexed_foreign_keys): the schema migration
-- (20260910000100) indexed the hot-path FKs (child/parent dog, breed, kennel, submission→source,
-- dog→claims) but not the reviewer / creator / audit-column FKs, which Postgres still wants a
-- covering index on for cascade-delete performance and the occasional lookup.
-- `dog_claims.claimant_profile_id` in particular is the exact column the "claimants view their own
-- claims" RLS policy filters on. Matches this repo's dedicated-index-migration pattern
-- (20260101008500, 20260101009000). The two pre-existing hits the advisor also lists
-- (achievements_parent_dog_id_fkey, parent_dogs_breed_id_fkey) are out of scope here and left alone.

create index if not exists dogs_created_by_idx on public.dogs (created_by);
create index if not exists dogs_current_owner_profile_id_idx on public.dogs (current_owner_profile_id);

create index if not exists dog_parent_relationships_created_by_idx
  on public.dog_parent_relationships (created_by);

create index if not exists dog_claims_claimant_profile_id_idx
  on public.dog_claims (claimant_profile_id);
create index if not exists dog_claims_organisation_id_idx on public.dog_claims (organisation_id);
create index if not exists dog_claims_reviewed_by_idx on public.dog_claims (reviewed_by);

create index if not exists dog_match_candidates_candidate_dog_id_idx
  on public.dog_match_candidates (candidate_dog_id);

create index if not exists litters_auto_pedigree_source_id_idx
  on public.litters (auto_pedigree_source_id);

create index if not exists pedigree_relationship_sources_source_id_idx
  on public.pedigree_relationship_sources (source_id);
create index if not exists pedigree_relationship_sources_submission_id_idx
  on public.pedigree_relationship_sources (submission_id);

create index if not exists pedigree_sources_organisation_id_idx
  on public.pedigree_sources (organisation_id);
create index if not exists pedigree_sources_reviewed_by_idx on public.pedigree_sources (reviewed_by);

create index if not exists pedigree_submission_resolutions_resolved_dog_id_idx
  on public.pedigree_submission_resolutions (resolved_dog_id);

create index if not exists pedigree_submissions_accepted_by_idx
  on public.pedigree_submissions (accepted_by);
create index if not exists pedigree_submissions_subject_dog_id_idx
  on public.pedigree_submissions (subject_dog_id);
create index if not exists pedigree_submissions_submitted_org_id_idx
  on public.pedigree_submissions (submitted_org_id);
