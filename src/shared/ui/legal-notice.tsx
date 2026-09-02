import { AlertTriangle } from "lucide-react";

// Shown at the top of every legal page (terms/privacy/cookies). This platform doesn't have a
// lawyer-reviewed final text yet — CLAUDE.md's rule against presenting anything as a final legal
// determination applies here just as much as it does to compliance_review_result on transport
// requests. Never remove this without an actual legal review replacing the marked sections below.
export function LegalDraftNotice() {
  return (
    <div className="mb-8 flex gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
      <p>
        <strong>Draft — pending legal review.</strong> This page describes how Anemalo is designed
        to work today. It is not final legal wording, has not been reviewed by a lawyer, and
        sections marked <em>"pending legal drafting"</em> are placeholders, not commitments. Do not
        treat this as binding until it is replaced with a reviewed version.
      </p>
    </div>
  );
}

export function PendingLegalDrafting({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
      <p className="mb-1 font-medium text-foreground">Pending legal drafting</p>
      {children}
    </div>
  );
}
