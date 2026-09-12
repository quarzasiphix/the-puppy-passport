import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/shared/ui/panel";
import { useAuth } from "@/domains/identity";
import { listMyConversations, type ConversationListRow } from "@/domains/messaging";
import { ChatThread } from "@/domains/messaging";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/breeder/messages")({
  validateSearch: (search: Record<string, unknown>): { conversation?: string } => ({
    conversation: typeof search.conversation === "string" ? search.conversation : undefined,
  }),
  component: MessagesPage,
});

function threadLabel(
  c: NonNullable<ConversationListRow["conversations"]>,
  currentUserId: string,
  t: (key: string) => string,
) {
  const other = c.conversation_participants.find((p) => p.profile_id !== currentUserId);
  return {
    title: other?.profiles?.display_name ?? t("breederPanel.messages.buyer"),
    subtitle: c.animals?.name ?? "",
  };
}

function MessagesPage() {
  const { t } = useTranslation();
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
        <h1 className="font-display text-3xl font-medium">{t("breederPanel.messages.title")}</h1>
      </header>
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("breederPanel.messages.loading")}</p>
      ) : !query.data?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <p className="font-medium">{t("breederPanel.messages.emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("breederPanel.messages.emptyBody")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-[320px_1fr]">
          <Card title={t("breederPanel.messages.inbox")}>
            <ul className="-mx-2 divide-y divide-border/60">
              {query.data.map((c, i) => {
                const label = threadLabel(c, userId!, t);
                return (
                  <li
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`cursor-pointer rounded-lg px-2 py-3 hover:bg-secondary/40 ${(activeId ?? query.data[0]?.id) === c.id ? "bg-secondary/40" : ""}`}
                  >
                    <div className="font-medium">{label.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("breederPanel.messages.aboutPrefix")} {label.subtitle}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card
            title={
              active
                ? `${threadLabel(active, userId!, t).title} — ${t("breederPanel.messages.aboutPrefix")} ${threadLabel(active, userId!, t).subtitle}`
                : t("breederPanel.messages.conversation")
            }
          >
            {active ? (
              <ChatThread conversationId={active.id} currentUserId={userId!} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("breederPanel.messages.selectConversation")}
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
