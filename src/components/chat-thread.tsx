import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Paperclip, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  getSignedAttachmentUrl,
  listConversationMessages,
  sendMessage,
} from "@/lib/queries/messaging";

export function ChatThread({
  conversationId,
  currentUserId,
}: {
  conversationId: string;
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ["conversation-messages", conversationId],
    queryFn: () => listConversationMessages(conversationId),
    refetchInterval: 5000,
  });

  const mutation = useMutation({
    mutationFn: () =>
      sendMessage({
        conversationId,
        senderId: currentUserId,
        body: draft.trim(),
        attachment: attachment ?? undefined,
      }),
    onSuccess: () => {
      setDraft("");
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["conversation-messages", conversationId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not send."),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [query.data?.length]);

  return (
    <div>
      <div className="mb-4 h-96 space-y-3 overflow-y-auto rounded-xl border border-border/70 bg-secondary/30 p-4 text-sm">
        {query.isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !query.data?.length ? (
          <p className="text-muted-foreground">No messages yet — say hello.</p>
        ) : (
          query.data.map((m) => (
            <Bubble key={m.id} side={m.sender_profile_id === currentUserId ? "you" : "them"}>
              {m.body}
              {m.attachment_url && <AttachmentLink objectPath={m.attachment_url} />}
            </Bubble>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) mutation.mutate();
        }}
      >
        {attachment && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Paperclip className="h-3.5 w-3.5" />
            <span className="truncate">{attachment.name}</span>
            <button
              type="button"
              className="text-destructive"
              onClick={() => {
                setAttachment(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              aria-label="Remove attachment"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            placeholder="Write a message…"
            rows={2}
            className="flex-1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach a file"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button type="submit" disabled={mutation.isPending || !draft.trim()}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}

function AttachmentLink({ objectPath }: { objectPath: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 flex items-center gap-1 text-xs underline"
      >
        <Paperclip className="h-3 w-3" />
        View attachment
      </a>
    );
  }

  return (
    <button
      type="button"
      className="mt-1 flex items-center gap-1 text-xs underline disabled:opacity-60"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          setUrl(await getSignedAttachmentUrl(objectPath));
        } catch {
          toast.error("Could not load attachment.");
        } finally {
          setLoading(false);
        }
      }}
    >
      <Paperclip className="h-3 w-3" />
      {loading ? "Loading…" : "View attachment"}
    </button>
  );
}

function Bubble({ side, children }: { side: "you" | "them"; children: React.ReactNode }) {
  return (
    <div className={`flex ${side === "you" ? "justify-end" : ""}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 ${side === "you" ? "bg-primary text-primary-foreground" : "bg-background border border-border/70"}`}
      >
        {children}
      </div>
    </div>
  );
}
