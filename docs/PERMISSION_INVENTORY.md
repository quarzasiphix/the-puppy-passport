# Permission Inventory

Stage CD of the autonomous backend-hardening session (see `docs/AUTONOMOUS_BACKEND_PROGRESS.md`).
A practical, role-first answer to "what can this kind of user actually do" — grounded in the real
RLS policies and RPCs this schema enforces today, not an aspiration. `docs/DATABASE_INVARIANTS.md`
(Stage CB) catalogues what's *always true*; this catalogues *who* can do *what*. A later,
dedicated stage (IR-6, "auth/role/suspension matrix") builds exhaustive automated test coverage
validating every cell of this matrix systematically — this document is the reference, not the test
suite.

Roles are additive (`public.user_roles`, one profile can hold several) — see `docs/DOMAIN_MODEL.md`
for the full model. A role only grants access while `user_roles.status = 'active'`; suspending it
revokes the access below immediately (`docs/DATABASE_INVARIANTS.md`'s "Role/suspension invariants").

## `anon` (not signed in)

- Read published marketplace listings (`animals` where `is_published` and the owning org is
  `approved`+`public`), approved kennels/foundations, active pricing rules, legal document
  versions, published community posts/groups.
- Sign up, sign in, request a password reset.
- Cannot read anyone's exact address, contact details, private data, or anything requiring a
  relationship to the target row.

## `customer` (base role, granted to every signed-up account)

- Submit a transport request for any animal they have a real connection to (ownership, org
  membership, or an application/reservation naming them) — `create_transport_draft()`.
- Read and manage only their own transport requests, drafts, amendments, documents, and status
  history.
- Request an amendment to a submitted (not draft) request on the allow-listed fields only.
- Submit their own draft (`draft → submitted`) or self-cancel — the only two status transitions a
  non-staff, non-driver caller can ever make directly.
- Save/follow animals and breeders, message a conversation they're a real participant in, save a
  legal consent record for themselves, request their own data export or account deletion, file a
  report, open and reply to their own support case.
- Cannot touch any operational field (`compliance_review_result`, `visibility`,
  `assigned_route_id`/`vehicle_id`/`driver_id`), any other user's data, or any staff-only column.

## `buyer` (additive — most customers are also buyers)

- Everything `customer` can do, plus: submit an application for a puppy, withdraw their own
  application, message the kennel about it, complete a reservation once an application is
  approved and the animal transitions through the org's own approval.
- Cannot self-approve an application or set `breeder_response` — that's the org's exclusive,
  RLS-locked decision.

## `animal_owner` (private individual with an animal, not an organisation)

- Manage their own `animals` rows directly (`owner_profile_id = auth.uid()`) — private rehoming
  listings, saved animals, ownership history for their own animals.
- A private-rehoming listing they publish stays hidden (`is_published = false` effectively, gated
  by `rehoming_reviews.admin_status`) until a real admin review approves it — they cannot
  self-approve at insert or update time.

## `breeder` (individual credential; real publishing power lives at the organisation level)

- Once their organisation is `verification_status = 'approved'`: manage that org's animals,
  litters, parent dogs, champions, team invitations (if also an org `owner`/`administrator`).
- Cannot publish anything before the org is approved — `verification_status` is admin-only-write.
- Cannot self-declare a fundraising campaign's outcome (`target_reached`/`partially_funded`) even
  for their own org's campaign — admin-only.

## `foundation_member` / `shelter_member` (adoption/rescue organisations)

- Same organisation-scoped capabilities as `breeder`, applied to adoption/rescue org types:
  publish adoption listings, review adoption applications, manage urgent welfare cases (only for a
  verified foundation/shelter/rescue org — a kennel cannot open a welfare case even with an
  otherwise-valid org).
- Convert an accepted-for-assessment welfare case into a real transport draft.

## `operations` (ops staff — gated by `is_ops_staff()`, which also covers `admin`)

- Manage all transport requests' operational fields and status (via `change_ops_request_status()`,
  atomic, server-stamped actor) — the only role besides the assigned driver that can move a
  request's status at all.
- Create/manage routes, vehicles, drivers, route stops, route assignments
  (`assign_request_to_route()`).
- Review/accept/reject transport documents, prepare and send quotations, review transport
  amendments, acknowledge/review welfare cases, manage support cases (`claim_support_case()`).
- Read `rate_limit_events` and `risk_signals` (both admin-*and*-ops readable — `is_ops_staff()`
  gates both).
- Cannot approve a user verification, execute an account deletion, or review a moderation
  appeal — those stay `admin`-only (see below), a narrower gate than general ops staff.

## `driver` (assigned to a specific job, not a general transport-domain role)

- See and act on a transport request **only** while `assigned_driver_id` names their own `drivers`
  row and that role is active (`is_assigned_driver_for_request()`, Stage BD hardened this to also
  check `has_role(..., 'driver')`, not just row ownership).
- Progress a job's status through the real driver-owned journey only —
  `driver_assigned → pickup_confirmed → animal_collected → in_transport → (rest_or_care_stop) →
  approaching_destination → delivered → handover_confirmed → completed` — enforced as a real state
  machine (Stage CC); cannot skip ahead, move backwards, or touch assignment/compliance/visibility
  fields.
- Report a transport incident on their own active job; cannot edit it afterward (ops-only
  resolution, preserving report integrity).
- Upload pickup/delivery evidence photos to their own job's private Storage folder.
- Loses all of the above immediately if their `driver` role is suspended, even though their
  `drivers` row still exists.

## `moderator`

- Investigate and resolve reports/moderation cases; `claim_moderation_case()` (atomic, one
  moderator at a time) gates who's actively working a case.
- Review moderation appeals — but never the same moderator who made the original decision
  (a same-moderator-conflict check).
- Cannot approve verifications, execute deletions, or manage platform-wide settings — those stay
  `admin`-only.

## `admin` (`is_admin()` — a strict superset of `is_ops_staff()` and every narrower gate)

- Everything every other role can do, plus the handful of things gated specifically to admin and
  nobody else: `approve_user_verification()`, `execute_account_deletion()`,
  `mark_risk_signal_reviewed()` (shared with ops via `is_ops_staff()` — actually staff-wide, see
  above), organisation suspend/restore, market/settings configuration, legal document version
  management, maintenance mode toggle, fundraising campaign approval/activation/outcome-setting,
  transport-request-operational-field correction after submission.
- The only role whose organisation access is guaranteed independent of `owns_org()` — an admin's
  reach into an org never depends on ownership at all.

## Organisation sub-roles (`organisation_members.role`, Stage E)

Additive to whatever platform role the person also holds. `owner`/`administrator` can manage team
membership and invitations; `employee`/`breeder`/`volunteer`/`driver`/`viewer` (plus the
adoption/transport/animal-care coordinator variants) are progressively narrower — see
`can_manage_org_members()` and `20260101007700_organisation_team_management.sql` for the exact
tier boundaries. None of these sub-roles ever grant access to another organisation's data, and
none can change the platform-wide `verification_status` an admin controls.

## What this document deliberately does not attempt

- A full table-by-table × role-by-role matrix (hundreds of cells duplicating the RLS policies
  themselves) — read the migration for a specific table when that level of detail matters.
- Automated, exhaustive test coverage validating every cell — that's IR-6's dedicated scope.
- Coverage of roles/capabilities that don't exist yet (a support-specific platform role, a
  dedicated finance/payments role) — none exist, and inventing an entry for them here would be
  describing something that isn't real.
