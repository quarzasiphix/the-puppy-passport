# Breeder panel — gap analysis (Phase D)

Status: **analysis only, 2026-09-10. No UI implemented, no migration applied.**

Compares Gryfin York's admin panel (`/p/grif/c`, the reference single-breeder panel) against
Anemalo's breeder dashboard (`src/routes/dashboard/breeder/*` + `src/domains/*`), to size the work
that makes an Anemalo breeder able to run their kennel end-to-end from one account.

Cross-refs: the write-gate widening list and the `admin_create_kennel()` gap are **already worked
out** in `docs/API_GATEWAY_AND_MULTI_TENANT_BREEDERS.md` §5–§6 — cited here, not re-derived. The
import mapping is in `docs/GRYFIN_IMPORT.md`.

## Feature-by-feature

Legend: **✅ working** (real Supabase CRUD + UI) · **🟡 partial** (works but narrower than Gryfin,
or owner-only where a team is needed) · **📄 schema-only** (tables/RLS exist, no UI) ·
**❌ missing** (no table, no UI).

| Gryfin panel area | Anemalo equivalent | State | Notes |
|---|---|---|---|
| **Site settings** (`ustawienia`): kennel name, phone, email, location, socials, section toggles, logo | `dashboard/breeder/settings.tsx` + `profile.tsx`; `organisation_site_configurations` (theme, `visible_sections[]`/`section_order[]`, language, `contact_mode`, branding) + `organisations` fields | 🟡 | Section visibility/order, theme, colour, branding flag all editable (`kennel-site.ts`). **Gaps:** no logo/cover *upload* (URL text field only — `profile.tsx` has `logoUrl`/`coverImageUrl` inputs); no social-link fields at all (Gryfin has Facebook/TikTok — Anemalo `organisations` has no column, see `GRYFIN_IMPORT.md`); section toggles are richer than Gryfin's 4 booleans, fine. |
| **Custom domain** | `organisation_domains` table | 📄 | Schema only (`docs/SOCIAL_DOMAIN.md`). No "Domains" card in `settings.tsx`, no TXT-verify flow. Design in `API_GATEWAY_AND_MULTI_TENANT_BREEDERS.md` §8. |
| **Breeding dogs** (`psy`): add/edit sire/dam, photos, health, achievements, pedigree text, character, retire | `dashboard/breeder/parent-dogs.tsx` + `parent-dog-form-dialog.tsx`; `domains/animals/services/breeder.ts` (`listKennelParentDogs`, create/update via dialog); `parent_dogs` (+ auto `dogs` identity) | ✅ | CRUD + active toggle work. Multi-photo: `parent_dogs` has one `profile_image_url` slot (Gryfin has `photo_urls[]`) — minor gap. `achievements` are a **separate table + screen** in Anemalo (richer than Gryfin's free-text array). |
| **Litters** (`mioty`): plan/born, mother+father link, dates, expected colours, count, status, visibility | `dashboard/breeder/litters.tsx` / `litters.index.tsx` / `litters.$id.tsx`; `createLitter`/`updateLitter`; `litters` table | ✅ | Full CRUD. Anemalo `litters` links `mother_id`/`father_id` → `parent_dogs`; litter→puppy trigger propagates pedigree edges. Gryfin's `expected_colors[]` / `accepting_requests` have no direct column (fold into `description` / `status='applications_open'`). |
| **Puppies** (`szczenieta`): add per litter, sex/colour/DOB, ready date, status, photos, description, temperament, socialisation, health, weight, publish, feature | `dashboard/breeder/puppies.tsx`; `createPuppy`/`updatePuppy`; `animals` (`listing_category='breeder_puppy'`) + `animal_images` | ✅ | CRUD + `publishMutation` + `reserveMutation`. Gryfin `ready_from` and `expected_weight` free-text map loosely (`weight_kg` / `litters.ready_date` / description). Price exists in Anemalo, absent in Gryfin. |
| **Gallery** (`galeria`): free-standing images, categories, captions, per-image visibility, dog linkage | — | ❌ | **No org-level gallery table or route.** `animal_images` requires an `animal_id`; `parent_dogs` has a single image slot. Gryfin's standalone/category images have no home. Import defers them (`GRYFIN_IMPORT.md`). Needs an `organisation_media` / `organisation_gallery_images` table + a `dashboard/breeder/gallery.tsx`. |
| **Reviews / testimonials** (`opinie`): customer name, dog, text, rating, photo, publish | — | ❌ | **No reviews table.** `docs/SOCIAL_DOMAIN.md` lists a `reviews` kennel-page section but there is no schema. Options: a new `organisation_reviews` table, or a `review` post type in the social `posts` domain. Import defers them. |
| **Enquiries / leads** (`zapytania`): contact-form submissions, status (new/contacted/done), phone/email quick actions | `dashboard/breeder/applications.tsx` (`buyer_applications`) — *different shape* | 🟡 | `buyer_applications` is a full structured adoption/purchase application (auth buyer, housing, experience, …) with `respondMutation`/`messageMutation`/`reserveMutation`. There is **no lightweight anonymous "message this breeder" capture** like Gryfin's `enquiries`. Proposed `organisation_enquiries` + `submit_org_enquiry()` in `API_GATEWAY_AND_MULTI_TENANT_BREEDERS.md` §2. Import defers historical enquiries. |
| **Reservations** | `dashboard/breeder/reservations.tsx` → `domains/reservations` (`BreederReservationsPage`); `reservations` + `reservation_payment_events` (Stripe zaliczka work, `docs/RESERVATION_PAYMENT_DESIGN.md`) | ✅ | Anemalo-only — Gryfin has no reservation/deposit concept beyond puppy status. Ahead of Gryfin. |
| **Applications** (buyer) | `dashboard/breeder/applications.tsx` | ✅ | Anemalo-only richer flow. |
| **Pedigree management** | `dashboard/breeder/pedigrees.tsx`; `domains/pedigrees`; pedigree graph (`docs/PEDIGREE_GRAPH.md`) — `dogs`, `dog_parent_relationships`, `pedigree_sources`, submissions/resolutions | ✅ | Anemalo-only, well beyond Gryfin's free-text `pedigree` field. Breeder can attach sources to owned dogs. |
| **Champions** | `dashboard/breeder/champions.tsx` (reads `achievements` of the kennel) | ✅ | Anemalo-only surface. |
| **Achievements** | `dashboard/breeder/achievements.tsx`; `createAchievement`; `achievements` table (`verification_status`) | ✅ | Anemalo-only, structured + verifiable vs Gryfin's text array. |
| **Documents** | `dashboard/breeder/documents.tsx` | ❌ | Explicit `<NotImplemented>` placeholder. Not a Gryfin feature either — low priority. |
| **Messages** | `dashboard/breeder/messages.tsx`; `conversations` / `messages` (relationship-gated RPCs) | ✅ | Anemalo-only. |
| **Transport** | `dashboard/breeder/transport.tsx` | ✅ | Anemalo-only. |
| **Team members** | — (but `dashboard/foundation/team.tsx` **exists and is complete**) | ❌ UI / ✅ backend | `organisation_members` + all invitation RPCs + `src/domains/identity/services/team.ts` are done. Only `dashboard/breeder/team.tsx` is missing — a near-verbatim mirror of the foundation screen (swap `getMyFoundation`→`getMyKennel`, adjust `invitableRoles`, gate on `getKennelCapabilities(plan).canAddTeamMembers`). Nav entry in `src/app/config/navigation.ts`. |

## The team / write-gate problem (cited, not re-derived)

Even once `team.tsx` exists, invited members **can't do anything** — almost every breeder-dashboard
write is gated `owns_org()` (owner only) at the RLS layer. `docs/API_GATEWAY_AND_MULTI_TENANT_BREEDERS.md`
§5 lists the **13 policies** to widen to a role-aware `org_member_can(org_id, capability)` predicate
(`litters`, `parent_dogs`, `animals`, `animal_images`, `achievements`, `reservations` ×3,
`buyer_applications` ×2, `notifications`, `private_addresses`, `organisation_site_configurations`,
`organisation_domains`, `transport_requests`, `transport_request_animals`) plus an
`enforce_publish_capability` trigger so a `viewer` can't flip `is_published`/`price`. That doc also
has the role→capability matrix. **Not repeated here.**

`docs/SOCIAL_DOMAIN.md` already widened `posts` "post as kennel" from `owns_org()` to
`is_org_member()` — the precedent exists.

## Admin onboarding gap (cited)

`approve_user_verification()` is the only path that creates an `organisations` row, and it needs a
user-submitted `user_verifications` row and does **not** seed `organisation_site_configurations`.
There is no admin "create a kennel directly" RPC. `docs/API_GATEWAY_AND_MULTI_TENANT_BREEDERS.md`
§6 specifies `admin_create_kennel(...)` + an `admin/onboard-breeder` screen. **Not repeated here.**

## Prioritised fill-in list

Ordered by "unblocks the most", each independently shippable. UI work is **not** started this pass.

| # | Item | Type | Blocks / enables | Effort |
|---|---|---|---|---|
| 1 | `org_member_can()` helper + re-`CREATE POLICY` for the 13 gates + publish-capability trigger + `test:db` coverage | migration | Everything team-related; nothing else works for a helper until this lands | M–L |
| 2 | `dashboard/breeder/team.tsx` (mirror foundation) + nav entry + `canAddTeamMembers` gate | UI | Breeders add helpers | S |
| 3 | `admin_create_kennel()` RPC + seed site-config in `approve_user_verification()` + `dashboard/admin/onboard-breeder.tsx` | migration + UI | Proactive breeder onboarding (incl. Gryfin) | M |
| 4 | `organisation_enquiries` table + `submit_org_enquiry()` (IP rate-limited) + a leads view in the breeder dashboard | migration + UI | Anonymous "contact this breeder" capture (Gryfin parity); wires `POST /v1/enquiry` in the gateway; unblocks Gryfin enquiry import | M |
| 5 | `organisation_media` (or `organisation_gallery_images`) table + `dashboard/breeder/gallery.tsx` | migration + UI | Gryfin gallery parity; unblocks Gryfin gallery import | M |
| 6 | Reviews: decide `organisation_reviews` table vs `review` post type, then table + `dashboard/breeder/reviews.tsx` | decision + migration + UI | Gryfin reviews parity; unblocks Gryfin testimonial import | M |
| 7 | Logo/cover **upload** (not URL field) in `settings.tsx`/`profile.tsx` via the existing storage abstraction (`src/lib/storage/media.ts`) | UI | Real onboarding UX (`CLAUDE.md` bar) | S |
| 8 | Social-link fields (`organisations.social_links jsonb` or a small table) + inputs in `settings.tsx` | migration + UI | Gryfin Facebook/TikTok parity | S |
| 9 | "Domains" card in `settings.tsx` + TXT-verify flow (`resolve_org_by_hostname()` / `verify_org_domain()` RPCs, gateway endpoint, Cron re-check) | migration + UI + gateway | Custom breeder domains (`API_GATEWAY_AND_MULTI_TENANT_BREEDERS.md` §8, roadmap P6) | L |
| 10 | `dashboard/breeder/documents.tsx` (currently `<NotImplemented>`) | UI | Not a Gryfin feature — lowest priority | M |

Items 1–3 are the load-bearing sequence for "a Gryfin-style kennel, run by a small team, onboarded
by staff". Items 4–6 close the remaining Gryfin feature parity and unblock the three deferred
import categories. 7–10 are polish.

## Not done this pass

- No UI implemented. No migration applied. No RPC created.
- The write-gate migration, `admin_create_kennel()`, and the domain-resolution RPCs are specified
  in `docs/API_GATEWAY_AND_MULTI_TENANT_BREEDERS.md`, not written.
