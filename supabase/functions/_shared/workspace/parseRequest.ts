import type { ParsedRequest } from "./types.ts";

/**
 * Tolerant request parse. Supports both:
 *   - application/json         → `action` from `body.action`
 *   - multipart/form-data      → `action` from the `action` field (default "<domain>.upload"
 *                                is NOT assumed here; callers must send it), `file` from `file`,
 *                                all other fields flattened into `body`.
 * A missing/malformed body yields `{ action: "", body: {}, file: null }` so the router can
 * still return a clean 400.
 */
export async function parseRequest(req: Request): Promise<ParsedRequest> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await req.formData();
      const body: Record<string, unknown> = {};
      let file: File | null = null;
      for (const [key, value] of form.entries()) {
        if (value instanceof File) {
          if (key === "file") file = value;
        } else {
          body[key] = value;
        }
      }
      return { action: String(body.action ?? ""), body, file };
    } catch {
      return { action: "", body: {}, file: null };
    }
  }

  try {
    const parsed = await req.json();
    const body =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    return { action: String(body.action ?? ""), body, file: null };
  } catch {
    return { action: "", body: {}, file: null };
  }
}
