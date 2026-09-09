# TODO — Global kennel/cynological association registry

Status: **idea captured 2026-09-10, not yet designed or built.** Deliberately sequenced *after* the
in-flight pedigree architecture work lands (see the pedigree feature's own final report once it's
done) — that work is independently defining a "registry/association source" concept for pedigree
provenance ("organization/registry where relevant" on a pedigree source record), and this table
should become the one real thing that concept points at, not a second, differently-shaped table
built in parallel and reconciled later.

## The idea

A **full, structured, worldwide directory of kennel clubs / cynological associations**
("związek kynologiczny") — e.g. FCI-member national clubs (ZKwP, PKR in Poland; The Kennel Club in
the UK; AKC in the US; etc.), independent registries, and breed-specific clubs. Not a free-text
field — a real, searchable entity every breeder org and every pedigree source can reference.

Two purposes, both real:

1. **Breeder-side personalization**: `organisations.association_name` today is plain free text —
   every breeder retypes their association's name with no consistency, no validation, no way to
   query "show me every breeder affiliated with ZKwP." A breeder should instead **search and pick**
   their association from this directory when setting up their profile, which then:
   - Powers the existing `organisation_trust_claims` "association" claim precisely (an actual FK to
     a real association row, not a string to eyeball) — see
     `supabase/migrations/20260909001000_breeder_trust_claims.sql` from this session.
   - Could personalize the breeder's panel/profile around that association's own conventions
     (numbering format, recognized breed groups, required fields) — real product idea, not yet
     designed.
2. **SEO**: each association becomes its own permanent, indexable directory page — "Dog breeders on
   Anemalo affiliated with ZKwP," "Yorkshire Terrier breeders — FCI Group 3," etc. A genuinely
   strong long-tail SEO surface (breed + association + country combinations), same spirit as the
   breeder-profile/dog-page indexability work already done this session.

## What "grouping types" means — two different axes, don't conflate them

- **Type of association itself**: FCI-affiliated national kennel club vs. independent/non-FCI
  registry vs. breed-specific club vs. regional club, etc.
- **FCI's own breed-group taxonomy**: the FCI's fixed 10-group breed classification (Group 1
  Sheepdogs, Group 2 Pinscher/Schnauzer/Molossoid, ... Group 10 Sighthounds) — a separate, much more
  stable reference list an association *uses*, not a property of the association's type. Non-FCI
  registries (e.g. AKC) use their own different group system — don't hardcode "the" group list as
  if FCI's is universal.

## Sketch (not a commitment — revisit once the pedigree agent's schema is real)

- A `kennel_associations` (or similar) reference table: name (+ localized names — this matters,
  Polish/English/etc.), country, website, logo, association type, parent/umbrella association
  (e.g. a national FCI member club vs. FCI itself), verification/source of the directory entry
  (who confirmed this association is real — same provenance discipline as everything else this
  session, never just "trust the list").
- A separate `breed_group_systems`/`breed_groups` reference (FCI's 10 groups as one seeded system;
  room for other registries' own systems later) — deliberately not assumed to be one universal list.
- `organisations.kennel_association_id` (new, nullable FK) alongside the existing
  `association_name` text column (kept for backward compatibility / associations not yet in the
  directory) — a real migration path, not a breaking rename.
- Feeds the pedigree source-provenance model's "organization/registry where relevant" field once
  that model exists for real.

## What needs to happen before this is a real plan

1. Wait for the in-flight pedigree architecture pass to finish and read its actual schema for
   "registry/organization" on a pedigree source — design this table to match that, not
   independently.
2. Decide initial data-population strategy: seed a real, curated starter list (FCI + its member
   national clubs is a well-documented, finite, findable list) vs. let it grow purely from breeder
   self-entry with admin review — almost certainly a mix, but not decided.
3. Design the SEO directory pages (`/associations/$slug` or similar) — new work, not sketched yet.
4. Only after 1–3: migrate `organisations.association_name` free text onto the new FK, and build the
   breeder-facing search/select UI.
