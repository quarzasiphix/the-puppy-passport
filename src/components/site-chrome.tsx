import { useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { PawPrint, Menu, Truck, LogOut, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { signOut } from "@/lib/auth/actions";
import { NotificationBell } from "@/components/notification-bell";

const nav = [
  { to: "/transport", label: "Transport" },
  { to: "/planned-routes", label: "Planned routes" },
  { to: "/find-a-dog", label: "Find a dog" },
  { to: "/breeder-map", label: "Breeder map" },
  { to: "/breeders", label: "Breeders" },
  { to: "/adoptions", label: "Adoptions" },
  { to: "/community", label: "Community" },
  { to: "/how-it-works", label: "How it works" },
] as const;

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isSignedIn, firstName, isLoading } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

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
              {item.label}
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
              Sign in
            </Link>
          )}
          <Button asChild className="hidden md:inline-flex">
            <Link to="/transport/request">
              <Truck className="mr-1 size-4" /> Request transport
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="xl:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
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
              >
                {item.label}
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
                  Dashboard
                </Link>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    handleSignOut();
                  }}
                  className="rounded-md px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-secondary"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                to="/signin"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-secondary"
              >
                Sign in
              </Link>
            )}
            <Button asChild className="mt-3">
              <Link to="/transport/request" onClick={() => setMobileOpen(false)}>
                <Truck className="mr-1 size-4" /> Request transport
              </Link>
            </Button>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}

export function SiteFooter() {
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
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            A professional animal transport and logistics platform for Poland and Europe — combined
            with verified breeders, foundation adoption listings and a trusted community.
          </p>
        </div>
        <FooterCol
          title="Transport"
          items={[
            ["Request transport", "/transport/request"],
            ["Service categories", "/transport"],
            ["Planned routes", "/planned-routes"],
          ]}
        />
        <FooterCol
          title="Discover"
          items={[
            ["Marketplace", "/find-a-dog"],
            ["Find your ideal dog", "/find-your-dog"],
            ["Verified breeders", "/breeders"],
            ["Foundations", "/foundations"],
            ["Adoptions", "/adoptions"],
            ["Rehome your dog", "/rehome"],
          ]}
        />
        <FooterCol
          title="Account"
          items={[
            ["How it works", "/how-it-works"],
            ["Create an account", "/signup"],
            ["Apply as breeder / foundation", "/create-breeder"],
            ["Sign in", "/signin"],
          ]}
        />
      </div>
      <div className="border-t border-border/60">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-5 text-xs text-muted-foreground">
          <span>© 2026 Havenpaw. All rights reserved.</span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link to="/terms" className="hover:text-foreground hover:underline">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-foreground hover:underline">
              Privacy
            </Link>
            <Link to="/cookies" className="hover:text-foreground hover:underline">
              Cookies
            </Link>
          </span>
          <span>
            Havenpaw does not guarantee the health or behaviour of any animal, nor a fixed transport
            delivery time before review.
          </span>
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
