import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalDraftNotice, PendingLegalDrafting } from "@/shared/ui/legal-notice";

export const Route = createFileRoute("/_public/terms")({
  head: () => ({ meta: [{ title: "Terms of Service — Anemalo" }] }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="container-page max-w-3xl py-16">
      <p className="text-xs font-medium uppercase tracking-wider text-accent">Legal</p>
      <h1 className="mt-2 font-display text-4xl font-medium">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: not yet published.</p>

      <div className="mt-6">
        <LegalDraftNotice />
      </div>

      <div className="space-y-8 text-sm leading-relaxed text-foreground">
        <section>
          <h2 className="mb-2 font-display text-xl font-semibold">1. What Anemalo is</h2>
          <p>
            Anemalo is a platform that connects verified dog breeders, approved foundations and
            shelters, private owners, and a licensed animal transport service. It is not a general
            classifieds site, not a pet shop, and not an open marketplace where anyone can list or
            transport an animal without review.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl font-semibold">2. Accounts and verification</h2>
          <p>
            Anyone can create an account and request transport. Publishing commercial puppy listings
            requires an approved breeder application; publishing adoption listings requires an
            approved foundation or shelter organisation. Signing in with Google or Facebook confirms
            your identity with that provider only — it does not verify breeder status, foundation
            status, or animal ownership, and does not grant any listing permissions by itself.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl font-semibold">3. Listings and transactions</h2>
          <p>
            Breeders and foundations are responsible for the accuracy and legality of their own
            listings, including compliance with breeding, sales, and animal welfare law in their
            country. Anemalo reviews organisations before they can publish, but this review is not a
            legal certification of any individual listing, sale, or adoption.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl font-semibold">4. Transport requests</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Submitting a transport request form is never a declaration that the transport is
              legally compliant — it only produces an internal routing label used to direct the
              request to the right review step. Final legal, route, and quotation approval is always
              made by a person, not automatically.
            </li>
            <li>
              Shared, individual, express and VIP transport all meet the same welfare standards. VIP
              means privacy, scheduling flexibility and direct communication — never a different
              minimum standard of animal care.
            </li>
            <li>
              Estimated prices and delivery windows shown before a request is reviewed are
              estimates, not guarantees.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl font-semibold">
            5. Liability, disputes, and governing law
          </h2>
          <PendingLegalDrafting>
            <p>
              This section will cover limitation of liability, warranty disclaimers, dispute
              resolution, and which country's law and courts apply. It has not been written yet and
              must be drafted and reviewed by a qualified lawyer before this platform is used with
              real users or real transactions.
            </p>
          </PendingLegalDrafting>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl font-semibold">
            6. Account termination and prohibited conduct
          </h2>
          <PendingLegalDrafting>
            <p>
              This section will cover grounds for suspension or termination, prohibited use of the
              platform, and enforcement of these terms. Pending legal drafting.
            </p>
          </PendingLegalDrafting>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl font-semibold">7. Contact</h2>
          <PendingLegalDrafting>
            <p>
              Anemalo is operated by Tovernet. The full registered legal form, address, and company
              registration number will be published here once finalised. See also the{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>{" "}
              for how to reach us about your personal data.
            </p>
          </PendingLegalDrafting>
        </section>
      </div>
    </div>
  );
}
