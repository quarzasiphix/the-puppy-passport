import { Outlet, createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/app/layouts/site-chrome";
import { LocaleSuggestionBanner } from "@/shared/i18n/locale-suggestion-banner";

export const Route = createFileRoute("/_public")({
  component: PublicLayout,
});

function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <LocaleSuggestionBanner />
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
