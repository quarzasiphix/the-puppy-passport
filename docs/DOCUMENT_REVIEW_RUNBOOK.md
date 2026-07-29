# Document review runbook

Real, tested mechanisms across the three document surfaces this app has: transport documents
(`dashboard.operations.documents.tsx`), organisation verification documents
(`dashboard.admin.breeder-verification.tsx`/`foundation-verification.tsx`), and welfare case
documents (`dashboard.operations.welfare-cases.tsx`).

## Common shape across all three

Every document lives in a **private** Storage bucket (never a public URL) — access is always via a
signed URL, generated on demand for an authorised viewer, never a permanently-shareable link. This
was directly re-verified this session (real upload → real signed URL → real 403 for an unrelated
user, `tests/db/transport-domain.test.ts`'s own document test).

## Transport documents

Requester manages their own request's documents (`"requesters manage documents on their own
request"`, `ALL`); ops staff manage all; the assigned driver can only **view** documents for their
own active job (not upload/modify) — matches the principle that a driver's role is to execute a
job, not administer its paperwork.

## Organisation verification documents

Uploaded by the org owner during the verification flow, reviewed by an admin
(`dashboard.admin.breeder-verification.tsx`/`foundation-verification.tsx`). Approval flips
`organisations.verification_status` — a real, admin-gated action (self-approval was never possible
here; confirmed by this session's own broader Bot 1 finding sweep, no self-verification gap found
for organisations, unlike the achievement-verification bug this session _did_ find and fix, HF-5).

## Welfare case documents

Editable by org members only while the case is still in an editable status
(`draft`/`submitted`/`information_required`) — locked once the case moves past that, matching the
same "protect the record once review is underway" principle used elsewhere.

## What reviewers should check, regardless of document type

- Does the document genuinely match what it claims to be (an ID/license/insurance document, not
  an unrelated file)? No automated content verification exists — this is a manual human judgment
  call every time, not a system guarantee.
- Is the uploader actually who they claim (organisation owner, assigned driver)? RLS already
  guarantees the uploader's _identity_ is real (server-derived, not client-claimed) — it does not
  guarantee the _document's own content_ is genuine (e.g. a real vs. forged license). That
  judgment stays entirely human.

## What this runbook does not claim

No OCR, no automated document-authenticity check, no third-party verification-provider
integration — none of these exist. Every review is a real human looking at a real signed-URL file.
