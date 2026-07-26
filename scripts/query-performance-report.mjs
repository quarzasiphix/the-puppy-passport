#!/usr/bin/env node
// Stage XR-21 (append-only queue): query performance budget audit. Stages N and W (see
// supabase/migrations/*_marketplace_listing_indexes.sql,
// *_public_listing_query_indexes.sql) each explicitly deferred indexing the ~130 other unindexed
// foreign-key columns found during their own audits, "left for a future pass once real usage data
// (pg_stat_statements or equivalent) can identify genuinely hot ones, rather than indexed
// speculatively here." pg_stat_statements is already installed and enabled in this project's local
// Postgres image (confirmed via `pg_extension`) -- this script is that future pass's tool: a
// repeatable way to turn a real workload (a `test:db` run, or real app usage) into a ranked report
// of the actually-hottest queries, so future indexing decisions can be evidence-based rather than
// guessed, matching this session's own "no blind indexing" discipline.
//
// Usage:
//   node scripts/query-performance-report.mjs --reset   # zero out counters before a workload
//   node scripts/query-performance-report.mjs           # report the top N queries since the last reset
//
// Needs a live database with pg_stat_statements enabled, like contract-drift-check.mjs and
// schema-drift-check.mjs -- not wired into the fast no-Docker CI job.

import { execFileSync } from "node:child_process";

const CONTAINER = "supabase_db_the-puppy-passport";
const TOP_N = Number(process.argv.find((a) => a.startsWith("--top="))?.split("=")[1] ?? 20);

function runSql(sql) {
  return execFileSync(
    "docker",
    ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-t", "-A", "-F", "|"],
    { input: sql, encoding: "utf8" },
  );
}

function main() {
  if (process.argv.includes("--reset")) {
    runSql("select pg_stat_statements_reset();");
    console.log(
      "pg_stat_statements counters reset. Now exercise a real workload (e.g. `npm run test:db`),",
    );
    console.log("then re-run this script without --reset to see the report.");
    return;
  }

  // pg_stat_statements' own `query` text can contain embedded newlines (multi-line SQL bodies) --
  // flattened here with regexp_replace so the psql "one record per output line" assumption below
  // holds for every row, not just single-line queries.
  const sql = `
    select regexp_replace(query, '\\s+', ' ', 'g'), calls,
      round(total_exec_time::numeric, 2), round(mean_exec_time::numeric, 3), rows
    from pg_stat_statements
    where query not ilike '%pg_stat_statements%'
      and query not ilike 'BEGIN%' and query not ilike 'COMMIT%' and query not ilike 'ROLLBACK%'
      and query not ilike 'select set_config%'
    order by total_exec_time desc
    limit ${TOP_N};
  `;
  const output = runSql(sql);
  const rows = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [query, calls, totalMs, meanMs, resultRows] = line.split("|");
      return { query, calls, totalMs, meanMs, resultRows };
    });

  if (rows.length === 0) {
    console.log("No statements recorded -- run with --reset, exercise a workload, then re-run.");
    return;
  }

  console.log(`Top ${rows.length} queries by total execution time since the last reset:\n`);
  for (const r of rows) {
    const shortQuery = r.query.length > 140 ? r.query.slice(0, 140) + "…" : r.query;
    console.log(
      `${r.totalMs}ms total, ${r.meanMs}ms mean, ${r.calls} calls, ${r.resultRows} rows -- ${shortQuery}`,
    );
  }
}

main();
