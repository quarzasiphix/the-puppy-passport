import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";

type MessageKind = Database["public"]["Tables"]["messages"]["Row"]["message_kind"];

export type ConversationListRow = {
  conversation_id: string;
  conversations: {
    id: string;
    conversation_type: "transport" | "marketplace" | "adoption" | "community" | "support";
    linked_animal_id: string | null;
    linked_transport_request_id: string | null;
    created_at: string;
    animals: { name: string; organisations: { name: string } | null } | null;
    transport_requests: { request_number: string } | null;
    conversation_participants: {
      profile_id: string;
      profiles: { display_name: string | null } | null;
    }[];
  } | null;
};

const conversationListSelect =
  "conversation_id, conversations(id, conversation_type, linked_animal_id, linked_transport_request_id, created_at, animals(name, organisations!animals_organization_id_fkey(name)), transport_requests(request_number), conversation_participants(profile_id, profiles!conversation_participants_profile_id_fkey(display_name)))";

export async function listMyConversations(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("conversation_participants")
    .select(conversationListSelect)
    .eq("profile_id", userId);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ConversationListRow[];
  return rows
    .filter((r) => r.conversations)
    .map((r) => r.conversations!)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_profile_id: string;
  body: string;
  message_kind: string;
  is_internal: boolean;
  attachment_url: string | null;
  created_at: string;
};

export async function listConversationMessages(conversationId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, conversation_id, sender_profile_id, body, message_kind, is_internal, attachment_url, created_at",
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

const MESSAGE_ATTACHMENTS_BUCKET = "message-attachments";

function sanitizeFilenameForStoragePath(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function sendMessage(params: {
  conversationId: string;
  senderId: string;
  body: string;
  messageKind?: MessageKind;
  isInternal?: boolean;
  attachment?: File;
}) {
  const supabase = getSupabaseBrowserClient();

  let attachmentUrl: string | null = null;
  if (params.attachment) {
    const objectPath = `${params.conversationId}/${Date.now()}-${sanitizeFilenameForStoragePath(params.attachment.name)}`;
    const { error: uploadError } = await supabase.storage
      .from(MESSAGE_ATTACHMENTS_BUCKET)
      .upload(objectPath, params.attachment, {
        contentType: params.attachment.type || undefined,
      });
    if (uploadError) throw uploadError;
    attachmentUrl = objectPath;
  }

  const { error } = await supabase.from("messages").insert({
    conversation_id: params.conversationId,
    sender_profile_id: params.senderId,
    body: params.body,
    message_kind: params.messageKind ?? "general",
    is_internal: params.isInternal ?? false,
    attachment_url: attachmentUrl,
  });
  if (error) {
    if (attachmentUrl) {
      await supabase.storage.from(MESSAGE_ATTACHMENTS_BUCKET).remove([attachmentUrl]);
    }
    throw error;
  }
}

// The bucket is private — a stored object path is only ever useful through a short-lived signed
// URL generated on demand, never persisted or shown as a bare link. Same 5-minute window as
// getSignedDocumentUrl() in src/lib/queries/transport.ts.
export async function getSignedAttachmentUrl(objectPath: string): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.storage
    .from(MESSAGE_ATTACHMENTS_BUCKET)
    .createSignedUrl(objectPath, 300);
  if (error) throw error;
  return data.signedUrl;
}

export async function startApplicationConversation(animalId: string, buyerId?: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("start_application_conversation", {
    p_animal_id: animalId,
    p_buyer_id: buyerId,
  });
  if (error) throw error;
  return data as string;
}

export async function startTransportConversation(transportRequestId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("start_transport_conversation", {
    p_transport_request_id: transportRequestId,
  });
  if (error) throw error;
  return data as string;
}
