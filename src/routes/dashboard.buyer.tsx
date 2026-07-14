import { Outlet, Link, createFileRoute, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Heart, Inbox, MessageSquare, CalendarCheck, Truck, FileText, User, PawPrint, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/buyer")({
  component: BuyerDashboardLayout,
});

const items: { to: any; label: string; icon: any; exact?: boolean }[] = [
  { to: "/dashboard/buyer", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/buyer/saved", label: "Saved puppies", icon: Heart },
  { to: "/dashboard/buyer/applications", label: "Applications", icon: Inbox },
  { to: "/dashboard/buyer/messages", label: "Messages", icon: MessageSquare },
  { to: "/dashboard/buyer/reservations", label: "Reservations", icon: CalendarCheck },
  { to: "/dashboard/buyer/transport", label: "Transport", icon: Truck },
  { to: "/dashboard/buyer/documents", label: "Documents", icon: FileText },
  { to: "/dashboard/buyer/followed", label: "Followed breeders", icon: PawPrint },
  { to: "/dashboard/buyer/profile", label: "Profile", icon: User },
];

function BuyerDashboardLayout() {
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
              <div className="text-xs text-muted-foreground">Signed in</div>
              <div className="text-sm font-semibold">Julia Kowalczyk</div>
              <div className="text-xs text-muted-foreground">Buyer</div>
            </div>
          </div>
          <nav className="flex-1 space-y-0.5 p-3">
            {items.map((it) => {
              const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
              return (
                <Link key={it.to} to={it.to} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${active ? "bg-primary text-primary-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent"}`}>
                  <it.icon className="size-4" />
                  {it.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/60 bg-background/85 px-6 py-3 backdrop-blur">
            <Button asChild variant="outline" size="sm"><Link to="/find-a-dog">Continue searching</Link></Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon"><Bell className="size-4" /></Button>
              <div className="flex items-center gap-2 rounded-full border border-border bg-secondary/50 py-1 pl-1 pr-3">
                <div className="grid size-7 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">JK</div>
                <span className="text-sm">Julia K.</span>
              </div>
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
