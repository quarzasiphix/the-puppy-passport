import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  ChevronsUpDown,
  Menu,
  Check,
  ArrowRight,
  User,
  Dog,
  HeartHandshake,
  Truck,
  Car,
  ShieldCheck,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import { Logo } from "@/app/components/logo";
import { useAuth } from "@/domains/identity";
import { useTranslation } from "@/shared/i18n";
import { LocaleSuggestionBanner } from "@/shared/i18n/locale-suggestion-banner";
import { LanguageSwitcher } from "@/shared/i18n/language-switcher";

export type DashboardNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Optional section header rendered above this item whenever it differs from the previous
   * item's section (see breederNav in navigation.ts for the first real use). Omit entirely for a
   * flat, ungrouped list — every other dashboard's nav still renders exactly as before. */
  section?: string;
};

// Every role that has a dashboard, in switcher order. Kept in one place so a new workspace only
// needs an entry here (not one in every layout file) to show up in the switcher. `id` keys the
// three translated-phrase maps below (dashboardShell.workspaces/panelLabel/switchTo in the locale
// files) — kept separate from composing a sentence out of parts because Polish word order for
// "Breeder panel" ("Panel hodowcy") isn't just the English order with a translated noun swapped in.
const workspaces: { to: string; id: string; roles: string[]; icon: LucideIcon }[] = [
  { to: "/dashboard/buyer", id: "customer", roles: [], icon: User }, // every signed-in user has this one
  { to: "/dashboard/breeder", id: "breeder", roles: ["breeder"], icon: Dog },
  {
    to: "/dashboard/foundation",
    id: "foundation",
    roles: ["foundation_member", "shelter_member"],
    icon: HeartHandshake,
  },
  {
    to: "/dashboard/transport-company",
    id: "transportCompany",
    roles: ["transport_company_owner"],
    icon: Truck,
  },
  { to: "/dashboard/operations", id: "operations", roles: ["operations", "admin"], icon: Truck },
  { to: "/dashboard/driver", id: "driver", roles: ["driver"], icon: Car },
  // Moderator and admin share one dashboard (routes/dashboard/admin.tsx) — a moderator sees the
  // same "Admin" workspace entry, just fewer items once inside (adminNavFor in navigation.ts).
  { to: "/dashboard/admin", id: "admin", roles: ["moderator", "admin"], icon: ShieldCheck },
];

// Lets a user with several roles switch workspace without a separate account per role — driven by
// their real (server-verified) roles, not a value the frontend could fabricate; the underlying
// pages are still independently guarded by RLS and each layout's own beforeLoad role check.
//
// The overwhelmingly common case is exactly two workspaces (a breeder is also a customer). For
// that case this isn't a menu you open to see your options — it's one direct, always-visible
// statement: "{current} panel · Switch to {other}", and tapping it just goes there. No dropdown,
// no extra step. A dropdown only appears for the rare 3+-workspace user (e.g. an admin who's also
// ops/breeder/buyer), where there's no single "other" to jump straight to.
function WorkspaceSwitcher({ current }: { current: string }) {
  const { roles } = useAuth();
  const { t } = useTranslation();
  const activeRoleNames = new Set(roles.filter((r) => r.status === "active").map((r) => r.role));
  const available = workspaces.filter(
    (w) => w.roles.length === 0 || w.roles.some((r) => activeRoleNames.has(r)),
  );
  const currentWorkspace = workspaces.find((w) => w.to === current);
  const CurrentIcon = currentWorkspace?.icon ?? User;
  const currentLabel = currentWorkspace
    ? t(`dashboardShell.workspaces.${currentWorkspace.id}`)
    : t("dashboardShell.workspaces.customer");

  if (available.length <= 1) {
    return (
      <span className="flex items-center gap-2 text-sm font-bold">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <CurrentIcon className="size-4" />
        </span>
        {currentLabel}
      </span>
    );
  }

  if (available.length === 2) {
    const other = available.find((w) => w.to !== current)!;
    return (
      <Link
        to={other.to}
        className="flex w-full items-center gap-2.5 rounded-xl bg-secondary/70 py-2 pl-2 pr-2.5 outline-none hover:bg-secondary"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <CurrentIcon className="size-4" />
        </span>
        <span className="min-w-0 flex-1 text-left leading-tight">
          <span className="block truncate text-[11px] text-muted-foreground">
            {currentWorkspace
              ? t(`dashboardShell.panelLabel.${currentWorkspace.id}`)
              : currentLabel}
          </span>
          <span className="flex items-center gap-1 truncate text-xs font-bold text-primary">
            {t(`dashboardShell.switchTo.${other.id}`)}
            <ArrowRight className="size-3 shrink-0" />
          </span>
        </span>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-xl bg-secondary/70 py-2 pl-2 pr-2.5 text-sm font-bold outline-none hover:bg-secondary">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <CurrentIcon className="size-4" />
        </span>
        <span className="flex-1 truncate text-left">{currentLabel}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {available.map((w) => {
          const active = w.to === current;
          return (
            <DropdownMenuItem key={w.to} asChild className="gap-2.5 py-2.5">
              <Link to={w.to}>
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-lg ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground/70"
                  }`}
                >
                  <w.icon className="size-4" />
                </span>
                <span className="flex-1 font-semibold">
                  {t(`dashboardShell.workspaces.${w.id}`)}
                </span>
                {active && <Check className="size-4 shrink-0 text-primary" />}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DashboardShell({
  navItems,
  statusLine,
  header,
  children,
  accentColor,
}: {
  navItems: DashboardNavItem[];
  /** Small text under the workspace switcher, e.g. kennel name + verification badge. */
  statusLine?: React.ReactNode;
  /** Optional sticky top bar rendered above the page content (search, notifications, user chip). */
  header?: React.ReactNode;
  children: React.ReactNode;
  /** A kennel's chosen brand color (organisation_site_configurations.primary_color), as a raw hex
   * string — overrides the `--accent`/`--accent-foreground` CSS variables for this whole shell, so
   * every existing accent-toned element (QuickActionTile "accent" tone, badges, etc.) reflects it
   * for free. Only ever passed for a breeder's own dashboard — see dashboard/breeder.tsx. */
  accentColor?: string | null;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = "/" + pathname.split("/").slice(1, 3).join("/");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useTranslation();
  const accentStyle = accentColor
    ? ({ "--accent": accentColor, "--accent-foreground": "#ffffff" } as React.CSSProperties)
    : undefined;

  // Close the mobile nav whenever the route changes (tapping a link navigates but doesn't unmount
  // this shell, so the Sheet would otherwise stay open over the new page).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navLinks = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
      {navItems.map((it, i) => {
        const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
        const showSectionHeader = it.section && it.section !== navItems[i - 1]?.section;
        return (
          <div key={it.to}>
            {showSectionHeader && (
              <div
                className={`px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 ${i === 0 ? "pb-1.5" : "pb-1.5 pt-4"}`}
              >
                {t(it.section!)}
              </div>
            )}
            <Link
              to={it.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent"
              }`}
            >
              <it.icon className="size-4" />
              {t(it.label)}
            </Link>
          </div>
        );
      })}
    </nav>
  );

  const backToSite = (
    <div className="border-t border-sidebar-border p-3">
      <Link
        to="/"
        className="block rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent"
      >
        {t("dashboardShell.backToAnemalo")}
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-secondary/40" style={accentStyle}>
      <LocaleSuggestionBanner />
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar text-sidebar-foreground lg:flex">
          <div className="border-b border-sidebar-border p-5">
            <div className="flex items-center gap-2">
              <Link to="/" className="flex flex-1 items-center gap-2 text-primary">
                <Logo className="size-9" />
                <span className="font-display text-lg font-semibold">Anemalo</span>
              </Link>
              <LanguageSwitcher />
            </div>
            <div className="mt-4 rounded-xl border border-sidebar-border bg-background p-3">
              <WorkspaceSwitcher current={current} />
              {statusLine}
            </div>
          </div>
          {navLinks}
          {backToSite}
        </aside>

        <div className="min-w-0 flex-1">
          {/* Mobile / tablet nav — the desktop sidebar is hidden below lg, so without this there is
              no way to move between dashboard pages on a phone. */}
          <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label={t("dashboardShell.openMenu")}
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-border/70 hover:bg-secondary"
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0 flex-1">
              <WorkspaceSwitcher current={current} />
            </div>
            <LanguageSwitcher />
            <Link to="/" className="flex shrink-0 items-center gap-1.5 text-primary">
              <Logo className="size-8" />
            </Link>
          </div>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent
              side="left"
              className="flex w-72 flex-col bg-sidebar p-0 text-sidebar-foreground"
            >
              <SheetHeader className="border-b border-sidebar-border p-5 text-left">
                <div className="flex items-center gap-2">
                  <SheetTitle className="flex-1 font-display text-lg text-sidebar-foreground">
                    Anemalo
                  </SheetTitle>
                  <LanguageSwitcher />
                </div>
                <div className="mt-2 rounded-xl border border-sidebar-border bg-background p-3">
                  <WorkspaceSwitcher current={current} />
                  {statusLine}
                </div>
              </SheetHeader>
              {navLinks}
              {backToSite}
            </SheetContent>
          </Sheet>

          {header}
          <main className="p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
