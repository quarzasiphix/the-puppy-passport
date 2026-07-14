import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Check, ArrowLeft, ArrowRight } from "lucide-react";

const steps = [
  "Basic information",
  "Home & family",
  "Experience",
  "Plans for the dog",
  "Collection & transport",
  "Message to breeder",
];

export function ApplyDialog({
  open, onOpenChange, puppyName,
}: { open: boolean; onOpenChange: (v: boolean) => void; puppyName: string }) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  function reset() {
    setStep(0);
    setDone(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setTimeout(reset, 200);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {!done ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">
                Apply for {puppyName}
              </DialogTitle>
              <DialogDescription>
                Step {step + 1} of {steps.length}: {steps[step]}
              </DialogDescription>
            </DialogHeader>
            <Progress value={((step + 1) / steps.length) * 100} className="my-1" />

            <div className="py-2">
              {step === 0 && <Step1 />}
              {step === 1 && <Step2 />}
              {step === 2 && <Step3 />}
              {step === 3 && <Step4 />}
              {step === 4 && <Step5 />}
              {step === 5 && <Step6 puppyName={puppyName} />}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4">
              <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
                <ArrowLeft className="mr-1 size-4" /> Back
              </Button>
              {step < steps.length - 1 ? (
                <Button onClick={() => setStep(step + 1)}>
                  Continue <ArrowRight className="ml-1 size-4" />
                </Button>
              ) : (
                <Button onClick={() => setDone(true)}>Send application</Button>
              )}
            </div>
          </>
        ) : (
          <div className="py-6 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-success/15 text-success">
              <Check className="size-7" />
            </div>
            <h3 className="mt-4 font-display text-2xl font-medium">
              Your application has been sent to the breeder
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              The breeder may approve it, request more information, invite you to a call, or add
              you to the waiting list. You'll get updates in your buyer dashboard.
            </p>
            <Button className="mt-6" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Step1() {
  return (
    <div className="space-y-4">
      <Row>
        <F label="Full name"><Input placeholder="Julia Kowalczyk" /></F>
        <F label="Phone"><Input placeholder="+48 555 123 456" /></F>
      </Row>
      <Row>
        <F label="Email"><Input placeholder="you@example.com" type="email" /></F>
        <F label="Country"><Input placeholder="Poland" /></F>
      </Row>
      <F label="City"><Input placeholder="Warsaw" /></F>
    </div>
  );
}
function Step2() {
  return (
    <div className="space-y-4">
      <F label="Home type">
        <RadioGroup defaultValue="house" className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm"><RadioGroupItem value="house" /> House</label>
          <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm"><RadioGroupItem value="apt" /> Apartment</label>
        </RadioGroup>
      </F>
      <label className="flex items-center gap-2 text-sm"><Checkbox defaultChecked /> Garden or secure outdoor space</label>
      <Row>
        <F label="Adults in household"><Input type="number" defaultValue={2} /></F>
        <F label="Children (and ages)"><Input placeholder="e.g. 10, 12" /></F>
      </Row>
      <F label="Other animals at home"><Input placeholder="e.g. one cat, senior labrador" /></F>
      <label className="flex items-center gap-2 text-sm text-muted-foreground"><Checkbox /> Landlord approval required — I confirm I have it</label>
    </div>
  );
}
function Step3() {
  return (
    <div className="space-y-4">
      <F label="Previous dogs"><Textarea placeholder="What breeds, for how long?" rows={3} /></F>
      <F label="Knowledge of the breed"><Textarea placeholder="What do you already know about this breed?" rows={3} /></F>
      <Row>
        <F label="Working schedule"><Input placeholder="e.g. Hybrid, home 3 days/week" /></F>
        <F label="Time the dog may be left alone"><Input placeholder="e.g. Max 4 hours" /></F>
      </Row>
    </div>
  );
}
function Step4() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Select all that apply.</p>
      {["Family companion", "Sport (agility, obedience, herding)", "Exhibition", "Breeding", "Other"].map((p, i) => (
        <label key={p} className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
          <Checkbox defaultChecked={i === 0} /> {p}
        </label>
      ))}
    </div>
  );
}
function Step5() {
  return (
    <div className="space-y-4">
      <F label="Collection preference">
        <RadioGroup defaultValue="pickup">
          {[
            ["pickup", "Collect from breeder"],
            ["dom", "Domestic transport"],
            ["intl", "International transport"],
          ].map(([v, l]) => (
            <label key={v} className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
              <RadioGroupItem value={v} /> {l}
            </label>
          ))}
        </RadioGroup>
      </F>
      <label className="flex items-center gap-2 text-sm"><Checkbox /> I'm flexible on the exact date</label>
      <F label="Preferred collection date"><Input type="date" /></F>
    </div>
  );
}
function Step6({ puppyName }: { puppyName: string }) {
  return (
    <div className="space-y-4">
      <F label={`Message to the breeder about ${puppyName}`}>
        <Textarea rows={6} placeholder="Introduce yourself and tell the breeder what drew you to this puppy…" />
      </F>
      <div className="rounded-xl border border-border/70 bg-secondary/50 p-4 text-sm">
        <div className="mb-2 font-semibold">Summary</div>
        <ul className="space-y-1 text-muted-foreground">
          <li>· Household: House with garden, 2 adults</li>
          <li>· Experience: 10 yrs with a golden retriever</li>
          <li>· Purpose: Family companion</li>
          <li>· Collection: Collect from breeder — flexible date</li>
        </ul>
      </div>
    </div>
  );
}
