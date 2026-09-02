import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalDraftNotice, PendingLegalDrafting } from "@/shared/ui/legal-notice";

export const Route = createFileRoute("/_public/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy — Anemalo" }] }),
  component: PrivacyPage,
});

function DataRow({ category, examples, why }: { category: string; examples: string; why: string }) {
  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="py-3 pr-4 align-top font-medium">{category}</td>
      <td className="py-3 pr-4 align-top text-muted-foreground">{examples}</td>
      <td className="py-3 align-top text-muted-foreground">{why}</td>
    </tr>
  );
}

function PrivacyPage() {
  return (
    <div className="container-page max-w-3xl py-16">
      <p className="text-xs font-medium uppercase tracking-wider text-accent">Legal</p>
      <h1 className="mt-2 font-display text-4xl font-medium">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: not yet published.</p>

      <div className="mt-6">
        <LegalDraftNotice />
      </div>

      <div className="space-y-8 text-sm leading-relaxed text-foreground">
        <section>
          <h2 className="mb-2 font-display text-xl font-semibold">1. Data controller</h2>
          <PendingLegalDrafting>
            <p>
              Anemalo is operated by Tovernet. The full registered legal form, address, and a
              contact for data protection questions will be published here once finalised.
            </p>
          </PendingLegalDrafting>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl font-semibold">2. What we collect and why</h2>
          <p className="mb-3">
            This reflects what the platform actually stores today, not a general statement:
          </p>
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3">Category</th>
                  <th className="p-3">Examples</th>
                  <th className="p-3">Why we process it</th>
                </tr>
              </thead>
              <tbody className="px-3">
                <DataRow
                  category="Account details"
                  examples="Name, email, phone, city/country, preferred language and currency"
                  why="To create and run your account, and to show you a relevant experience."
                />
                <DataRow
                  category="Exact addresses"
                  examples="Pickup/delivery street address for a transport request"
                  why="Only for coordinating the specific transport — never shown publicly, never shared with other customers. Public maps only ever show an approximate area."
                />
                <DataRow
                  category="Animal and transport details"
                  examples="Species/breed info, health notes you provide, passport and vaccination documents you upload"
                  why="To review and carry out the transport, including any legally required document checks."
                />
                <DataRow
                  category="Breeder/foundation verification"
                  examples="Association membership, registration numbers, evidence you submit for review"
                  why="To verify an organisation before it can publish listings."
                />
                <DataRow
                  category="Activity and status history"
                  examples="A record of status changes on your requests, and administrative actions taken on your account"
                  why="Accountability and traceability for important changes — e.g. who reviewed or changed a transport request's status."
                />
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl font-semibold">3. Who can see your data</h2>
          <p>
            Access is restricted by both application logic and database-level security rules, not
            just by hiding buttons in the interface. As a rule: your exact address and uploaded
            documents are visible only to you and to the operations staff handling your specific
            request (and, once a driver is assigned to carry out that specific job, to that driver)
            — never to other customers, and never published publicly. Basic account details (like
            your display name) may be visible to another user only where there is a real reason for
            it — for example, a breeder can see the buyer's name on a reservation they are both
            party to.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl font-semibold">4. Cookies</h2>
          <p>
            See the{" "}
            <Link to="/cookies" className="text-primary hover:underline">
              Cookie Policy
            </Link>{" "}
            — in short, we currently only use the cookie our sign-in system needs to keep you logged
            in. We don't run analytics or advertising trackers.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl font-semibold">5. Legal basis for processing</h2>
          <PendingLegalDrafting>
            <p>
              Which legal basis under applicable data protection law (e.g. performance of a
              contract, legitimate interest, consent) applies to each category above needs
              confirmation by a lawyer before this is published as final.
            </p>
          </PendingLegalDrafting>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl font-semibold">6. How long we keep your data</h2>
          <PendingLegalDrafting>
            <p>Retention periods per data category are not yet defined.</p>
          </PendingLegalDrafting>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl font-semibold">7. Your rights</h2>
          <p className="mb-2">
            Depending on where you live, you generally have the right to access, correct, delete,
            restrict, or export a copy of your personal data, to object to certain processing, and
            to withdraw consent where processing is based on consent. You also have the right to
            complain to your local data protection authority.
          </p>
          <PendingLegalDrafting>
            <p>
              Self-service tools for exporting or deleting your account are not built yet. Until
              they are, contact us using the details in section 1 to exercise these rights.
            </p>
          </PendingLegalDrafting>
        </section>
      </div>
    </div>
  );
}
