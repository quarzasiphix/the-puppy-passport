import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * The pedigree-graph migrations (supabase/migrations/20260910000100–000400) ARE now applied to the
 * live project and `src/lib/supabase/types.ts` has been regenerated to include `dogs`,
 * `dog_parent_relationships`, `pedigree_submissions`, the `public_dogs` view, `search_dogs_ranked`,
 * etc. This loose `SupabaseClient` cast is therefore no longer *required* — it's a removable
 * follow-up: swapping `getPedigreeClient()` for `getSupabaseBrowserClient()` directly across the
 * pedigree services and deleting the local row-shape casts would let the real `Database` generic
 * type these queries. Left in place for now only because that refactor touches every service file
 * and `tsc`/`build` already pass; not a correctness issue.
 */
export function getPedigreeClient(): SupabaseClient {
  return getSupabaseBrowserClient() as unknown as SupabaseClient;
}
