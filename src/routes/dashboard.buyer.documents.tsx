import { createFileRoute } from "@tanstack/react-router";
import { NotImplemented } from "@/components/not-implemented";

export const Route = createFileRoute("/dashboard/buyer/documents")({
  component: () => (
    <NotImplemented
      title="Documents"
      purpose="A per-reservation checklist (sales agreement, deposit receipt, pedigree copy, health book) will live here once you have a confirmed reservation."
    />
  ),
});
