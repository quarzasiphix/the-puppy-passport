-- Stage BO (supplemental queue): duplicate detection, part 1 of 2. Adds the new risk_signal_type
-- value this stage needs. Split into its own migration file, consumed only starting in the next
-- one (20260101010700) -- deliberately NOT added and used in the same file: this project's own
-- migration-quality audit (Stage AL) already confirmed the codebase's established, safe pattern
-- for `alter type ... add value` is one commit per value, consumed starting in a later migration
-- (see 20260101007700_organisation_team_management.sql / 20260101007800), never in the same
-- transaction that also uses the new value.
alter type public.risk_signal_type add value 'possible_duplicate_transport_request';
