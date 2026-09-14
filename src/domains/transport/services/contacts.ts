import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";

// "Saved clients" — a reusable pickup/dropoff contact an operator or transport company can come
// back to instead of retyping the same breeder's phone number on every stop. See
// 20260925000000_transport_contacts.sql's own header for why this is deliberately NOT the
// heavyweight organisations table.

export type ContactRow = Database["public"]["Tables"]["transport_contacts"]["Row"];
export type ContactInsert = Database["public"]["Tables"]["transport_contacts"]["Insert"];
export type ContactUpdate = Database["public"]["Tables"]["transport_contacts"]["Update"];

// organizationId null -> ops's own shared address book only (RLS: "ops staff manage all
// contacts"). A real org id -> that company's own contacts, unioned with the ops-wide shared book
// (RLS: "company members manage their own contacts" + "...view shared contacts") — the two reads
// happen client-side as one call each since PostgREST can't OR two different eq() conditions in a
// single request the way RLS itself does.
export async function listContacts(organizationId: string | null): Promise<ContactRow[]> {
  const supabase = getSupabaseBrowserClient();
  if (!organizationId) {
    const { data, error } = await supabase
      .from("transport_contacts")
      .select("*")
      .is("organization_id", null)
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as ContactRow[];
  }
  const { data, error } = await supabase
    .from("transport_contacts")
    .select("*")
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ContactRow[];
}

export async function createContact(payload: ContactInsert): Promise<ContactRow> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_contacts")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as ContactRow;
}

export async function updateContact(id: string, patch: ContactUpdate): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("transport_contacts").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteContact(id: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("transport_contacts").delete().eq("id", id);
  if (error) throw error;
}
