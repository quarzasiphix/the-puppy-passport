import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { applications } from "@/lib/mock-data";
import { StatusPill } from "./dashboard.breeder.index";
import { CheckCircle2, XCircle, Info, Phone, ListPlus } from "lucide-react";

export const Route = createFileRoute("/dashboard/breeder/applications")({
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const active = applications.find((a) => a.id === openId);
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Applications</h1>
        <p className="text-sm text-muted-foreground">Review buyer applications for your puppies.</p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-4">Buyer</th>
              <th className="p-4">Puppy</th>
              <th className="p-4">Location</th>
              <th className="p-4">Purpose</th>
              <th className="p-4">Transport</th>
              <th className="p-4">Date</th>
              <th className="p-4">Status</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {applications.map((a) => (
              <tr key={a.id} className="hover:bg-secondary/40">
                <td className="p-4">
                  <div className="font-medium">{a.buyer}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">{a.household}</div>
                </td>
                <td className="p-4">{a.puppy}</td>
                <td className="p-4 text-muted-foreground">{a.city}, {a.country}</td>
                <td className="p-4">{a.purpose}</td>
                <td className="p-4">{a.transport}</td>
                <td className="p-4 text-muted-foreground">{new Date(a.date).toLocaleDateString("en-GB")}</td>
                <td className="p-4"><StatusPill status={a.status} /></td>
                <td className="p-4 text-right">
                  <Button size="sm" variant="outline" onClick={() => setOpenId(a.id)}>Open</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!active} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display text-2xl">{active.buyer}</SheetTitle>
                <p className="text-sm text-muted-foreground">Application for {active.puppy} · {new Date(active.date).toLocaleDateString("en-GB")}</p>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                <Field label="Household">{active.household}</Field>
                <Field label="Dog experience">{active.experience}</Field>
                <Field label="Intended purpose">{active.purpose}</Field>
                <Field label="Transport">{active.transport}</Field>
                <Field label="Location">{active.city}, {active.country}</Field>
                <Field label="Message">
                  We fell in love with your kennel photos and would love to give a puppy a stable
                  home with plenty of outdoor time and regular training.
                </Field>
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Reply</div>
                  <Textarea rows={4} placeholder="Send a message to the buyer…" />
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-2">
                <Button><CheckCircle2 className="mr-1 size-4" /> Approve</Button>
                <Button variant="outline"><XCircle className="mr-1 size-4" /> Reject</Button>
                <Button variant="outline"><Info className="mr-1 size-4" /> Request info</Button>
                <Button variant="outline"><Phone className="mr-1 size-4" /> Invite to call</Button>
                <Button variant="outline" className="col-span-2"><ListPlus className="mr-1 size-4" /> Add to waiting list</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}
