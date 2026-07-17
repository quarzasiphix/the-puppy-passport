import { createFileRoute } from "@tanstack/react-router";
import { NotImplemented } from "@/components/not-implemented";

export const Route = createFileRoute("/dashboard/breeder/documents")({
  component: () => (
    <NotImplemented
      title="Documents"
      purpose="Shared templates (sales agreements, health records, pedigree registration) and per-puppy paperwork will live here."
    />
  ),
});
