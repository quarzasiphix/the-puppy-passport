import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { PawPrint, ChevronsUpDown, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import { useAuth } from "@/domains/identity";

export type DashboardNavItem = { to: string; label: string; icon: LucideIcon; exact?: boolean };

// Every role that has a dashboard, in switcher order. Kept in one place so a new workspace only
// needs an entry here (not one in every layout file) to show up in the switcher.
const workspaces: { to: string; label: string; roles: string[] }[] = [
  { to: "/dashboard/buyer", label: "Customer", roles: [] }, // every signed-in user has this one
  { to: "/dashboard/breeder", label: "Breeder", roles: ["breeder"] },
  {
    to: "/dashboard/foundation",
    label: "Foundation",
    roles: ["foundation_member", "shelter_member"],
  },
  { to: "/dashboard/operations", label: "Operations", roles: ["operations", "admin"] },
  { to: "/dashboard/driver", label: "Driver", roles: ["driver"] },
  { to: "/dashboard/admin", label: "Admin", roles: ["admin"] },
];

// Lets a user with several roles switch workspace without a separate account per role — driven by
// their real (server-verified) roles, not a value the frontend could fabricate; the underlying
// pages are still independently guarded by RLS and each layout's own beforeLoad role check.
function WorkspaceSwitcher({ current }: { current: string }) {
  const { roles } = useAuth();
  const activeRoleNames = new Set(roles.filter((r) => r.status === "active").map((r) => r.role));
  const available = workspaces.filter(
    (w) => w.roles.length === 0 || w.roles.some((r) => activeRoleNames.has(r)),
  );
  const currentLabel = workspaces.find((w) => w.to === current)?.label ?? "Dashboard";

  if (available.length <= 1) {
    return <span className="text-sm font-semibold">{currentLabel}</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-semibold outline-none">
        {currentLabel} <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {available.map((w) => (
          <DropdownMenuItem key={w.to} asChild>
            <Link to={w.to}>{w.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DashboardShell({
  navItems,
  statusLine,
  header,
  children,
}: {
  navItems: DashboardNavItem[];
  /** Small text under the workspace switcher, e.g. kennel name + verification badge. */
  statusLine?: React.ReactNode;
  /** Optional sticky top bar rendered above the page content (search, notifications, user chip). */
  header?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = "/" + pathname.split("/").slice(1, 3).join("/");
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile nav whenever the route changes (tapping a link navigates but doesn't unmount
  // this shell, so the Sheet would otherwise stay open over the new page).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navLinks = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
      {navItems.map((it) => {
        const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
        return (
          <Link
            key={it.to}
            to={it.to}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent"
            }`}
          >
            <it.icon className="size-4" />
            {it.label}
          </Link>
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
        ← Back to Anemalo
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-secondary/40">
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar text-sidebar-foreground lg:flex">
          <div className="border-b border-sidebar-border p-5">
            <Link to="/" className="flex items-center gap-2 text-primary">
              <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                <PawPrint className="size-5" />
              </span>
              <span className="font-display text-lg font-semibold">Anemalo</span>
            </Link>
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
              aria-label="Open menu"
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-border/70 hover:bg-secondary"
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0">
              <WorkspaceSwitcher current={current} />
            </div>
            <Link to="/" className="ml-auto flex shrink-0 items-center gap-1.5 text-primary">
              <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <PawPrint className="size-4" />
              </span>
            </Link>
          </div>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent
              side="left"
              className="flex w-72 flex-col bg-sidebar p-0 text-sidebar-foreground"
            >
              <SheetHeader className="border-b border-sidebar-border p-5 text-left">
                <SheetTitle className="font-display text-lg text-sidebar-foreground">
                  Anemalo
                </SheetTitle>
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
