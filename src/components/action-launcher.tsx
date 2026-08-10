import { Link } from "@tanstack/react-router";
import { Truck, Search, Dog, HeartHandshake, Users, Home, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

// The single "what can I do here" launcher, shown on the homepage and the customer dashboard.
// Six actions only — no sub-categories up front. Each card links straight into the correct flow
// (an already-approved breeder/foundation skips the application step); the user never needs to
// understand Anemalo's internal role model to get moving.
export function ActionLauncher({ variant = "homepage" }: { variant?: "homepage" | "dashboard" }) {
  const { roles, isSignedIn } = useAuth();
  const isBreeder = roles.some((r) => r.role === "breeder" && r.status === "active");
  const isFoundation = roles.some(
    (r) => (r.role === "foundation_member" || r.role === "shelter_member") && r.status === "active",
  );

  const actions = [
    {
      to: isBreeder ? "/dashboard/breeder/puppies" : "/create-breeder",
      icon: Dog,
      title: "Publish an animal",
      desc: isBreeder ? "Add a puppy to your kennel." : "Apply as a breeder to publish puppies.",
    },
    {
      to: isFoundation ? "/dashboard/foundation/animals" : "/create-breeder",
      icon: HeartHandshake,
      title: "Publish an adoption listing",
      desc: isFoundation
        ? "Add an animal for adoption."
        : "Apply as a foundation or shelter to publish adoptions.",
    },
    {
      to: "/find-a-dog",
      icon: Search,
      title: "Find a dog",
      desc: "Browse puppies from verified breeders.",
    },
    {
      to: "/breeders",
      icon: Users,
      title: "Find a breeder",
      desc: "Search verified kennels by breed and location.",
    },
    {
      to: "/rehome",
      icon: Home,
      title: "Find a new home for my dog",
      desc: "Submit your dog for review before it's shown to anyone.",
    },
  ] as const;

  return (
    <section className={variant === "homepage" ? "container-page py-16" : "mb-8"}>
      {variant === "homepage" && (
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wider text-accent">Get started</p>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-tight md:text-4xl">
            What do you need today?
          </h2>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <Link
          to="/transport/request"
          className="group flex flex-col justify-between rounded-2xl border border-primary/30 bg-primary p-6 text-primary-foreground transition-transform hover:-translate-y-0.5 md:col-span-3 md:flex-row md:items-center"
        >
          <div className="flex items-center gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-foreground/15">
              <Truck className="size-6" />
            </div>
            <div>
              <div className="font-display text-xl font-semibold">Request transport</div>
              <div className="text-sm text-primary-foreground/80">
                {isSignedIn
                  ? "Tell us where and when — takes a few minutes."
                  : "Sign up and submit a request — takes a few minutes."}
              </div>
            </div>
          </div>
          <ArrowRight className="mt-4 size-5 shrink-0 md:mt-0" />
        </Link>

        {actions.map((a) => (
          <Link
            key={a.title}
            to={a.to}
            className="flex flex-col rounded-2xl border border-border/70 bg-card p-5 transition-colors hover:bg-secondary/40"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <a.icon className="size-5" />
            </div>
            <div className="mt-3 font-display text-lg font-semibold">{a.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{a.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
