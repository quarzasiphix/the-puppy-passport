import { createFileRoute } from "@tanstack/react-router";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/buyer/messages")({
  component: BuyerMessages,
});

const threads = [
  { name: "Anna Kowalska", kennel: "Cichy Las Kennel", preview: "Happy to schedule a call this week — Thursday?", time: "3h" },
  { name: "Katarzyna Wiśniewska", kennel: "Srebrna Rzeka", preview: "Great news — your application is approved.", time: "1d" },
  { name: "Tomasz Nowak", kennel: "Wolna Dolina", preview: "You're on the waiting list for the S litter.", time: "2d" },
];

function BuyerMessages() {
  return (
    <div>
      <header className="mb-6"><h1 className="font-display text-3xl font-medium">Messages</h1></header>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-2xl border border-border/70 bg-card">
          <ul className="divide-y divide-border/60">
            {threads.map((t, i) => (
              <li key={t.name} className={`cursor-pointer p-4 hover:bg-secondary/40 ${i === 0 ? "bg-secondary/40" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground">{t.time}</span>
                </div>
                <div className="text-xs text-muted-foreground">{t.kennel}</div>
                <div className="mt-1 line-clamp-1 text-sm text-muted-foreground">{t.preview}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <div className="mb-4 font-display text-lg font-semibold">Anna Kowalska — Cichy Las Kennel</div>
          <div className="mb-4 h-96 space-y-3 overflow-y-auto rounded-xl border border-border/70 bg-secondary/30 p-4 text-sm">
            <Bubble side="them">Hi Julia! Thanks for your application — I have a few questions.</Bubble>
            <Bubble side="you">Of course, happy to answer anything.</Bubble>
            <Bubble side="them">Happy to schedule a call this week — Thursday?</Bubble>
          </div>
          <div className="flex gap-2">
            <Textarea placeholder="Write a reply…" rows={2} className="flex-1" />
            <Button>Send</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
function Bubble({ side, children }: { side: "you" | "them"; children: React.ReactNode }) {
  return (
    <div className={`flex ${side === "you" ? "justify-end" : ""}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${side === "you" ? "bg-primary text-primary-foreground" : "bg-background border border-border/70"}`}>{children}</div>
    </div>
  );
}
