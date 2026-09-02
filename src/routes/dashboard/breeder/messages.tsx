import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/shared/ui/panel";
import { useAuth } from "@/domains/identity";
import { listMyConversations, type ConversationListRow } from "@/domains/messaging";
import { ChatThread } from "@/domains/messaging";

export const Route = createFileRoute("/dashboard/breeder/messages")({
  validateSearch: (search: Record<string, unknown>): { conversation?: string } => ({
    conversation: typeof search.conversation === "string" ? search.conversation : undefined,
  }),
  component: MessagesPage,
});

function threadLabel(c: NonNullable<ConversationListRow["conversations"]>, currentUserId: string) {
  const other = c.conversation_participants.find((p) => p.profile_id !== currentUserId);
  return { title: other?.profiles?.display_name ?? "Buyer", subtitle: c.animals?.name ?? "" };
}

function MessagesPage() {
  const { userId } = useAuth();
  const search = Route.useSearch();
  const [activeId, setActiveId] = useState<string | undefined>(search.conversation);

  const query = useQuery({
    queryKey: ["my-conversations", userId],
    enabled: !!userId,
    queryFn: () => listMyConversations(userId!),
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!activeId && query.data?.length) setActiveId(query.data[0].id);
  }, [query.data, activeId]);

  const active = query.data?.find((c) => c.id === activeId);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Messages</h1>
      </header>
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !query.data?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <p className="font-medium">No conversations yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Message a buyer from the Applications page once someone applies.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card title="Inbox">
            <ul className="-mx-2 divide-y divide-border/60">
              {query.data.map((c, i) => {
                const label = threadLabel(c, userId!);
                return (
                  <li
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`cursor-pointer rounded-lg px-2 py-3 hover:bg-secondary/40 ${(activeId ?? query.data[0]?.id) === c.id ? "bg-secondary/40" : ""}`}
                  >
                    <div className="font-medium">{label.title}</div>
                    <div className="text-xs text-muted-foreground">about {label.subtitle}</div>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card
            title={
              active
                ? `${threadLabel(active, userId!).title} — about ${threadLabel(active, userId!).subtitle}`
                : "Conversation"
            }
          >
            {active ? (
              <ChatThread conversationId={active.id} currentUserId={userId!} />
            ) : (
              <p className="text-sm text-muted-foreground">Select a conversation.</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
