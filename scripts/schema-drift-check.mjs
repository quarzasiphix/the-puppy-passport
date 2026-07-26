#!/usr/bin/env node
// Stage XR-20 (append-only queue): schema/migration drift detection. Complements two existing
// checks that each cover a narrower slice: migration-preflight.mjs is a static text scan over
// migration files (never touches a live database), and contract-drift-check.mjs (Stage XR-18)
// only covers the public grant/RPC surface. Neither one catches the case this stage names: someone
// (or some tool) changes the live database directly -- a manual `ALTER TABLE`, an ad hoc `psql`
// session, a hand-edited row in a system catalog -- without a corresponding committed migration
// file. That drift is invisible to both existing checks, since the live schema and the migration
// files disagree and nothing compares them.
//
// `supabase db diff --local` already does exactly this comparison: it builds a disposable shadow
// database from the committed migration files, then diffs it against the real local database,
// emitting a JSON object with a `diff` field that is empty only when the two are identical. Live-
// verified while building this: created a real table directly via `psql` (bypassing migrations
// entirely), ran the same command, and it reported the exact `CREATE TABLE`/`GRANT` statements
// needed to reconcile the drift; reverted and confirmed clean again. The one thing the CLI does
// not do on its own is fail loudly -- it exits 0 whether or not real drift was found, which is
// useless as a written check. This script is a thin wrapper that parses that JSON output and turns
// a nonempty diff into a real failure with the actual drift SQL printed.
//
// Needs a live database, like contract-drift-check.mjs -- not wired into the fast no-Docker CI
// job; run manually (`npm run db:schema-drift`) or wherever `test:db`/`db:contract-check` already
// run.

import { execFileSync } from "node:child_process";

function main() {
  let output;
  try {
    output = execFileSync("npx", ["supabase", "db", "diff", "--local"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    });
  } catch (err) {
    console.error("supabase db diff --local failed to run:");
    console.error(err.stdout ?? err.message);
    process.exit(1);
  }

  const jsonLine = output
    .split("\n")
    .map((line) => line.trim())
    .reverse()
    .find((line) => line.startsWith("{") && line.endsWith("}"));

  if (!jsonLine) {
    console.error(
      "Could not find the expected JSON summary line in `supabase db diff --local` output -- the " +
        "CLI's output format may have changed. Full output:\n" +
        output,
    );
    process.exit(1);
  }

  const result = JSON.parse(jsonLine);
  const diff = (result.diff ?? "").trim();

  if (diff.length > 0) {
    console.error(
      "✗ Schema drift detected: the live database does not match the committed migrations.\n",
    );
    console.error(diff);
    console.error(
      "\nEither this change was made directly against the database (write a real migration file " +
        "for it instead), or a migration is missing/incomplete.",
    );
    process.exit(1);
  }

  console.log("No schema drift: the live database matches the committed migration files exactly.");
}

main();
