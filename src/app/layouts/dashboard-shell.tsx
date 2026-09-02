import { Link, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { PawPrint, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
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
          <div className="border-t border-sidebar-border p-3">
            <Link
              to="/"
              className="block rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent"
            >
              ← Back to Anemalo
            </Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {header}
          <main className="p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
