import { createFileRoute } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/buyer/profile")({
  component: BuyerProfile,
});

function BuyerProfile() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Your profile</h1>
        <p className="text-sm text-muted-foreground">Breeders see this when reviewing your applications.</p>
      </header>
      <div className="max-w-2xl space-y-4 rounded-2xl border border-border/70 bg-card p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label>Full name</Label><Input defaultValue="Julia Kowalczyk" /></div>
          <div><Label>Phone</Label><Input defaultValue="+48 555 123 456" /></div>
          <div><Label>Email</Label><Input defaultValue="julia@example.com" /></div>
          <div><Label>City</Label><Input defaultValue="Warsaw" /></div>
        </div>
        <div>
          <Label>About your home</Label>
          <Textarea rows={4} defaultValue="House with a fenced garden, two adults, a senior labrador. Time for daily walks and structured training." />
        </div>
        <Button>Save profile</Button>
      </div>
    </div>
  );
}
