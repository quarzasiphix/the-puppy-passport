#!/usr/bin/env node
// Stage CA (supplemental queue): migration preflight command. Turns Stage AL's one-time, manual,
// Python-assisted migration-quality audit into a real, reusable, runnable command
// (`npm run db:preflight`) instead of a snapshot that goes stale the moment the next migration is
// added. Checks four concrete, previously-real bug classes this session actually hit — not
// speculative style rules:
//
// 1. GRANT-vs-RLS gap: a table with RLS policies but no matching table-level GRANT. This exact
//    class (`auto_expose_new_tables=false` — RLS alone doesn't make a table reachable via
//    PostgREST's Data API) was found and fixed FIVE separate times this session
//    (transport_request_animals, rate_limit_events, user_consents, and others) — always caught
//    late, by actually hitting "permission denied" from a real client call. This is the single
//    most valuable check here.
// 2. `add column ... not null` with no `default` on the same statement — breaks against a table
//    that already has rows (Stage AL's check #1, now automated instead of a one-time manual pass).
// 3. `alter type ... add value` followed by a literal use of that same new value later in the SAME
//    file — Postgres cannot use a newly-added enum value in the same transaction it was added in
//    (Stage BN hit this for real: a first version tried exactly this and had to be split into two
//    migration files). Flags same-file add+use; using it starting in a later file, the established
//    safe pattern, is fine.
// 4. A bare `drop table`/`drop column` — always destructive, always worth a human's eyes before it
//    ships (Stage AL's manual audit found zero of these; this makes sure a future one can't slip
//    through unnoticed).
//
// Deliberately does NOT duplicate the CI job's existing duplicate-prefix check (`ci.yml` already
// has it inline) or attempt to re-verify things that need a live database (RLS policy correctness,
// whether a GRANT's columns match intent) — this is a fast, offline, static text scan over
// `supabase/migrations/*.sql`, meant to run in seconds before a slower `db reset` + `test:db` pass,
// not a replacement for either.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "supabase", "migrations");

function stripSqlComments(sql) {
  return sql.replace(/--.*$/gm, "");
}

// Table-level GRANTs commonly live in a different (often much later, sometimes earlier-centralized
// — see 20260101002900_table_grants.sql) migration file than the one that created the table, so
// "does this table ever get granted, anywhere in the whole migration history" has to be answered
// globally, not per-file — checking only the same file produced 44 false positives against this
// schema's own real, already-correctly-granted tables during this script's first draft.
function collectAllGrantedTables(allSql) {
  const granted = new Set();
  for (const grantMatch of allSql.matchAll(
    /grant\s+[\w,\s]+\s+on\s+((?:public\.\w+\s*,?\s*)+)\s+to/gi,
  )) {
    for (const tableMatch of grantMatch[1].matchAll(/public\.(\w+)/g)) {
      granted.add(tableMatch[1]);
    }
  }
  return granted;
}

function findFailures(filename, rawSql, allGrantedTables) {
  const failures = [];
  const sql = stripSqlComments(rawSql);
  const lowerSql = sql.toLowerCase();

  // --- Check 1: GRANT-vs-RLS gap ---
  // For every `create table public.<name>` in this file that also gets
  // `alter table public.<name> ... enable row level security` and at least one
  // `create policy ... on public.<name>`, there must be a matching `grant ... on public.<name> to`
  // *somewhere* in the whole migration history (this file, an earlier centralizing one, or a later
  // corrective one) — not necessarily this same file.
  const createdTables = [...sql.matchAll(/create\s+table\s+public\.(\w+)/gi)].map((m) => m[1]);
  for (const table of createdTables) {
    const hasRls = new RegExp(
      `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
      "i",
    ).test(sql);
    const hasPolicy = new RegExp(
      `on\\s+public\\.${table}\\s+for\\s+(select|insert|update|delete|all)`,
      "i",
    ).test(sql);
    if (hasRls && hasPolicy && !allGrantedTables.has(table)) {
      failures.push(
        `table "${table}" has RLS + at least one policy but no "grant ... on public.${table} to ..." ` +
          `statement anywhere in supabase/migrations/ — RLS alone does not make a table reachable ` +
          `via the Data API (auto_expose_new_tables=false); this table will likely 403 on every real ` +
          `client call until a GRANT is added.`,
      );
    }
  }

  // --- Check 2: NOT NULL column added without a DEFAULT ---
  const addColumnNotNullMatches = [
    ...sql.matchAll(
      /add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)\s+[\w\[\]().,\s]*?not\s+null([^;]*)/gi,
    ),
  ];
  for (const match of addColumnNotNullMatches) {
    const [, columnName, rest] = match;
    if (!/default/i.test(rest) && !/default/i.test(match[0])) {
      failures.push(
        `"add column ${columnName} ... not null" with no DEFAULT — will fail outright against a ` +
          `table that already has rows in production (empty-database migrations are safe, but this ` +
          `stops being true the moment real data exists).`,
      );
    }
  }

  // --- Check 3: enum value added and used in the same file ---
  const addedEnumValues = [
    ...sql.matchAll(/alter\s+type\s+[\w.]+\s+add\s+value\s+'([^']+)'/gi),
  ].map((m) => m[1]);
  for (const value of addedEnumValues) {
    // Count occurrences of the literal value; more than the one that added it means it's also
    // being used (e.g. as a default, a comparison, or an argument) in the same transaction.
    const occurrences = (lowerSql.match(new RegExp(`'${value.toLowerCase()}'`, "g")) ?? []).length;
    if (occurrences > 1) {
      failures.push(
        `enum value '${value}' is added via "alter type ... add value" and also appears to be used ` +
          `elsewhere in this same file — Postgres cannot use a newly-added enum value in the same ` +
          `transaction it was added in. Split into two migration files: add the value in one, start ` +
          `using it in a later one (see 20260101010600/20260101010700 for the established pattern).`,
      );
    }
  }

  // --- Check 4: bare destructive drops ---
  if (/drop\s+table\s+(?!if\s+not\s+exists)/i.test(sql)) {
    failures.push(`contains "drop table" — always destructive, needs explicit human review.`);
  }
  if (/drop\s+column/i.test(sql)) {
    failures.push(`contains "drop column" — always destructive, needs explicit human review.`);
  }

  return failures;
}

function main() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const fileContents = new Map(
    files.map((f) => [f, readFileSync(join(MIGRATIONS_DIR, f), "utf8")]),
  );
  const allSql = [...fileContents.values()].join("\n");
  const allGrantedTables = collectAllGrantedTables(stripSqlComments(allSql));

  let totalFailures = 0;
  for (const file of files) {
    const failures = findFailures(file, fileContents.get(file), allGrantedTables);
    for (const failure of failures) {
      console.error(`✗ ${file}: ${failure}`);
      totalFailures++;
    }
  }

  console.log(`Scanned ${files.length} migration files.`);
  if (totalFailures > 0) {
    console.error(`\n${totalFailures} potential issue(s) found — review before merging/deploying.`);
    process.exit(1);
  }
  console.log("No known unsafe patterns found.");
}

main();
