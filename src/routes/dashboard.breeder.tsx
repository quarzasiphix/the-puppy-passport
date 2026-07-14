import { Outlet, Link, createFileRoute, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Baby, Dog, Inbox, CalendarCheck, MessageSquare, Truck,
  FileText, User, Settings, Bell, Search, PawPrint,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/breeder")({
  component: BreederDashboardLayout,
});

const items: { to: any; label: string; icon: any; exact?: boolean }[] = [
  { to: "/dashboard/breeder", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/breeder/litters", label: "Litters", icon: Baby },
  { to: "/dashboard/breeder/puppies", label: "Puppies", icon: Dog },
  { to: "/dashboard/breeder/applications", label: "Applications", icon: Inbox },
  { to: "/dashboard/breeder/reservations", label: "Reservations", icon: CalendarCheck },
  { to: "/dashboard/breeder/messages", label: "Messages", icon: MessageSquare },
  { to: "/dashboard/breeder/transport", label: "Transport", icon: Truck },
  { to: "/dashboard/breeder/documents", label: "Documents", icon: FileText },
  { to: "/dashboard/breeder/profile", label: "Public profile", icon: User },
  { to: "/dashboard/breeder/settings", label: "Settings", icon: Settings },
];

function BreederDashboardLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-secondary/40">
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar text-sidebar-foreground lg:flex">
          <div className="border-b border-sidebar-border p-5">
            <Link to="/" className="flex items-center gap-2 text-primary">
              <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                <PawPrint className="size-5" />
              </span>
              <span className="font-display text-lg font-semibold">Havenpaw</span>
            </Link>
            <div className="mt-4 rounded-xl border border-sidebar-border bg-background p-3">
              <div className="text-xs text-muted-foreground">Kennel</div>
              <div className="text-sm font-semibold">Cichy Las Kennel</div>
              <div className="text-xs text-primary">✓ Verified</div>
            </div>
          </div>
          <nav className="flex-1 space-y-0.5 p-3">
            {items.map((it) => {
              const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${active ? "bg-primary text-primary-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent"}`}
                >
                  <it.icon className="size-4" />
                  {it.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-sidebar-border p-3">
            <Link to="/find-a-dog" className="block rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent">
              ← Back to Havenpaw
            </Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/60 bg-background/85 px-6 py-3 backdrop-blur">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search applications, puppies, buyers…" className="pl-9" />
            </div>
            <Button variant="ghost" size="icon"><Bell className="size-4" /></Button>
            <div className="flex items-center gap-2 rounded-full border border-border bg-secondary/50 py-1 pl-1 pr-3">
              <div className="grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">AK</div>
              <span className="text-sm">Anna K.</span>
            </div>
          </header>
          <main className="p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
