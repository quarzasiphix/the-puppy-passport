# Frontend analytics event contract (specification only — no provider integrated)

A provider-neutral list of privacy-conscious frontend events worth tracking someday, for whoever
eventually wires up an analytics provider (none is integrated on this branch, and none should be
added without an explicit, separate decision — this is a specification, not an implementation).

## Event list

| Event | Trigger | Properties (safe) |
|---|---|---|
| `search_performed` | `/find-a-dog` filter change or `/find-your-dog` step completion | result count, active filter categories (not raw text query) |
| `filter_applied` | any filter control change | filter name, filter value (enum-shaped values only — breed/country/sort, never free text) |
| `listing_viewed` | puppy/adoption detail page loader resolves | listing type (`breeder_puppy`/`adoption`/`private_rehoming`), org type |
| `breeder_profile_viewed` | `/breeders/$slug` loader resolves | breeder id |
| `organisation_profile_viewed` | `/foundations/$slug` loader resolves | org id, org type |
| `save_toggled` | `useIsSaved` mutation success | listing type, new state (saved/unsaved) |
| `follow_toggled` | org or profile follow mutation success | target type (org/profile), new state |
| `application_started` | apply dialog/form opened | listing type |
| `application_submitted` | application insert success | listing type, org type |
| `transport_info_viewed` | `/transport` or a detail page's transport CTA click | entry point (marketplace detail vs. direct nav) |
| `community_group_joined` | join mutation success | group category (not group id, to avoid identifying a specific user's group membership in aggregate analytics) |

## Explicitly excluded from any event's properties

- Private message content.
- Exact address (pickup/destination/any address field).
- Document names or paths.
- Health information.
- Application free-text answers.
- Personal contact data (email, phone) — even the acting user's own.
- Free-text search queries (log the *result count* and *which filter categories* were touched, never
  the literal string a user typed — it could contain a name, address fragment, or anything else they
  didn't intend to have logged).

## Non-goals

- No fake analytics dashboard is created anywhere in the app.
- No provider (PostHog, GA, Amplitude, Mixpanel, etc.) is integrated by this document or this
  session — activating one is a product/legal decision (cookie consent, data processing agreement)
  outside frontend implementation scope.
- No existing internal event abstraction was found in this codebase to extend — this is a from-
  scratch specification for a future session, not a refactor of existing code.
