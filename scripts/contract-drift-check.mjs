#!/usr/bin/env node
// Stage XR-18 (append-only queue): public contract drift scanner. Stage IR-1's own
// docs/BACKEND_API_CONTRACT_SNAPSHOT.md is a real, correct point-in-time record, but a static
// markdown snapshot with no automation goes stale the moment the next migration changes a grant
// or an RPC signature -- confirmed while building this: that snapshot is dated 2026-07-25 against
// migration `20260101012200` (124 files); this repository is now at 135. This script queries the
// LIVE local database for the exact same two contracts IR-1's snapshot documents (table
// SELECT/INSERT/UPDATE/DELETE grants to anon/authenticated, and every RPC's real signature/grant)
// and diffs them against a committed baseline (docs/backend-api-contract-baseline.json), the same
// "generate + compare against a committed baseline" shape this session already uses for the ESLint
// baseline (Stage IR-16).
//
// Needs a live database (`supabase db reset`/`supabase start` first) -- unlike
// migration-preflight.mjs, this is not a static text scan, since grants and signatures are a
// property of the actual applied schema, not directly derivable from migration text alone (a
// `create or replace function` doesn't show what search_path/grants a *different* file may have
// layered on afterward without literally replaying every migration). Not wired into the fast
// no-Docker CI job for that reason; run manually (`npm run db:contract-check`) or as a job that
// already has a live database available (the same job that runs `test:db`).
//
// `--write` regenerates the baseline from the current live schema (use after a deliberate,
// reviewed contract change); the default mode only ever compares and reports, never overwrites.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASELINE_PATH = join(import.meta.dirname, "..", "docs", "backend-api-contract-baseline.json");
// Derived from this worktree's own supabase/config.toml rather than hardcoded -- a hardcoded
// "supabase_db_the-puppy-passport" silently targets the *main* worktree's shared container even
// when run from a worktree configured with a different project_id (confirmed the hard way: this
// exact bug sent this script's real queries at the shared instance while a hardening branch's own
// isolated instance, on different ports/container names, sat right there unqueried -- see
// docs/HARDENING_ISOLATED_DB_VERIFICATION.md for the full incident).
function currentProjectId() {
  const configPath = join(import.meta.dirname, "..", "supabase", "config.toml");
  const match = readFileSync(configPath, "utf8").match(/^project_id\s*=\s*"([^"]+)"/m);
  if (!match) throw new Error(`Could not find project_id in ${configPath}`);
  return match[1];
}
const CONTAINER = `supabase_db_${currentProjectId()}`;

const TABLE_GRANTS_SQL = `
select t.table_name,
  coalesce(string_agg(distinct case when r.grantee='anon' then r.privilege_type end, ','), '') as anon,
  coalesce(string_agg(distinct case when r.grantee='authenticated' then r.privilege_type end, ','), '') as authenticated
from information_schema.tables t
join information_schema.table_privileges r
  on r.table_schema='public' and r.table_name=t.table_name
  and r.grantee in ('anon','authenticated') and r.privilege_type in ('SELECT','INSERT','UPDATE','DELETE')
where t.table_schema='public' and t.table_type='BASE TABLE'
group by t.table_name order by t.table_name;
`;

const RPC_SIGNATURES_SQL = `
select p.proname, pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid),
  coalesce(string_agg(distinct r.grantee, ','), '')
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
left join information_schema.routine_privileges r
  on r.routine_schema='public' and r.routine_name=p.proname and r.grantee in ('anon','authenticated')
where n.nspname='public' and p.prokind='f'
group by p.proname, p.oid having string_agg(distinct r.grantee, ',') is not null
order by p.proname, 2;
`;

function runSql(sql) {
  const output = execFileSync(
    "docker",
    ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-t", "-A", "-F", "|"],
    { input: sql, encoding: "utf8" },
  );
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function buildSnapshot() {
  const tableRows = runSql(TABLE_GRANTS_SQL);
  const tables = {};
  for (const row of tableRows) {
    const [name, anon, authenticated] = row.split("|");
    tables[name] = { anon, authenticated };
  }

  const rpcRows = runSql(RPC_SIGNATURES_SQL);
  const rpcs = {};
  for (const row of rpcRows) {
    const [name, args, returns, grantees] = row.split("|");
    const key = `${name}(${args})`;
    rpcs[key] = { returns, grantees };
  }

  return { tables, rpcs };
}

function diffObjects(label, baseline, current) {
  const failures = [];
  const baseKeys = new Set(Object.keys(baseline));
  const curKeys = new Set(Object.keys(current));

  for (const key of baseKeys) {
    if (!curKeys.has(key)) {
      failures.push(`${label} "${key}" existed in the baseline but is gone from the live schema.`);
      continue;
    }
    const before = JSON.stringify(baseline[key]);
    const after = JSON.stringify(current[key]);
    if (before !== after) {
      failures.push(`${label} "${key}" drifted: baseline ${before} -> live ${after}`);
    }
  }
  for (const key of curKeys) {
    if (!baseKeys.has(key)) {
      failures.push(`${label} "${key}" is new in the live schema, not yet in the baseline.`);
    }
  }
  return failures;
}

function main() {
  const write = process.argv.includes("--write");
  const snapshot = buildSnapshot();

  if (write) {
    writeFileSync(BASELINE_PATH, JSON.stringify(snapshot, null, 2) + "\n");
    console.log(
      `Wrote a fresh baseline: ${Object.keys(snapshot.tables).length} tables, ` +
        `${Object.keys(snapshot.rpcs).length} RPCs.`,
    );
    return;
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error(
      `No baseline found at ${BASELINE_PATH}. Run "node scripts/contract-drift-check.mjs --write" ` +
        `once to create the initial baseline after reviewing the live schema is correct.`,
    );
    process.exit(1);
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const tableFailures = diffObjects("Table grant", baseline.tables, snapshot.tables);
  const rpcFailures = diffObjects("RPC", baseline.rpcs, snapshot.rpcs);
  const failures = [...tableFailures, ...rpcFailures];

  if (failures.length > 0) {
    for (const f of failures) console.error(`✗ ${f}`);
    console.error(
      `\n${failures.length} contract drift(s) found. If this is a deliberate, reviewed change, ` +
        `regenerate the baseline: node scripts/contract-drift-check.mjs --write`,
    );
    process.exit(1);
  }

  console.log(
    `No contract drift: ${Object.keys(snapshot.tables).length} tables, ` +
      `${Object.keys(snapshot.rpcs).length} RPCs match the committed baseline.`,
  );
}

main();
