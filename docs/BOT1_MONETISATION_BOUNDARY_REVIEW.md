# Bot 1 — Monetisation Boundary Review

One row per monetisation requirement (VA-29..VA-36, VA-56). Source snapshot `ac612690`. Method this
pass: clean dependency-manifest sweep (`node -e` over `package.json` dependencies + devDependencies,
72 total, regex against known payment/billing/CRM/analytics/email/SMS provider package-name
signatures) plus schema grep, not assumption.

| Requirement | Status | Evidence |
|---|---|---|
| Package/pricing definitions exist | N/A — confirmed absent | No pricing/package text anywhere in repo |
| Entitlement model server-enforced | N/A — confirmed absent | No `entitlement`/`subscription`/`billing_plan`/`package_tier` schema; only unrelated hit is a transport-draft animal-count cap, not commercial entitlement |
| Payment provider integrated/configured | N/A — confirmed absent | 0/72 `package.json` deps match Stripe/PayPal/Braintree/Adyen/checkout.com signatures |
| Payment state separated from ownership/quotation | N/A — no payment state exists | No payment table found |
| Checkout idempotency design | N/A — confirmed absent | No checkout surface exists |
| Refund/cancellation boundary documented | N/A — confirmed absent | No refund/payment surface to have a boundary around |
| Invoice/accounting boundary documented | N/A — confirmed absent | Same basis |
| Fraud/abuse controls (billing-specific) | N/A — confirmed absent | No billing surface; general abuse controls (`docs/RATE_LIMITING_AND_ABUSE_PROTECTION.md`) exist for non-billing flows, carried forward unverified this pass |
| Fundraising monetisation boundary | Adequate, non-monetary | `docs/FUNDRAISING_POLICY.md` explicit: campaign *publication* is built and gated (§5.1 fixed finding), no payment code exists |
| No fabricated revenue/conversion claim | **Confirmed clean** | Grep across `src`/`docs` finds no revenue/conversion figures presented as real |

**Gate verdict**: Monetisation gate is **not evaluable as ready/not-ready** — there is no
monetisation surface to gate. Correctly unstarted, not a regression or a hidden gap. The load-bearing
caution for whenever this surface is built: it will inherit the same RLS/actor-trust-boundary risk
class already demonstrated live in the 5 open High findings (broad `ALL` policies without
column-level restriction) — that pattern should be fixed generally, not table-by-table, before any
entitlement/billing schema is added on top of it.
