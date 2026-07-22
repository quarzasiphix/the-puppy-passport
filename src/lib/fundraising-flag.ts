// Verified-organisation fundraising stays disabled until a real payment provider, refund rules
// and legal texts are explicitly approved (docs/FUNDRAISING_POLICY.md). The schema/RLS/UI all
// exist and are tested, but every entry point checks this flag first and shows an honest
// "not yet available" state instead when it's off — never a broken or misleading action.
//
// Set VITE_FUNDRAISING_ENABLED=true only in a development environment to preview the UI against
// the local Supabase stack's simulated (is_simulated = true) contributions. Never set this in a
// production build.
export const FUNDRAISING_ENABLED = import.meta.env.VITE_FUNDRAISING_ENABLED === "true";
