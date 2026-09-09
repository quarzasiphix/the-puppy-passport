import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalDraftNotice, PendingLegalDrafting } from "@/shared/ui/legal-notice";
import { useTranslation } from "@/shared/i18n";

// i18n scope: only the page chrome (eyebrow, title, "last updated" line and the section headings)
// is translated. The dense legal body text is deliberately left English-only — an accurate legal
// translation is a separate specialist task, not UI-copy extraction, and a rough translation of
// contractual terms could be materially misleading.

export const Route = createFileRoute("/_public/terms")({
  head: () => ({ meta: [{ title: "Terms of Service — Anemalo" }] }),
  component: TermsPage,
});

function TermsPage() {
  const { t } = useTranslation();
  return (
    <div className="container-page max-w-3xl py-16">
      <p className="text-xs font-medium uppercase tracking-wider text-accent">
        {t("legalPages.eyebrow")}
      </p>
      <h1 className="mt-2 font-display text-4xl font-medium">{t("legalPages.termsTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("legalPages.lastUpdated")}</p>

      <div className="mt-6">
        <LegalDraftNotice />
      </div>

      <div className="space-y-8 text-sm leading-relaxed text-foreground">
        <section>
          <h2 className="mb-2 font-display text-xl font-semibold">{t("legalPages.termsH1")}</h2>
          <p>
            Anemalo is a platform that connects verified dog breeders, approved foundations and
            shelters, private owners, and a licensed animal transport service. It is not a general
            classifieds site, not a pet shop, and not an open marketplace where anyone can list or
            transport an animal without review.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl font-semibold">{t("legalPages.termsH2")}</h2>
          <p>
            Anyone can create an account and request transport. Publishing commercial puppy listings
            requires an approved breeder application; publishing adoption listings requires an
            approved foundation or shelter organisation. Signing in with Google or Facebook confirms
            your identity with that provider only — it does not verify breeder status, foundation
            status, or animal ownership, and does not grant any listing permissions by itself.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl font-semibold">{t("legalPages.termsH3")}</h2>
          <p>
            Breeders and foundations are responsible for the accuracy and legality of their own
            listings, including compliance with breeding, sales, and animal welfare law in their
            country. Anemalo reviews organisations before they can publish, but this review is not a
            legal certification of any individual listing, sale, or adoption.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl font-semibold">{t("legalPages.termsH4")}</h2>
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
          <h2 className="mb-2 font-display text-xl font-semibold">{t("legalPages.termsH5")}</h2>
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
          <h2 className="mb-2 font-display text-xl font-semibold">{t("legalPages.termsH6")}</h2>
          <PendingLegalDrafting>
            <p>
              This section will cover grounds for suspension or termination, prohibited use of the
              platform, and enforcement of these terms. Pending legal drafting.
            </p>
          </PendingLegalDrafting>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl font-semibold">{t("legalPages.termsH7")}</h2>
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
