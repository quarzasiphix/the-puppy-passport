import { createFileRoute } from "@tanstack/react-router";
import { LegalDraftNotice } from "@/shared/ui/legal-notice";

export const Route = createFileRoute("/_public/cookies")({
  head: () => ({ meta: [{ title: "Cookie Policy — Anemalo" }] }),
  component: CookiesPage,
});

function CookieRow({ name, purpose, type }: { name: string; purpose: string; type: string }) {
  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="py-3 pr-4 align-top font-mono text-xs">{name}</td>
      <td className="py-3 pr-4 align-top text-muted-foreground">{purpose}</td>
      <td className="py-3 align-top text-muted-foreground">{type}</td>
    </tr>
  );
}

function CookiesPage() {
  return (
    <div className="container-page max-w-3xl py-16">
      <p className="text-xs font-medium uppercase tracking-wider text-accent">Legal</p>
      <h1 className="mt-2 font-display text-4xl font-medium">Cookie Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: not yet published.</p>

      <div className="mt-6">
        <LegalDraftNotice />
      </div>

      <div className="space-y-6 text-sm leading-relaxed text-foreground">
        <p>
          Anemalo currently uses only the cookies required to keep you signed in. We don't run
          analytics, advertising, or third-party tracking scripts on this platform today — if that
          changes, this page and a consent banner will be added before any such cookie is set.
        </p>

        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Cookie</th>
                <th className="p-3">Purpose</th>
                <th className="p-3">Type</th>
              </tr>
            </thead>
            <tbody>
              <CookieRow
                name="sb-*-auth-token"
                purpose="Keeps you signed in between visits and identifies your account to the server."
                type="Strictly necessary — set by our authentication provider (Supabase)"
              />
            </tbody>
          </table>
        </div>

        <p>
          Because this cookie is strictly necessary for signing in — not for analytics or marketing
          — it's set without a separate consent banner, consistent with standard cookie law
          exemptions for essential cookies. You can still block or delete it in your browser
          settings, but you won't be able to stay signed in if you do.
        </p>
      </div>
    </div>
  );
}
