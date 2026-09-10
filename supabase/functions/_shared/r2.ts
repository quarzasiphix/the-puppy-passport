// Minimal Cloudflare R2 (S3-compatible) client for edge functions. SigV4 via aws4fetch.
//
// R2 is the store for PUBLIC breeder media only (dog / puppy / gallery / logo / cover photos) —
// see docs/BREEDER_SITE_SDK.md Part A. Private media (transport docs, pedigree scans, message
// attachments) stays on Supabase Storage private buckets and never comes near this.
//
// Required Edge Function secrets (set on the Anemalo project; NOT auto-injected):
//   R2_S3_ENDPOINT          e.g. https://<account_id>.eu.r2.cloudflarestorage.com
//   R2_ACCESS_KEY_ID        R2 API token (Account token, scoped to the anemalo-media bucket)
//   R2_SECRET_ACCESS_KEY
//   R2_BUCKET               anemalo-media
// Optional:
//   MEDIA_PUBLIC_BASE_URL   default https://media.anemalo.com

import { AwsClient } from "npm:aws4fetch@1.0.20";

export interface R2Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

/** Reads + validates the R2 secrets. Returns null when unconfigured (caller returns a clean 503). */
export function getR2Config(): R2Config | null {
  const endpoint = Deno.env.get("R2_S3_ENDPOINT");
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const bucket = Deno.env.get("R2_BUCKET");
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) return null;
  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl: (Deno.env.get("MEDIA_PUBLIC_BASE_URL") ?? "https://media.anemalo.com").replace(
      /\/+$/,
      "",
    ),
  };
}

function client(cfg: R2Config): AwsClient {
  return new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: "s3",
    region: "auto",
  });
}

function objectUrl(cfg: R2Config, key: string): string {
  return `${cfg.endpoint}/${cfg.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** Public URL a browser/site uses to read the object. */
export function publicUrl(cfg: R2Config, key: string): string {
  return `${cfg.publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function r2PutObject(
  cfg: R2Config,
  key: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const res = await client(cfg).fetch(objectUrl(cfg, key), {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      // Objects are content-addressed by a fresh uuid on every upload, so they never change.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`R2 PUT ${key} failed: ${res.status} ${detail.slice(0, 300)}`);
  }
}

export async function r2DeleteObject(cfg: R2Config, key: string): Promise<void> {
  const res = await client(cfg).fetch(objectUrl(cfg, key), { method: "DELETE" });
  // R2/S3 DELETE is idempotent — 204 on success, also treat 404 as "already gone".
  if (!res.ok && res.status !== 404) {
    const detail = await res.text().catch(() => "");
    throw new Error(`R2 DELETE ${key} failed: ${res.status} ${detail.slice(0, 300)}`);
  }
}
