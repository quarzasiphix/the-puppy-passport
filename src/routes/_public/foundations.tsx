import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_public/foundations")({
  head: () => ({ meta: [{ title: "Foundations and rescues — Anemalo" }] }),
  component: FoundationsPlaceholder,
});

function FoundationsPlaceholder() {
  return (
    <div className="container-page py-24 text-center">
      <ShieldCheck className="mx-auto size-10 text-primary" />
      <h1 className="mt-4 font-display text-3xl font-medium">Foundations and rescues</h1>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground">
        Public foundation profiles are coming to Anemalo as part of a later build phase.
        Organisations can already apply for verification from the sign-up page.
      </p>
    </div>
  );
}
