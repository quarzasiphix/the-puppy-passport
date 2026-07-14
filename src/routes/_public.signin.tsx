import { createFileRoute, Link } from "@tanstack/react-router";
import { PawPrint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_public/signin")({
  head: () => ({ meta: [{ title: "Sign in — Havenpaw" }] }),
  component: SignIn,
});

function SignIn() {
  return (
    <div className="container-page grid min-h-[80vh] items-center py-16">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-border/70 bg-card p-8 shadow-sm">
        <div className="flex items-center gap-2 text-primary">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <PawPrint className="size-5" />
          </span>
          <span className="font-display text-xl font-semibold">Havenpaw</span>
        </div>
        <h1 className="mt-6 font-display text-3xl font-medium">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to manage applications, reservations and transport.</p>

        <form className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" placeholder="you@example.com" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Password</Label>
              <a href="#" className="text-xs text-muted-foreground hover:text-foreground">Forgot?</a>
            </div>
            <Input type="password" placeholder="••••••••" />
          </div>
          <Button className="w-full" size="lg">Sign in</Button>
        </form>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline">Continue with Google</Button>
          <Button variant="outline">Continue with Apple</Button>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/create-breeder" className="text-primary hover:underline">
            Create breeder profile
          </Link>
          {" · "}
          <Link to="/find-a-dog" className="text-primary hover:underline">
            Browse as buyer
          </Link>
        </p>
      </div>
    </div>
  );
}
