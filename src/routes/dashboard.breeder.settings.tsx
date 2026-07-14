import { createFileRoute } from "@tanstack/react-router";
import { Card } from "./dashboard.breeder.index";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/breeder/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Settings</h1>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Account">
          <div className="space-y-3">
            <div><Label>Email</Label><Input defaultValue="anna@cichylas.pl" /></div>
            <div><Label>Phone</Label><Input defaultValue="+48 555 123 456" /></div>
            <Button>Save changes</Button>
          </div>
        </Card>
        <Card title="Notifications">
          <div className="space-y-3">
            {[
              "New application received",
              "Buyer message",
              "Reservation deposit received",
              "Transport status changed",
              "Weekly summary",
            ].map((n) => (
              <div key={n} className="flex items-center justify-between">
                <span className="text-sm">{n}</span>
                <Switch defaultChecked />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
