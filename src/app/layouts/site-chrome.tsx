import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Menu,
  Search,
  ChevronDown,
  Home,
  Dog,
  HeartHandshake,
  Truck,
  Users,
  MapPin,
  Route,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { Logo } from "@/app/components/logo";
import { UserMenu } from "@/app/components/user-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { useAuth } from "@/domains/identity";
import { NotificationBell } from "@/domains/messaging";
import { useTranslation } from "@/shared/i18n";
import { LanguageSwitcher } from "@/shared/i18n/language-switcher";

// Animal discovery leads the navigation — Anemalo is a dedicated animal ecosystem, not a
// transport company with a marketplace attached (see docs/PRODUCT_VISION.md). Transport stays a
// prominent, real feature, just not the first thing a visitor sees.
//
// Redesign 2026-09-09: the old flat 8-item nav gave "Breeder map", "Planned routes" and "How it
// works" the same visual weight as the five primary destinations, which is exactly what the
// breeder-identity redesign brief flagged ("too many similarly weighted items"). Those three move
// into the "More" dropdown below — still one click away, just not fighting the primary five for
// navbar space.
// Icons are only rendered on the mobile drawer (desktop's <nav> stays text-only) — carried here
// too so there's one list to keep in sync, not two.
const nav = [
  { to: "/find-a-dog", labelKey: "nav.findADog", icon: Search },
  { to: "/breeders", labelKey: "nav.breeders", icon: Dog },
  { to: "/adoptions", labelKey: "nav.adoptions", icon: HeartHandshake },
  { to: "/transport", labelKey: "nav.transport", icon: Truck },
  { to: "/community", labelKey: "nav.community", icon: Users },
] as const;

const moreNav = [
  { to: "/breeder-map", labelKey: "nav.breederMap", icon: MapPin },
  { to: "/planned-routes", labelKey: "nav.plannedRoutes", icon: Route },
  { to: "/how-it-works", labelKey: "nav.howItWorks", icon: HelpCircle },
] as const;

// The four primary destinations for the mobile bottom bar, in the same discovery-first order as
// docs/PRODUCT_VISION.md's priority hierarchy. Deliberately a subset of `nav` above (Breeders and
// Community stay reachable via the "Menu" tab below) — a bottom bar with more than ~5 columns
// stops being legible at the 400px-wide floor this app supports.
const bottomNav = [
  { to: "/", labelKey: "nav.home", icon: Home, exact: true },
  { to: "/find-a-dog", labelKey: "nav.findADog", icon: Search, exact: false },
  { to: "/adoptions", labelKey: "nav.adoptions", icon: HeartHandshake, exact: false },
  { to: "/transport", labelKey: "nav.transport", icon: Truck, exact: false },
] as const;

// Shared between SiteHeader's hamburger trigger and MobileBottomNav's "Menu" tab so both open the
// exact same nav Sheet (defined once, inside SiteHeader) instead of duplicating its contents.
const MobileMenuContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(
  null,
);

export function MobileMenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <MobileMenuContext.Provider value={{ open, setOpen }}>{children}</MobileMenuContext.Provider>
  );
}

function useMobileMenu() {
  const ctx = useContext(MobileMenuContext);
  if (!ctx) throw new Error("useMobileMenu() must be used within a MobileMenuProvider");
  return ctx;
}

export function SiteHeader() {
  const { open: mobileOpen, setOpen: setMobileOpen } = useMobileMenu();
  const { isSignedIn, isLoading } = useAuth();
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-6">
        <Link to="/" className="flex items-center gap-2 text-primary">
          <Logo className="size-9" />
          <span className="font-display text-xl font-semibold tracking-tight">Anemalo</span>
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-0.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                {t("nav.more")} <ChevronDown className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {moreNav.map((item) => (
                <DropdownMenuItem key={item.to} asChild>
                  <Link to={item.to}>{t(item.labelKey)}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {!isLoading && isSignedIn ? (
            <>
              <NotificationBell />
              <div className="hidden lg:block">
                <UserMenu showDashboardLink />
              </div>
            </>
          ) : (
            <>
              <Link
                to="/signin"
                className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground lg:inline-flex"
              >
                {t("nav.signIn")}
              </Link>
              <Button asChild variant="outline" size="sm" className="hidden lg:inline-flex">
                <Link to="/signup">{t("signIn.createAccount")}</Link>
              </Button>
            </>
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

      {/* Full-height flex column (header / scrollable nav / pinned account footer) so the drawer's
          content is anchored top-and-bottom instead of a short list floating in an otherwise-empty
          h-full sheet — a stack of plain links here previously left most of the drawer blank. */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="flex h-full w-full max-w-xs flex-col gap-0 p-0">
          <div className="flex items-center gap-2 border-b border-border/60 px-5 py-4">
            <Logo className="size-8" />
            <SheetTitle className="font-display text-lg font-semibold">Anemalo</SheetTitle>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <div className="flex flex-col gap-0.5">
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                  activeProps={{ className: "bg-secondary text-primary" }}
                >
                  <item.icon className="size-4 text-muted-foreground" />
                  {t(item.labelKey)}
                </Link>
              ))}
            </div>

            <p className="mb-1 mt-5 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("nav.more")}
            </p>
            <div className="flex flex-col gap-0.5">
              {moreNav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  activeProps={{ className: "bg-secondary text-primary" }}
                >
                  <item.icon className="size-4" />
                  {t(item.labelKey)}
                </Link>
              ))}
            </div>
          </nav>

          <div className="border-t border-border/60 px-5 py-4">
            {!isLoading && isSignedIn ? (
              <UserMenu showDashboardLink />
            ) : (
              <div className="flex flex-col gap-2">
                <Button asChild>
                  <Link to="/signup" onClick={() => setMobileOpen(false)}>
                    {t("signIn.createAccount")}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/find-a-dog" onClick={() => setMobileOpen(false)}>
                    <Search className="mr-1 size-4" /> {t("nav.findADog")}
                  </Link>
                </Button>
                <Link
                  to="/signin"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md px-3 py-2 text-center text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  {t("nav.signIn")}
                </Link>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}

// Fixed bottom tab bar for small screens — the same breakpoint (`xl:hidden`) SiteHeader uses to
// swap its own primary nav for the hamburger trigger, so exactly one nav pattern is visible at any
// width. Sits above `env(safe-area-inset-bottom)` so it clears the home indicator on notched
// phones instead of being covered by it. `_public.tsx` adds matching bottom padding to the page
// so this bar never overlaps the last bit of page (or footer) content.
export function MobileBottomNav() {
  const { t } = useTranslation();
  const { setOpen } = useMobileMenu();

  return (
    <nav
      aria-label={t("nav.menuLabel")}
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border/60 bg-background/95 backdrop-blur-md xl:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {bottomNav.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={item.exact ? { exact: true } : undefined}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground transition-colors"
          activeProps={{ className: "text-primary" }}
        >
          <item.icon className="size-5" />
          {t(item.labelKey)}
        </Link>
      ))}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("nav.openMenu")}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground transition-colors"
      >
        <Menu className="size-5" />
        {t("nav.menuLabel")}
      </button>
    </nav>
  );
}

// Tovernet embeds this same "built by" strip on every client kennel site (see
// docs/GRYFIN_IMPORT.md and tovernet-nest's public/embed/footer-strip.js) — Anemalo carries it
// too, since Tovernet designs, builds, and runs Anemalo itself. The embed is locale-aware: it
// reads data-lang once on mount, then TovernetStrip.setLang() below keeps it in sync with the
// app's own language switch without a full remount or page reload.
declare global {
  interface Window {
    TovernetStrip?: { setLang?: (lang: string) => void };
  }
}

function TovernetFooterStrip() {
  const { locale } = useTranslation();
  const mountRef = useRef<HTMLDivElement>(null);

  // Mount the embed script once — re-running this on every locale change would re-fetch and
  // re-append a second <script>/strip. Language changes after the initial mount go through the
  // script's own setLang() API instead (see the effect below).
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || mount.querySelector("script")) return;

    const script = document.createElement("script");
    script.src = "https://tovernet.online/embed/footer-strip.js";
    script.async = true;
    script.dataset.client = "anemalo";
    script.dataset.lang = locale;
    mount.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.TovernetStrip?.setLang?.(locale);
  }, [locale]);

  return <div ref={mountRef} />;
}

export function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="mt-24 border-t border-border/60 bg-secondary/40">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Logo className="size-9" />
            <span className="font-display text-lg font-semibold">Anemalo</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{t("footer.tagline")}</p>
        </div>
        <FooterCol
          title={t("footer.discover")}
          items={[
            [t("footer.linkMarketplace"), "/find-a-dog"],
            [t("footer.linkFindYourDog"), "/find-your-dog"],
            [t("footer.linkVerifiedBreeders"), "/breeders"],
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
            [t("footer.linkCreateAccount"), "/signup"],
            [t("footer.linkApplyBreeder"), "/create-breeder"],
            [t("footer.linkSignIn"), "/signin"],
          ]}
        />
      </div>
      <div className="border-t border-border/60">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-5 text-xs text-muted-foreground">
          <span>© 2026 Anemalo. {t("footer.rightsReserved")}</span>
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

      {/* Tovernet strip (embedded from tovernet.online, edit centrally there) */}
      <TovernetFooterStrip />
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
