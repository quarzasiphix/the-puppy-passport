import { useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { PawPrint, Menu, Search, LogOut, LayoutDashboard, Languages } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { signOut } from "@/lib/auth/actions";
import { NotificationBell } from "@/components/notification-bell";
import { useTranslation, SUPPORTED_LOCALES, LOCALE_DISPLAY_NAMES } from "@/lib/i18n";

// Primary navigation matches the product's actual priority hierarchy (docs/PRODUCT_VISION.md):
// find an animal, browse breeders, browse foundations, planned litters, adoptions, community are
// all primary destinations, so all six get a top-level slot. Transport keeps one prominent slot —
// a real, major feature — but "Breeder map," "Planned routes" and "How it works" are secondary/
// informational pages that don't need to compete for primary nav space; they stay one click away
// in the footer instead of diluting the six primary destinations with three more.
const nav = [
  { to: "/find-a-dog", labelKey: "nav.findADog" },
  { to: "/breeders", labelKey: "nav.breeders" },
  { to: "/foundations", labelKey: "nav.foundations" },
  { to: "/planned-litters", labelKey: "nav.plannedLitters" },
  { to: "/adoptions", labelKey: "nav.adoptions" },
  { to: "/community", labelKey: "nav.community" },
  { to: "/transport", labelKey: "nav.transport" },
] as const;

function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Language">
          <Languages className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            onClick={() => setLocale(code)}
            className={code === locale ? "font-semibold" : undefined}
          >
            {LOCALE_DISPLAY_NAMES[code]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isSignedIn, firstName, isLoading } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  async function handleSignOut() {
    await signOut();
    await queryClient.invalidateQueries({ queryKey: ["auth-state"] });
    await router.invalidate();
    toast.success("Signed out.");
    await navigate({ to: "/" });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-6">
        <Link to="/" className="flex items-center gap-2 text-primary">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <PawPrint className="size-5" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">Havenpaw</span>
        </Link>

        <nav className="hidden items-center gap-0.5 xl:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "text-foreground bg-secondary" }}
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {!isLoading && isSignedIn ? (
            <>
              <NotificationBell />
              <Button asChild variant="ghost" className="hidden lg:inline-flex">
                <Link to="/dashboard/buyer">
                  <LayoutDashboard className="mr-1 size-4" /> {firstName ?? "Dashboard"}
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hidden lg:inline-flex"
                onClick={handleSignOut}
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
              </Button>
            </>
          ) : (
            <Link
              to="/signin"
              className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground lg:inline-flex"
            >
              {t("nav.signIn")}
            </Link>
          )}
          <LanguageSwitcher />
          <Button asChild className="hidden md:inline-flex">
            <Link to="/find-a-dog">
              <Search className="mr-1 size-4" /> {t("nav.findADog")}
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="xl:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label={t("nav.openMenu")}
          >
            <Menu className="size-5" />
          </Button>
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-full max-w-xs">
          <SheetHeader>
            <SheetTitle className="font-display text-lg">Havenpaw</SheetTitle>
          </SheetHeader>
          <nav className="mt-4 flex flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
                activeProps={{ className: "bg-secondary" }}
              >
                {t(item.labelKey)}
              </Link>
            ))}
            <div className="my-2 border-t border-border/60" />
            {!isLoading && isSignedIn ? (
              <>
                <Link
                  to="/dashboard/buyer"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-secondary"
                >
                  {t("nav.dashboard")}
                </Link>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    handleSignOut();
                  }}
                  className="rounded-md px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-secondary"
                >
                  {t("nav.signOut")}
                </button>
              </>
            ) : (
              <Link
                to="/signin"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-secondary"
              >
                {t("nav.signIn")}
              </Link>
            )}
            <Button asChild className="mt-3">
              <Link to="/find-a-dog" onClick={() => setMobileOpen(false)}>
                <Search className="mr-1 size-4" /> {t("nav.findADog")}
              </Link>
            </Button>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}

export function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="mt-24 border-t border-border/60 bg-secondary/40">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <PawPrint className="size-5" />
            </span>
            <span className="font-display text-lg font-semibold">Havenpaw</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{t("footer.tagline")}</p>
        </div>
        <FooterCol
          title={t("footer.discover")}
          items={[
            [t("footer.linkMarketplace"), "/find-a-dog"],
            [t("footer.linkFindYourDog"), "/find-your-dog"],
            [t("footer.linkVerifiedBreeders"), "/breeders"],
            [t("footer.linkPlannedLitters"), "/planned-litters"],
            [t("footer.linkFoundations"), "/foundations"],
            [t("footer.linkAdoptions"), "/adoptions"],
            [t("footer.linkRehome"), "/rehome"],
          ]}
        />
        <FooterCol
          title={t("footer.transportSection")}
          items={[
            [t("footer.linkRequestTransport"), "/transport/request"],
            [t("footer.linkServiceCategories"), "/transport"],
            [t("footer.linkPlannedRoutes"), "/planned-routes"],
          ]}
        />
        <FooterCol
          title={t("footer.account")}
          items={[
            [t("footer.linkHowItWorks"), "/how-it-works"],
            [t("footer.linkCommunityGroups"), "/community/groups"],
            [t("footer.linkCreateAccount"), "/signup"],
            [t("footer.linkApplyBreeder"), "/create-breeder"],
            [t("footer.linkSignIn"), "/signin"],
          ]}
        />
      </div>
      <div className="border-t border-border/60">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-5 text-xs text-muted-foreground">
          <span>© 2026 Havenpaw. {t("footer.rightsReserved")}</span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link to="/terms" className="hover:text-foreground hover:underline">
              {t("footer.linkTerms")}
            </Link>
            <Link to="/privacy" className="hover:text-foreground hover:underline">
              {t("footer.linkPrivacy")}
            </Link>
            <Link to="/cookies" className="hover:text-foreground hover:underline">
              {t("footer.linkCookies")}
            </Link>
          </span>
          <span>{t("footer.welfareDisclaimer")}</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold text-foreground">{title}</h4>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {items.map(([label, to]) => (
          <li key={to}>
            <Link to={to} className="hover:text-foreground">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
