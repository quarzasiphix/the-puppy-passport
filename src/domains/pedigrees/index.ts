// Public API of the pedigrees domain. Import from here only — never reach into ./services
// directly (enforced by eslint.config.js). See docs/PEDIGREE_GRAPH.md.
//
// Backed by supabase/migrations/20260910000100_pedigree_graph_schema.sql +
// 20260910000200_pedigree_graph_rpcs.sql. Those migrations are written but NOT YET APPLIED to the
// live project, so `src/lib/supabase/types.ts` has no pedigree tables and the service layer
// queries through a loosely-typed client (services/client.ts). Everything here compiles and is
// logically correct against the migration; none of it is DB-verified yet.

export * from "./types";
export * from "./services/dogs";
export * from "./services/tree";
export * from "./services/submissions";
export * from "./services/claims";
export * from "./services/extraction";
