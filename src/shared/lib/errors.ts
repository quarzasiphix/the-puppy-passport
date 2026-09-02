// Stage BQ (supplemental queue): error taxonomy. Every backend RPC/trigger this session has
// written raises with the same generic Postgres errcode ('P0001', confirmed by grepping all 95
// `raise exception` sites in supabase/migrations) but a deliberately plain-language message — the
// established convention documented at nearly every rate-limit/business-rule raise site. Real
// constraint violations (a unique-index hit, a foreign-key violation) are a different story: those
// come straight from Postgres with a technical message ("duplicate key value violates unique
// constraint \"animals_microchip_number_unique\"") never meant for an end user, and grepping the
// frontend found several call sites doing `toast.error(error.message)` with no translation at all
// — passing that raw text straight through to whoever's looking at the screen.
//
// This is a real, reachable gap CLAUDE.md's own UX principle already names directly ("Customer-
// facing copy is written for an ordinary person, not a logistics employee, lawyer or developer"),
// not a hypothetical one — Stage BO's own new `animals_microchip_number_unique` constraint is a
// concrete example of a raw Postgres message that would otherwise leak to a breeder filling out a
// listing form.
//
// Rewriting all 95 raise sites to use distinct custom SQLSTATEs would be a large, high-risk,
// low-value migration churn for what this needs — the message text at those sites is already
// customer-safe by convention. What's missing is a single place that decides, from the *stable*
// parts of a Postgres/PostgREST error (its `code`), whether a message is safe to show as-is or
// needs to be replaced with a generic, friendly fallback. Ops/admin dashboards are explicitly
// exempt (CLAUDE.md: "Internal dashboards can and should stay precise and technical") — this
// helper is for customer-facing surfaces only, and callers choose when to use it.

interface PostgrestLikeError {
  code?: string | null;
  message?: string | null;
}

function isPostgrestLikeError(error: unknown): error is PostgrestLikeError {
  return typeof error === "object" && error !== null && "message" in error;
}

// Postgres SQLSTATE prefixes/codes whose message text is always internal/technical, never
// customer-safe -- constraint names, column names, internal identifiers. Anything in this set gets
// replaced by a generic, action-appropriate fallback instead of leaking the raw message.
const TECHNICAL_ERROR_CODES: Record<string, string> = {
  "23505": "Something with this information already exists. Please check and try again.",
  "23503": "That doesn't match something we expected — please refresh the page and try again.",
  "23514": "That doesn't look right — please check the information and try again.",
  "42501": "You don't have permission to do that.",
  PGRST301: "You don't have permission to do that.",
  PGRST116: "We couldn't find that — it may have been moved or removed.",
};

const DEFAULT_FALLBACK =
  "Something went wrong. Please try again, or contact support if this keeps happening.";

/**
 * Turns a raw Supabase/PostgREST error into a message safe to show a customer.
 *
 * `P0001` (every hand-written `raise exception` in this codebase's RPCs/triggers) is passed
 * through as-is -- by established convention every one of those messages is already written in
 * plain language for the person who triggered it, not a developer. Any other recognised Postgres
 * error code is replaced with a generic, friendly equivalent from `TECHNICAL_ERROR_CODES`. An
 * unrecognised error (network failure, unexpected shape, no code at all) falls back to a single
 * generic message rather than ever risking a raw stack trace or constraint name reaching the
 * screen.
 */
export function getFriendlyErrorMessage(
  error: unknown,
  fallback: string = DEFAULT_FALLBACK,
): string {
  if (!isPostgrestLikeError(error)) {
    return fallback;
  }

  if (error.code === "P0001") {
    return error.message?.trim() || fallback;
  }

  if (error.code && error.code in TECHNICAL_ERROR_CODES) {
    return TECHNICAL_ERROR_CODES[error.code];
  }

  return fallback;
}
