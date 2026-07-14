import { createFileRoute } from "@tanstack/react-router";
import { Card } from "./dashboard.breeder.index";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/dashboard/breeder/messages")({
  component: MessagesPage,
});

const threads = [
  { id: "m1", name: "Julia Kowalczyk", puppy: "Maja", preview: "Thank you! We'd love to schedule a video call…", time: "2h", unread: true },
  { id: "m2", name: "Michał Adamski", puppy: "Rico", preview: "Do you require a home visit before reservation?", time: "5h", unread: false },
  { id: "m3", name: "Ewa Malinowska", puppy: "Bruno", preview: "The deposit is on its way — confirming today.", time: "1d", unread: false },
  { id: "m4", name: "Lars Andersen", puppy: "Rico", preview: "Understood — happy to wait for the next litter.", time: "2d", unread: false },
];

function MessagesPage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Messages</h1>
      </header>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card title="Inbox">
          <ul className="-mx-2 divide-y divide-border/60">
            {threads.map((t, i) => (
              <li key={t.id} className={`cursor-pointer rounded-lg px-2 py-3 hover:bg-secondary/40 ${i === 0 ? "bg-secondary/40" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground">{t.time}</span>
                </div>
                <div className="text-xs text-muted-foreground">about {t.puppy}</div>
                <div className="mt-1 line-clamp-1 text-sm text-muted-foreground">{t.preview}</div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Julia Kowalczyk — about Maja">
          <div className="mb-4 h-96 space-y-3 overflow-y-auto rounded-xl border border-border/70 bg-secondary/30 p-4 text-sm">
            <Bubble side="them">Hi Anna, we just applied for Maja — she looks like a wonderful match for our home.</Bubble>
            <Bubble side="you">Hello Julia! Thank you for the detailed application. I'd love to set up a video call this week.</Bubble>
            <Bubble side="them">Thank you! We'd love to schedule a video call — Thursday evening works for us.</Bubble>
          </div>
          <div className="flex gap-2">
            <Textarea placeholder="Write a reply…" rows={2} className="flex-1" />
            <Button>Send</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
function Bubble({ side, children }: { side: "you" | "them"; children: React.ReactNode }) {
  return (
    <div className={`flex ${side === "you" ? "justify-end" : ""}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${side === "you" ? "bg-primary text-primary-foreground" : "bg-background border border-border/70"}`}>
        {children}
      </div>
    </div>
  );
}
