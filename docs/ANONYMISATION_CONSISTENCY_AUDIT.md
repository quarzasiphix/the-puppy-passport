# Anonymisation consistency audit

Stage XR-15 (append-only queue). `execute_account_deletion()` (real anonymisation, Stage AI) and
`get_account_deletion_blockers()` (its read-only dry-run, Stage CJI) were each already thoroughly
tested in isolation, but never proven consistent with each other on the *same* account — the exact
gap this stage's name and its "dry-run and execution tests" requirement point at.

## What was already correct, confirmed by reading the RPC directly

- **Never a hard delete**: `execute_account_deletion()` does an `UPDATE` on `profiles`, never a
  `DELETE` — no `ON DELETE CASCADE` anywhere is ever triggered, so referential integrity for every
  table with a `profile_id`-shaped foreign key is structurally guaranteed, not merely tested.
- **Public identity removal**: `display_name`, `first_name`, `last_name`, `email`, `phone`,
  `avatar_url`, `city`, `country` are all cleared; `is_deleted`/`deleted_at` are stamped.
- **Frontend graceful degradation for anonymised authors**: confirmed by reading real consumers
  (`_public.community.index.tsx`, `_public.community.groups.$slug.tsx`) — every place a post/
  comment's author `display_name` is rendered already has a null-safe fallback (`?? "Havenpaw
  member"`, `?? "Member"`), so content authored by a since-deleted account renders sensibly rather
  than blank or broken. Not a new fix; already correct, confirmed rather than assumed.

## New: the dry-run/execution consistency proof

New test in `tests/db/account-deletion-execution.test.ts`, on one real throwaway account across
its whole lifecycle: the dry-run reports a real blocker (an active transport request) and the real
`execute_account_deletion()` call also refuses, consistently; the blocker is resolved, the dry-run
now reports zero blockers, and the real execution call now genuinely succeeds. Also proves the
"preservation of other users and history" half directly: a real public post the account authored
survives anonymisation completely intact — its `author_profile_id` foreign key, its content, and
its existence are all untouched — while the author's own `profiles` row is genuinely anonymised
(`display_name` null, `is_deleted` true). Not two separate claims trusted independently; one
account, one continuous timeline, both properties proven true of the same real data at once.
