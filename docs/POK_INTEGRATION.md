# POK (and future kennel-club) integration boundary

Status: **the Anemalo side is now ready to receive; no live connection exists.** The pedigree
graph is applied (`supabase/migrations/20260910000100`–`000400`, see `docs/PEDIGREE_GRAPH.md`) — a
registry-sourced fact has a real home now (`pedigree_sources.source_type = 'registry_record'` +
`dog_parent_relationships.verification_level = 'registry_verified'`). What's still missing is the
agreed export format from POK, the import job, and the legal agreement below.

## How POK actually stores rodowody (reviewed 2026-09-10, `/p/pok`)

- **`dogs_registry`** — the canonical registered dog: `pkr_number` (unique), `pedigree_number`,
  `name`, `breed`, `sex` (`pies`/`suka`), `birth_date`, `chip_number`, self-referencing
  `father_id`/`mother_id` (+ denormalised `father_name`/`mother_name`), `kennel_id`/`kennel_name`,
  `breeder_id`/`breeder_name`, `owner_id`/`owner_name`. POK is a single registry authority, so one
  canonical parent per role is always correct there — the opposite of Anemalo's crowdsourced,
  multi-source `dog_parent_relationships`.
- **`issued_pedigrees`** — a certificate POK *issued*, with an immutable `source_snapshot jsonb`
  (point-in-time copy of everything printed on the cert), `certificate_number` (unique),
  `issue_date`/`issue_place`, `cancelled_at`, `is_export`. Reissues are versioned
  (`20260713_pedigree_reissue_versioning`).
- **`source_pedigrees`** (`20260818_source_pedigree_provenance`) — the piece most relevant to
  Anemalo: when a POK-registered dog *carries a pedigree from another organisation* (ZKwP, FCI,
  …). Columns: `source_organization`, `source_pedigree_number`, `source_country`; staff-set,
  **never auto-diffed** `microchip_match` / `parents_match` (`match`/`mismatch`/`not_checked`),
  `ancestry_transferred_from_source`, optional record-backed `dna_parentage_status`
  (`confirmed`/`not_tested`) / `health_test_status` / `breeding_qualification_status` (all
  nullable, and **a null must never render as a negative finding**); a **private original scan**
  (`dogs_registry.external_pedigree_scan_path`, path only, private `pedigree-docs` bucket) plus a
  **public-safe redacted + watermarked derivative** (`redacted_scan_path`); `verified_at` /
  `verified_by` — a deliberate staff act, not an algorithm.
- **Public read path** — never a direct table read. A `check-pedigree` **edge function** (service
  role) is the only caller of `get_public_dog_check_by_code(public_code)` and
  `get_public_dog_snapshot_by_code(public_code, security_code)` (SECURITY DEFINER RPCs, EXECUTE
  revoked from anon/authenticated). Public payload = dog identity + registration numbers + kennel +
  sire/dam names + titles + cert number/date + a `sourcePedigree` block **only when a
  `source_pedigrees` row exists** (present-or-absent, never a nulled placeholder). Every
  source-pedigree action is an `event_store` row (audit trail).
- OCR: POK has a `scan-pedigree` edge function + tesseract — used to *assist a human transcribing*
  a scanned rodowód, output always reviewed, never written straight to canonical records.

## Mapping POK → Anemalo (using the now-applied schema)

| POK | Anemalo |
|---|---|
| A POK-registered dog | a `public.dogs` row, `created_via = 'system_import'`, `kennel_id` → the POK-linked `organisations` row (`org_type = 'kennel_club'`) if the kennel is on Anemalo, else `kennel_name` free-text only |
| `dogs_registry.father_id`/`mother_id` | one `dog_parent_relationships` edge each (`role` sire/dam) |
| The fact "POK confirms this parentage" | a `pedigree_sources` row: `source_type = 'registry_record'`, `organisation_id` = the POK `kennel_club` org, `review_state = 'accepted'`, linked to each edge via `pedigree_relationship_sources`. `recompute_dog_parent_relationship_verification()` already promotes such an edge to `registry_verified` **only** when the source is `registry_record` + `accepted` + from a `kennel_club` org — no code change needed. |
| POK `source_pedigrees` (a *foreign* pedigree POK itself is vouching for) | same shape — a `pedigree_sources` row whose `organisation_id` is POK and whose `document_metadata` carries `source_organization`/`source_pedigree_number`/`microchip_match`/`parents_match`/`dna_parentage_status` verbatim from POK. |
| POK private original scan | never imported. |
| POK `redacted_scan_path` (public watermarked derivative) | MAY be imported into `pedigree_sources.public_redacted_path` (the column exists, reserved for exactly this) if POK's agreement permits redistributing it. |
| POK `check-pedigree` service-role-only read pattern | mirrored by the Anemalo gateway (`api.anemalo.com`, being designed) — anon never touches a base table, only curated `public_*` views / service-role RPCs. |
| POK OCR-assisted transcription | Anemalo's `PedigreeDocumentExtractor` interface (no-op stub today) — same "assist a human, never auto-write" stance. |

## What Anemalo may receive (an **approved public projection** per registered dog)

- registered dog identity, registration number(s), breed, sex, birth date
- kennel **name** (a person's/owner's name is *not* in the default projection — see legal §3)
- sire and dam (identity + registration number)
- approved public titles
- for a `source_pedigrees` case: `source_organization`, `source_pedigree_number`, `source_country`,
  and the staff-set match/verification statuses **as POK recorded them** (Anemalo stores, never
  re-derives)
- registry verification source (`"POK"`) + a synchronisation timestamp

## What Anemalo must NEVER import

Private addresses, personal phone numbers/emails, signatures, identity documents, payment
information, internal office notes, disciplinary information, private ownership documents,
**unredacted** source documents, `people_directory` rows. If a sync pipeline receives any of these,
they are dropped before anything reaches a `public` schema table — never "just in case".

## Conflict handling (already enforced in the applied schema)

`upsert_parent_relationship()` never silently overwrites a different existing active parent for the
same child+role — it moves both rows to `status = 'disputed'` and surfaces them for human review. A
community submission therefore *cannot* clobber a registry-sourced edge, and vice-versa. A
registry-sourced edge that conflicts with an existing community one is a `disputed` pair a
moderator resolves, not an auto-merge.

## Display contract

A registry-confirmed relationship is always attributable:

> Pedigree relationship confirmed by POK · Source: POK registry · Last synchronised: [date]

Never an unattributed "Verified" badge — `verification_level` + the source's `organisation_id`
travel together, and the dog page renders per-edge level, not one blanket claim.

## Multi-registry federation — WDF and beyond (direction, not yet built)

The user is pursuing a mutual data-access arrangement with a second kennel club ("WDF") — a
potential collaboration, not yet agreed. Identified 2026-09-11 via web search (WDF's own site was
unreachable to fetch directly — connection reset on every attempt — so the facts below come from
search-result snippets, not a full page read; verify directly with WDF before relying on any of
this for a real agreement):

- **World Dog Federation (WDF)** — "International Federation for the Genetic Protection of Canine
  Breeds." Founded **2017**, president **Ciro Boiano**, registered with the Italian Ministry
  (statutes on file), address given as *Via Difesa 1/A, Roccarainola NA 80030, Italy*. Recognised/
  registered as an association in 2021. Site: `wdf-international.org`.
- **Structurally separate from FCI** — WDF is its own international umbrella body, not a branch or
  project of the Fédération Cynologique Internationale. Italy's FCI-affiliated national club is
  **ENCI** (Ente Nazionale della Cinofilia Italiana, est. 1882) — a *different* organisation from
  WDF's own Italian member, **ICBD (Club Italiano Cani di Razza)**. A WDF pedigree is therefore
  **not** an FCI-recognised document; when this becomes a real `kinological_organisations` seed
  row (`docs/KINOLOGICAL_ORGANISATION_REGISTRY.md`), it must sit outside the FCI relationship
  tree, not under it — factual labelling only, per that doc's "never judgemental" trust posture.
  WDF membership is one national member/contractual partner per country; each issues its own
  pedigrees and trains its own judges, mutually recognised across WDF members.
- **Poland — CONFIRMED by the user 2026-09-11: POK *is* the WDF-affiliated Polish body.** A search
  hit named it *"Narodowy Związek Kynologiczny Polski — Project of WDF"*, distinct from ZKwP
  (Poland's separate FCI-affiliated national club since 1938). This **collapses "the POK connector"
  and "the WDF collaboration" into one relationship, not two**: POK is WDF's Polish national
  member, so a POK↔Anemalo connector already sits inside the WDF network, and a future WDF-level
  agreement (with the Italian umbrella body directly, or with another national WDF member) is the
  *same* federation this doc's one-directional design already anticipates — not a second,
  unrelated integration to scope from scratch. Re-read this doc's earlier sections (esp. "Start
  one-directional") with POK *as* the concrete WDF instance, not a generic placeholder.
- No sign of an existing digital pedigree database, API, or tech platform on WDF's side in what
  the search surfaced — the "access each other's databases" idea is very likely starting from
  scratch on their end too (POK included), not integrating with something already built.

The schema already supports N registries: each is an `organisations` row with `org_type =
'kennel_club'`, each contributes its own `pedigree_sources` rows, and a single edge can carry
sources from **both** POK and WDF (that's the M:N `pedigree_relationship_sources` — corroboration
across registries is a *strength* signal, not a conflict). `recompute_..._verification()` would
need a tiny extension only if we want "two independent registries agree" to read differently from
"one registry says so" — worth doing, one `elsif` branch.

**Start one-directional.** POK → Anemalo (Anemalo consumes an approved projection, read-only) is
low-risk and fully covered by the model above. Anemalo → POK writes — or a true "access each
other's databases" — makes each platform depend on the other's data quality and needs its own
separate agreement + a much more careful trust model; treat it as a later phase, and even then
prefer a *review-item feedback channel* ("an Anemalo user reports this scan differs from the
record") over Anemalo writing into POK.

## Legal checklist (the "idk how to sort that legally" part)

Not legal advice — the concrete items to get a lawyer to paper before any data crosses:

1. **A written data-sharing agreement** between each registry (POK, WDF) and the Anemalo operating
   entity. Defines: exact fields shared, purpose limitation (populate public pedigree records
   only), no onward sale, retention, sub-processing, security, liability for inaccuracy,
   termination + deletion on termination, and direction (one-way vs mutual — see above).
2. **Lawful basis on the *registry's* side for onward disclosure.** The dog's owner/breeder is
   POK's member, not Anemalo's. POK's own membership terms / privacy notice must permit sharing the
   *public projection* with a partner platform — if they don't today, POK adds it (and decides
   opt-in vs opt-out). Anemalo cannot cure this gap from its side; make it a precondition, in
   writing, from POK.
3. **Personal data minimisation (GDPR).** Dog identity, registration numbers, breed/sex/DOB,
   titles, kennel *name*, sire/dam are not personal data (or are already public registry facts).
   **A breeder's or owner's personal name is borderline** — POK's own public `check` page shows
   `ownerName`/`breederName`, so there's registry precedent it's publicly checkable, but Anemalo's
   safer default is: surface **kennel name** publicly, keep a person's name operations-only unless
   that person has an Anemalo account and opts in (this matches Anemalo's existing
   `profiles`-contact-lockdown posture). Confirm per registry.
4. **Accuracy & correction rights.** A data subject can ask for correction. The agreement must
   route a correction request to the **authoritative registry** (POK owns the record; Anemalo
   corrects its cached projection on the next sync, and exposes a "report an error" path that files
   a review item, never a direct edit of a `registry_record`-sourced edge).
5. **Attribution & non-repudiation.** Anemalo always names the source registry and the sync date
   (the display contract above). Anemalo never presents a POK-sourced fact as its own.
6. **Redistribution of documents.** The redacted/watermarked derivative scan may only be shown
   publicly on Anemalo if the agreement explicitly grants that right; otherwise store metadata +
   verification indicators only, no image.

## Connection design (v1) — an edge-function pair, Anemalo pulls

Decided 2026-09-10. The proportionate shape for one or two partner registries. **Not built yet** —
blocked on the data-sharing agreement, POK building its partner endpoint, and the agreed projection
format (§"Next step"). Written down so it's ready when those land.

**Direction: one-way. Anemalo pulls; POK is read-only; neither side writes into the other.**
"An edge function on both sides" is fine as long as POK's side only ever *returns* the approved
projection and Anemalo's side only ever *writes into its own DB*. No mutual writes in v1 — that
doubles the trust + legal surface for zero v1 benefit (see "Multi-registry federation" above).

### POK side — one partner read endpoint

- POK already has the shape in `get_public_dog_check_by_code` / the `check-pedigree` edge function.
  A partner variant adds: **batch / incremental** access (`?since=<ISO timestamp>` → dogs whose
  record changed since then; plus `?ids=` and `?registration_number=` for targeted lookups), a
  **partner bearer API key** POK issues to Anemalo (checked against a POK-side `partner_api_keys`
  table, or just an env secret while there's one partner) — **not** a Supabase JWT, cross-project
  JWTs don't validate — **rate limiting**, and a **pull log** (what Anemalo fetched, when).
- Returns only the approved public projection (§"What Anemalo may receive"). Never private fields.
  For a `source_pedigrees` case, includes POK's staff-recorded match/DNA/verification statuses
  verbatim.
- POK needs zero knowledge of Anemalo's schema. If Anemalo's import has a bug, it re-runs without
  POK involvement.

### Anemalo side — the import job

- A **scheduled Supabase edge function or a cron endpoint on the `api.anemalo.com` gateway** — not
  the main app Worker, never browser-side, service-role only on the write path.
- Calls POK with the stored `since` cursor, transforms the response, and upserts **idempotently**:
  `dogs` (match on registration number first, weighted far above name — `search_dogs_ranked`
  already does this; a fuzzy-only match becomes a `dog_match_candidates` row for human review, never
  an auto-merge), `dog_parent_relationships` edges via `upsert_parent_relationship()` (a conflict
  with an existing edge → `disputed`, never a silent overwrite), and one
  `pedigree_sources` row per synced fact with `source_type = 'registry_record'`,
  `organisation_id` = the POK `kennel_club` org, `review_state = 'accepted'`, `document_metadata`
  carrying `source_organization` / `source_pedigree_number` / the match statuses.
- `recompute_dog_parent_relationship_verification()` then promotes the touched edges to
  `registry_verified` automatically — no code change, it already gates on exactly this
  (`registry_record` + `accepted` + `kennel_club` org).
- Dry-run mode first (report the diff, write nothing). Stores the new `since` cursor only on a
  fully successful run. Full re-sync is a manual admin action, not a schedule.

### The projection contract

A documented, **versioned** JSON shape (`v1`), agreed with POK once and reused per partner — the
`ksiegai-webhook-contract` pattern. When WDF (or any other registry) joins, it implements the same
`v1` contract against its own data; Anemalo's import job is unchanged, only a new
`organisations` row (`org_type = 'kennel_club'`) + a new partner key. A dog edge can then carry
`pedigree_sources` from **both** POK and WDF — cross-registry agreement is a corroboration signal,
handled by the M:N `pedigree_relationship_sources`, not a conflict.

### Not this

- **No** direct DB-to-DB, foreign data wrapper, or replication between the projects — it bypasses
  the projection boundary and couples the schemas (a legal and operational non-starter).
- **No** message queue / event stream — overkill for 1–2 partners and low change volume.
- **No** shared "federation service" both sides connect to — that's the eventual vision if there
  are many registries, premature now.

## Next step when a real connection begins

1. Agree the exact projection schema/format with POK (**their export or a POK-side bulk RPC**, not
   a scrape of their UI — POK already has the shape in `get_public_dog_check_by_code`; a batch
   variant, or a signed nightly export, is the clean interface).
2. ~~Build the pedigree data model~~ — **done** (`docs/PEDIGREE_GRAPH.md`).
3. Build a **server-side, service-role import job** (Supabase edge function or a scheduled Node
   worker — never browser-side) that upserts `dogs` + `dog_parent_relationships` +
   `pedigree_sources(source_type='registry_record', organisation_id=<POK org>)` +
   `pedigree_relationship_sources`, idempotently, dry-run first. Match on registration number
   (weighted far above name — `search_dogs_ranked` already does this); a fuzzy-only match is a
   `dog_match_candidates` row for human review, never an auto-merge.
4. Surface `disputed` edges and unresolved match candidates in a moderator queue before any
   registry claim can override or be overridden.
5. Only after 1–4 are proven one-directional: revisit mutual access / WDF write-back.
