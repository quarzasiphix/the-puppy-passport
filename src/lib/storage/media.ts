// Thin storage abstraction over file uploads. Today every bucket is Supabase Storage — see
// docs/STORAGE_AND_MEDIA.md for the plan to move some/all buckets to Cloudflare R2 later
// (mirroring the Gryfin York panel's Edge-Function-proxy pattern: an `upload-media` function
// fronting an R2 binding, never a browser-side R2 credential). The point of this module is that
// swapping a bucket's backend later is a change HERE, not in every domain service that uploads a
// file — every call site should go through these functions instead of calling `supabase.storage`
// directly, so consolidate new upload code here rather than adding another ad hoc call site.

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function sanitizeFilenameForStoragePath(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// --- Private buckets (transport-documents, transport-evidence, message-attachments,
// welfare-case-documents, pickup-delivery-evidence, ...) — no public-read policy, only reachable
// through a short-lived signed URL. ------------------------------------------------------------

export async function uploadPrivateFile(
  bucket: string,
  objectPath: string,
  file: File,
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(objectPath, file, { contentType: file.type || undefined });
  if (error) throw error;
}

/** Best-effort cleanup — callers use this to roll back an upload when the DB write that's
 * supposed to follow it fails. Storage and Postgres are separate systems here, not one
 * transaction, so this can't be perfectly atomic — same posture as every call site it replaces. */
export async function removeFile(bucket: string, objectPath: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  await supabase.storage.from(bucket).remove([objectPath]);
}

/** A private bucket's stored object path is only ever useful through a short-lived signed URL,
 * generated on demand right before the user views/downloads it — never persisted or shown as a
 * bare link. 5 minutes is enough for a click-through view without a long-lived credential sitting
 * in browser history/devtools. */
export async function getSignedFileUrl(
  bucket: string,
  objectPath: string,
  expiresInSeconds = 300,
): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

// --- Public buckets (kennel-media, post-media, ...) — no real upload call site exists yet as of
// 2026-09-09 (animal/post images are still seeded as plain URLs, not real uploads — see the note
// in src/domains/transport/services/transport.ts's TRANSPORT_DOCUMENTS_BUCKET comment for the
// same gap on the private side, fixed there already). Any future gallery/photo-upload feature
// should go through these two rather than inventing another ad hoc `supabase.storage` call site.

export async function uploadPublicFile(
  bucket: string,
  objectPath: string,
  file: File,
): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(objectPath, file, { contentType: file.type || undefined });
  if (error) throw error;
  return getPublicFileUrl(bucket, objectPath);
}

export function getPublicFileUrl(bucket: string, objectPath: string): string {
  const supabase = getSupabaseBrowserClient();
  return supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
}
