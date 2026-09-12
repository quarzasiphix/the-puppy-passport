# Breeder verification & trust — analysis and proposal

Status: **discussion doc, 2026-09-12. No schema changes, no code changes.** Written in response to
the product owner's request to rethink the verification/lockout model, add a WNI (weterynaryjny
numer inspektoratu) axis, and separate "verified breeder" into distinct facts. This is a review of
what already exists plus a proposal — not a decision record. See `docs/DECISIONS.md` for where
accepted decisions eventually get recorded.

## TL;DR

Most of what was asked for **already exists as a considered design** — some applied, some drafted
but not yet applied. The one genuinely new thing is the WNI/veterinary-legal axis. Concretely:

| Ask | Status |
|---|---|
| "Anyone can apply to be a breeder without being locked out of the app" | **Already true in code** — see below. Couldn't reproduce the lockout; need a repro. |
| "A random non-breeder can list their dog for adoption/rehoming, unverified" | **Already modeled**: `animals.listing_category = 'private_rehoming'`, gated by a lighter `rehoming_reviews` per-listing approval — not breeder-level verification at all. |
| "Separate 'real breeder of rasowy psy' (kennel club) from 'verified legally' (WNI)" | **Half-built**: kennel-club membership has a full drafted design (`docs/KINOLOGICAL_ORGANISATION_REGISTRY.md`, migration written, **not applied**). WNI has **no design yet** — proposed below. |
| "Table of every kynolog / przydomek, handle multi-związek membership" | **Already fully designed**, unapplied: `kinological_organisations` + `breeder_organisation_memberships` (unique per kennel×registry — multi-membership is native, not a bolt-on). |
| "Admin verifies puppies via rodowód/metryka before they show as rasowe" | **Already applied**: `pedigree_sources`, `dog_parent_relationships`, per-edge `verification_level` (Pedigree V1, live). |
| "Separate admin panel, safer, like ksiegai" | Not built. Real tradeoff, discussed below — not a clear-cut yes. |

The practical upshot: this isn't "design a verification system from scratch," it's "apply one
already-drafted migration, add one new small piece for WNI, and decide the admin-panel question."
That's a much smaller and safer project than it sounded like in the original ask.

## Correcting a premise: is anyone actually locked out today?

I could not find a lockout in the current code. Specifically:

- `dashboard/buyer/index.tsx` shows "Are you a breeder, shelter or foundation? → Get started" as an
  optional upsell card on the **normal buyer dashboard** — a signed-in user reaches it regardless of
  any pending verification.
- `user_verifications` (see `docs/DOMAIN_MODEL.md`) is already architected as an async pipeline
  *separate* from account usability: a `breeder` verification row sits in `pending` while the
  profile keeps every other role/permission it already had. `approve_user_verification()` only
  *adds* an organisation + role on approval; it never removes or gates existing access.
- I didn't find role-gating logic in `signup.tsx` that would block app usage pending review.

So either this is a stale mental model (maybe true in an early prototype and never actually true in
the current schema), or there's a specific dead-end in the `create-breeder.tsx` submission flow
itself (e.g. it redirects somewhere unhelpful, or the pending state renders as if nothing else in
the app works) that isn't the same thing as "locked out of the app." **Worth a concrete repro before
we spend effort "fixing" a lockout that may not exist** — if you remember where you saw it (a
specific screen, a specific state), point me at it and I'll check that exact path.

If the real complaint is softer — "the *messaging* around pending verification feels like a wall,
even though the app underneath still works" — that's a copy/UX fix on the existing pending state,
not a schema change.

## The four separate trust facts

Your instinct to split "verified breeder" into independent facts is correct, and it's also already
the platform's stated design principle — `docs/PRODUCT_VISION.md`: *"Claims and achievements are
always labelled with their verification state — breeder-provided, evidence uploaded, waiting for
review, verified, rejected — never presented as uniformly 'verified.'"* Four distinct facts, each
with its own evidence and lifecycle:

1. **Identity** — this is a real person/organisation, not a bot or duplicate account.
   `user_verifications(verification_type='identity')` — pipeline exists, verification method
   (document upload? video call? third-party KYC provider?) not yet decided.
2. **Legal registration to keep/breed animals (WNI)** — a Polish legal fact: an animal-breeding or
   -keeping establishment above a certain scale needs a registration number from the local
   *Inspektorat Weterynarii*. **Not modeled anywhere today.** Proposed below.
3. **Kennel-club / pedigree-breeder standing (przydomek, związek kynologiczny)** — fully designed,
   not applied: `breeder_organisation_memberships`, one row per (kennel, registry), status
   `breeder_declared → document_supplied → verified → expired → disputed`. Multi-club membership is
   native (unique per pair, not per kennel) — this already directly answers "a breeder can belong to
   multiple związki."
4. **Per-puppy pedigree (rodowód / metryka)** — already applied: `pedigree_sources` +
   `dog_parent_relationships` with a per-edge `verification_level`, never a blanket "this litter is
   verified" flag. An admin attaches/approves the metryka or rodowód document per dog, same posture
   as fact #3.

These four are independent and should stay that way — a breeder can be identity-verified with no
WNI yet (a first-time hobby breeder below the legal threshold), or WNI-verified with no kennel-club
membership (breeds without papers, or doesn't compete), or a member of two związki with different
verification states in each. Don't collapse them into one "verified breeder ✓" boolean anywhere in
the UI — the existing badge-rendering discipline (never a uniform checkmark) already prevents this
if it's followed consistently for the new facts too.

## Proposed: modeling WNI

The kennel-club membership pattern (`breeder_organisation_memberships`) doesn't fit WNI directly —
it's a many-kennel×many-registry relation because a breeder really can join several clubs. WNI is
different: one legal entity has (at most) one active registration number from one specific
inspectorate for one physical premises. That's a single fact per organisation, not a relation.

The existing `organisation_trust_claims` machinery (`OrganisationTrustClaimType =
"association" | "pedigrees" | "health_documents"`, `src/domains/trust`) is exactly shaped for a
single-fact-per-org claim with an evidence/verification lifecycle, and it already renders on the
public breeder profile (`VerificationList` in `-components/breeder-profile/verification.tsx`).
Cheapest, most consistent fix: **add a fourth claim type**, e.g. `veterinary_registration`, carrying
the WNI number + issuing inspectorate + evidence document, verified the same way `association` is
today. No new table, reuses the UI that already exists, and keeps the "claims labelled by
verification state" principle intact automatically.

Only real open question: does a WNI number need its own structured registry (like
`kinological_organisations`) or is free text + evidence document enough? Given each inspectorate is
a real government body but there's no product need to browse/cross-reference them the way there is
for kennel clubs (no SEO angle, no "which inspectorate is this" lookup use case), I'd keep it a
plain text field on the claim (`wni_number`, `issuing_inspectorate` as text) rather than a second
registry table — that's the simpler answer to "table of every kynolog," which genuinely does earn
its own registry (SEO, cross-referencing, community-suggested entries), unlike WNI.

## Manual-first verification, with a path to semi-automation

Starting fully manual is the right call — you can't train or trust an algorithm on zero labeled
data, and a wrong auto-approval is far more damaging to credibility than a slow manual one. The
schema as designed already supports the manual→semi-automated path without a rework:

- Every verification row already carries `reviewed_by`/`reviewed_at`/`notes` (user_verifications) or
  `evidence_note`/`verified_by`/`verified_at` (trust claims, kennel memberships) — this **is** your
  training data from day one, as long as reviewers leave real notes on *why* something passed or
  failed, not just approve/reject. Worth saying explicitly to whoever does the first few hundred
  reviews: write the reason, even briefly — it's free labeled data for later.
- The natural later step is not "replace the reviewer," it's "add a `confidence_score` /
  `auto_flag_reason` column that pre-sorts the review queue" — obviously-fine applications reviewed
  faster, ambiguous ones get more reviewer attention, nothing is ever auto-approved without a human
  unless you explicitly decide otherwise later. That's an additive column on the existing tables
  whenever you have enough labeled history to build it, not a redesign.

## The admin panel: a real tradeoff, not a clear yes

You said the reason is access-control simplicity, not tech-stack or team-boundary reasons. Worth
being honest about what a separate app does and doesn't buy you here, given this platform's actual
security model:

- **RLS is the real enforcement boundary already** (per this repo's own engineering rule: "Protect
  private data at the RLS layer, not just by hiding UI"). A separate admin app still talks to the
  *same* Supabase project with the *same* RLS policies and the *same* `is_admin()`/`is_moderator()`
  checks. If a bug is in RLS or in a `SECURITY DEFINER` function, a separate frontend doesn't help at
  all — the same bug is exploitable from either app, or from `curl`.
- What a separate app **does** protect against: a client-side route-guard bug that renders the admin
  UI to a signed-in-but-not-admin user (they'd see the screen, but RLS would still block their actual
  queries — annoying/embarrassing, not a real data breach), and reduces the chance of an admin route
  being reachable at all by someone poking around the main site's bundle/routes.
- A lighter way to get most of that same benefit without a second codebase/deploy/design-system to
  maintain: put admin routes behind a second, independent gate in front of the app (a separate
  subdomain with Cloudflare Access, HTTP basic auth, or a VPN/IP allowlist) *in addition to* the
  existing role check — so even a route-guard bug never actually serves the page to the public
  internet. Cheaper to keep in sync (one codebase, one Supabase client setup), same practical
  isolation for the scenario you're actually worried about.

Both are legitimate. If the ksiegai pattern has already proven itself operationally for you (you
know how to run two deploys, and prefer the mental clarity of "customer app" vs "internal tool"
being physically separate things), that's a fine reason on its own even without the security
delta being large — just going in with accurate expectations about what it does and doesn't buy.

## Ideas for credibility (brainstorm, not a plan)

Framed against the OLX comparison, since that's the real competitive contrast (OLX: zero
verification, anyone posts anything, buyer bears all risk):

- **A public, permanent "how verification works" page** — not a marketing claim ("we're the most
  trusted"), but a literal, checkable explanation of what each badge state means and what evidence
  backs it. Paradoxically this is *more* convincing than a trust badge alone, because it's the kind
  of thing a platform with something to hide wouldn't publish. Ties directly into the "claims never
  uniformly verified" principle — make that principle visible externally, not just internal policy.
- **Lead marketing with the already-built review system**, not the verification badges. Real reviews
  tied to a completed reservation (`organisation_reviews`, verified-buyer-only per `docs/REVIEWS.md`)
  are a stronger trust signal to a buyer than any self-reported credential, and it's already built —
  just needs to be prominent on breeder profiles and in acquisition marketing ("every review is from
  a real buyer who actually completed a purchase — never anonymous, never fake").
- **Make the kennel-club registry pages a credibility engine, not just SEO.** The drafted
  `/organisation/:slug` pages let a buyer independently check "is ZKwP membership #12345 real"
  without trusting Anemalo's word for it — "check the source" beats "trust our badge." This is
  probably the single highest-leverage already-designed-but-unbuilt piece for the "most trusted"
  positioning, since it's externally verifiable in a way a badge alone never is.
- **Show verification as a visible checklist, not a binary.** A breeder's own dashboard showing
  "2 of 4 verifications complete" (identity ✓, WNI ✓, kennel club — pending, per-litter pedigrees —
  n/a this litter) turns compliance into something breeders want to finish, and gives buyers a
  genuinely graduated signal instead of a single checkmark to fake or misinterpret.
- **Long-term, an automated cross-check against a real government/inspectorate lookup** (if one
  exists publicly for WNI) would let the "fails get reviewed manually" model apply here too — same
  shape as the already-planned POK pedigree-registry pull integration (`docs/POK_INTEGRATION.md`),
  just a different upstream source. Not now; flagging the parallel.
- A **buyer-protection/escrow explainer** — the deposit/reservation flow already exists
  operationally; a plain-language page on how a buyer's money is protected during a transaction is
  standard credibility-building for any two-sided marketplace with money changing hands (Airbnb,
  Etsy) and costs nothing new to build, just to explain.

## Open questions for you

1. Where did you actually see the lockout — worth a concrete repro before treating it as a bug to fix.
2. WNI as a 4th `organisation_trust_claims` type (my recommendation) vs. a dedicated table — agree,
   or is there a multi-registration case (multiple premises, multiple WNI numbers per kennel) I'm
   not accounting for?
3. Apply the kennel-club registry migration now (it's already written, just unapplied), or keep it
   parked until WNI is designed too so both ship together?
4. Admin panel: separate app (ksiegai pattern) vs. same app behind a second infra-level gate — your
   call once the tradeoff above is on the table.
