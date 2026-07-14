import { Link } from "@tanstack/react-router";
import { PawPrint, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/find-a-dog", label: "Find a dog" },
  { to: "/breeders", label: "Breeders" },
  { to: "/planned-litters", label: "Planned litters" },
  { to: "/transport", label: "Transport" },
  { to: "/how-it-works", label: "How it works" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-6">
        <Link to="/" className="flex items-center gap-2 text-primary">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <PawPrint className="size-5" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">Havenpaw</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "text-foreground bg-secondary" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/signin"
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground lg:inline-flex"
          >
            Sign in
          </Link>
          <Button asChild variant="outline" className="hidden lg:inline-flex">
            <Link to="/create-breeder">Create breeder profile</Link>
          </Button>
          <Button asChild className="hidden md:inline-flex">
            <Link to="/find-a-dog">Find your dog</Link>
          </Button>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="size-5" />
          </Button>
        </div>
      </div>
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
            A specialist marketplace for responsibly bred puppies. Verified breeders,
            structured applications, safe transport across Europe.
          </p>
        </div>
        <FooterCol
          title="Discover"
          items={[
            ["Find a dog", "/find-a-dog"],
            ["Verified breeders", "/breeders"],
            ["Planned litters", "/planned-litters"],
            ["Transport", "/transport"],
          ]}
        />
        <FooterCol
          title="For breeders"
          items={[
            ["Create profile", "/create-breeder"],
            ["Breeder dashboard", "/dashboard/breeder"],
            ["How verification works", "/how-it-works"],
          ]}
        />
        <FooterCol
          title="For buyers"
          items={[
            ["How it works", "/how-it-works"],
            ["Buyer dashboard", "/dashboard/buyer"],
            ["Sign in", "/signin"],
          ]}
        />
      </div>
      <div className="border-t border-border/60">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-5 text-xs text-muted-foreground">
          <span>© 2026 Havenpaw. All rights reserved.</span>
          <span>Havenpaw does not guarantee the health or behaviour of any animal.</span>
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
