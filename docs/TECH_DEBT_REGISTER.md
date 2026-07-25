# Tech Debt Register

Stage CF of the autonomous backend-hardening session (see `docs/AUTONOMOUS_BACKEND_PROGRESS.md`).
Consolidates every real, currently-open item this session found and deliberately deferred —
`docs/AUTONOMOUS_BACKEND_PROGRESS.md`'s "Known open items carried forward" section (and several
per-stage notes never promoted there) collected into one place, organized by what kind of gap each
one actually is and what should trigger picking it up — not chronologically. Every item here was
found by real investigation during this session, not guessed at; each cites the stage that found it.

## Missing features (not bugs — nothing to "fix," something to build when there's a real need)

| Item | Found | Why deferred | Revisit when |
|---|---|---|---|
| No outbound email delivery (no provider SDK; `email` fields are stored, never sent; org invitations work entirely via in-app token link) | Stage AC | Needs a real provider integration with real credentials this session is barred from configuring | A provider (Resend/SendGrid/etc.) is approved and credentials exist |
| No real "ownership transfer" business action — `animal_ownership_history` has RLS but nothing ever changes `animals.owner_profile_id`/`organization_id` after creation | Stage Y | The underlying action (what happens to ownership on a completed sale/adoption/rehoming) was never designed, not just unwired | That business flow gets designed as its own feature |
| No bulk-add-puppies (or any bulk import) UI — a breeder with a 6-puppy litter adds each one individually | Stage BT | No UI trigger exists to build a backend RPC against; would be dead code | Whoever next builds litter/puppy-management UI |
| No "delete this photo/document" feature anywhere — `kennel-media`'s real Storage delete policy has no UI button calling it | Stage BV | No reachable delete path to build cleanup for yet | Whoever builds that UI feature (should clean up both sides atomically from the start) |

## Known-incomplete hardening (a real fix exists, but its own scope was deliberately narrower than the whole problem)

| Item | Found | Current state | Full fix |
|---|---|---|---|
| Error-message translation (Stage BQ, `src/lib/errors.ts`) | Stage BQ | Wired into only the 2 call sites in `_public.transport.request.tsx`, the one file in this session's frontend scope | 69+ other `toast.error(err.message)` call sites across frontend-owned dashboard/marketplace routes still show raw errors — needs a broad frontend sweep outside this session's boundary |
| `src/lib/supabase/types.ts` enum fidelity | Stage BR | Hand-written stub has no `Enums` section at all — every enum-typed RPC param/column is typed as plain `string`, losing compile-time protection (Postgres still rejects an invalid value at runtime) | Full reconciliation against `supabase gen types typescript --local` output — already scoped as its own later stage, IR-5 |
| ~127 unindexed foreign-key columns | Stage N | Left unindexed — local seed data is too small for `EXPLAIN` to distinguish real need from a guess; the 3 indexes actually added had demonstrated justification (N+1 batching) | Once real usage data (`pg_stat_statements` or equivalent) identifies which are actually hot; full list regenerable via `supabase db dump` + a diff against `pg_indexes` |
| `country` field normalisation | Stage BJ | Free-text almost everywhere; only `markets.country_code` is ISO-constrained, and nothing currently joins the two together | A real behavioural gap only once something *does* need to join/compare them — fixing now would be a large, risky migration for no current gain |
| Storage-object upload rate limiting | Stage CJP | Row-level rate limiting (`enforce_rate_limit()`) covers every Postgres INSERT-based creation path (support cases, reports, messages, applications, etc.), but object uploads to `transport-documents`/`transport-evidence`/`message-attachments`/`welfare-case-documents`/`kennel-media` go directly through the Storage API, a different enforcement surface a `BEFORE INSERT` trigger on a Postgres table can't intercept | A Storage-specific limiter (e.g. a scheduled/derived count against `storage.objects` per bucket/owner, or an edge function in front of uploads) — no demonstrated abuse yet, tracked here rather than built speculatively |

## Scale/UX limitations (works correctly today, won't scale or isn't full-featured)

| Item | Found | Limitation | Note |
|---|---|---|---|
| Marketplace search (`/find-a-dog`) | Stage W | 100% client-side JS filtering over an unpaginated full fetch of every published puppy; `listPublishedPuppies()`'s filter params are never actually passed by its only caller | Route file is frontend-owned, outside this session's scope; a real server-side search contract is its own dedicated later stage, IR-2 |
| Multi-animal transport requests | pre-session (`docs/adr/TRANSPORT_DATA_MODEL.md`) | `driver_transport_job_view` and timeline queries only ever show the primary/first animal snapshot on a multi-animal request | Documented as a known non-goal; revisit if multi-animal requests become common in practice |

## Already resolved (kept here briefly for traceability, not because they're still open)

- Quotation RLS column-scoping gap — **fixed Stage L**.
- Driver status state-machine enforcement — **fixed Stage CC**.

## What this register deliberately does not include

- Anything already closed this session (see `docs/AUTONOMOUS_BACKEND_PROGRESS.md`'s stage table for
  the full list of ~50 real fixes) — this is only what's still genuinely open.
- Speculative future features with no current gap behind them (payments, a support-specific
  platform role, webhooks) — those are correctly "not yet needed," not "debt."
- General code-style preferences with no functional consequence — this register tracks real,
  demonstrated gaps, not taste.
