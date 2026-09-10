import { Outlet, createFileRoute } from "@tanstack/react-router";
import {
  MobileBottomNav,
  MobileMenuProvider,
  SiteHeader,
  SiteFooter,
} from "@/app/layouts/site-chrome";
import { LocaleSuggestionBanner } from "@/shared/i18n/locale-suggestion-banner";

export const Route = createFileRoute("/_public")({
  component: PublicLayout,
});

function PublicLayout() {
  return (
    <MobileMenuProvider>
      {/* pb-14 reserves room for MobileBottomNav (fixed, xl:hidden) so it never overlaps the end
          of the page — footer included; xl:pb-0 drops that once the bar itself is hidden. */}
      <div className="flex min-h-screen flex-col pb-14 xl:pb-0">
        <LocaleSuggestionBanner />
        <SiteHeader />
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
      <MobileBottomNav />
    </MobileMenuProvider>
  );
}
