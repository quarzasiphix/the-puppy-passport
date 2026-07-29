# Loading/empty/error state coverage audit

Source-level check (no live app available during this pass — see
`docs/POST_INTEGRATION_HARDENING_STATE.md`) for `useQuery` call sites with no `isLoading`/
`isPending` handling at all, per CLAUDE.md's rule: "Add loading, empty, success and error states
for anything touching the database."

## Method

Grepped every `src/routes/_public.*.tsx` and `src/routes/dashboard.*.tsx` for files that call
`useQuery(` at least once but never reference `isLoading`/`isPending` anywhere in the file.

## Findings — real gaps, not fixed in this pass

6 dashboard "home" pages call multiple parallel `useQuery`s and destructure only `data` from each,
with no loading state shown while any of them are in flight:

- `dashboard.admin.index.tsx`
- `dashboard.breeder.index.tsx` (5 parallel queries: kennel, litters, puppies, reservations,
  transportRequests)
- `dashboard.breeder.tsx`
- `dashboard.foundation.index.tsx`
- `dashboard.foundation.tsx`
- `dashboard.operations.index.tsx`

**Deliberately not fixed here.** Each of these pages has multiple independent queries feeding
different summary cards/stats — adding a correct loading state means either a single
all-queries-combined skeleton or per-card skeletons, and getting that right (without introducing a
layout-shift or a stale-looking "0" flash worse than what exists today) needs to be checked against
the real rendered page, not guessed from source alone. Given the shared local Supabase instance
was not confirmed free of Bot 1's certification activity during this pass, live verification wasn't
possible, and a wrong fix across 6 dashboard home pages carries more risk than the smaller,
independently-verifiable accessibility/i18n fixes made in this same session. Flagged here as a
real, scoped follow-up rather than either silently skipped or rushed.

## Not a gap

Every other route file with a `useQuery` call does destructure and handle `isLoading` — this
appears to be specifically a "dashboard index/overview page" pattern, not a widespread issue.
Route-`loader`-based pages (the majority of `_public.*` pages) don't need client-side loading state
at all — TanStack Start blocks navigation until the loader resolves (with `pendingComponent` support
if a page wants an explicit in-between state), which is a legitimate alternative to `useQuery` +
`isLoading`, not a gap.
