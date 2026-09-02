import { ShieldOff } from "lucide-react";

// Shown on every fundraising page while FUNDRAISING_ENABLED is off — distinct from
// NotImplemented's "not implemented in this phase" copy, since this feature *is* built and tested;
// it's deliberately withheld pending a real payment provider, refund rules and legal review (see
// docs/FUNDRAISING_POLICY.md), not unfinished.
export function FundraisingDisabledNotice() {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
      <ShieldOff className="mx-auto size-8 text-muted-foreground" />
      <p className="mt-3 font-medium">Fundraising isn't available yet</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        This feature is being held back until a real payment provider, refund rules and legal texts
        are approved — it's built and tested, not unfinished.
      </p>
    </div>
  );
}
