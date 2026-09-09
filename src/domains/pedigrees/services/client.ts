import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * The pedigree-graph tables (`dogs`, `dog_parent_relationships`, `pedigree_submissions`, …) and
 * their RPCs exist only in a migration that has NOT been applied to the live project yet
 * (supabase/migrations/20260910000100 + ..._200), so `src/lib/supabase/types.ts` — a generated
 * file — does not know about them and `getSupabaseBrowserClient().from("dogs")` fails to compile.
 *
 * Rather than hand-editing the generated types (which creates drift that is worse than the gap),
 * this helper returns the same singleton browser client cast to a loosely-typed `SupabaseClient`.
 * Every call site then maps the `unknown`/`any` rows onto the hand-written view-model types in
 * `../types`, the same posture the rest of the repo uses via `as unknown as` for shapes the
 * generated types don't cleanly cover. When the migration is applied and types are regenerated,
 * these casts can be removed and the real `Database` generic will type these queries directly.
 */
export function getPedigreeClient(): SupabaseClient {
  return getSupabaseBrowserClient() as unknown as SupabaseClient;
}
