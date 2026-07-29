#!/usr/bin/env node
// Stage YR-19 (release-preflight self-test), extended during post-integration hardening with the
// route/generated-artifact guard (scripts/route-artifact-guard.mjs) added below. Every stage this
// whole session has manually run the same verification contract by hand: git status,
// migration-preflight, the route/artifact guard, tsc, eslint, build, a duplicate-migration-prefix
// check, and a secret scan (plus, separately when a migration changed, db:contract-check/
// db:schema-drift and a full test:db pass). This consolidates the fast, no-live-database-required
// subset into one real, executable command with a real non-zero exit code on any failure --
// exactly the tool this stage's own definition asks for, not just a repeated manual checklist. Also
// runnable as `npm run quality:integration` (an alias — same script, same behavior). The slower,
// live-database-dependent checks (test:db, db:contract-check, db:schema-drift) are deliberately NOT
// bundled in by default (they need `supabase start`/`db reset` first and take 30-60s+ each) -- pass
// `--with-db` to include them once a local stack is already running.
//
// Each check prints a clear PASS/FAIL line and its own output on failure; the script exits 1 if
// any check fails, 0 only if every check genuinely passed. Never deploys anything itself.

import { execSync } from "node:child_process";

// The real, documented lint baseline: post-integration hardening (commit 1674319) fixed all 21
// pre-existing prettier/prettier errors (they were purely deterministic formatting, safe to
// --fix) and the one fixable react-hooks/exhaustive-deps warning, dropping this from 21/13 to
// 0/14 -- the +1 over the old 13-warning figure is two new legitimate exports the frontend
// integration added to already-warning-carrying files (see docs/INTEGRATION_FINAL_REPORT.md),
// net of the one exhaustive-deps warning fixed. `npx eslint .` should now exit 0 on a clean tree;
// this compares against the real baseline so a genuine regression still fails loudly. Update these
// two numbers (and mention it in a commit message) only after a deliberate, reviewed change
// actually moves the baseline.
const LINT_BASELINE = { errors: 0, warnings: 14 };

const WITH_DB = process.argv.includes("--with-db");
const results = [];

function run(label, cmd, options = {}) {
  process.stdout.write(`\n▶ ${label}\n`);
  try {
    const output = execSync(cmd, { encoding: "utf8", stdio: "pipe", ...options });
    console.log(`✔ PASS: ${label}`);
    results.push({ label, pass: true });
    return output;
  } catch (err) {
    console.error(`✗ FAIL: ${label}`);
    const out = (err.stdout ?? "") + (err.stderr ?? "");
    console.error(out.slice(-4000)); // last 4000 chars is enough context without flooding
    results.push({ label, pass: false });
    return null;
  }
}

function checkGitClean() {
  process.stdout.write(`\n▶ git status is clean\n`);
  const status = execSync("git status --short", { encoding: "utf8" });
  if (status.trim().length === 0) {
    console.log("✔ PASS: git status is clean");
    results.push({ label: "git status is clean", pass: true });
  } else {
    console.error("✗ FAIL: git status is clean — uncommitted changes present:");
    console.error(status);
    results.push({ label: "git status is clean", pass: false });
  }
}

function checkDuplicateMigrationPrefixes() {
  process.stdout.write(`\n▶ no duplicate migration prefixes\n`);
  const files = execSync("find supabase/migrations -maxdepth 1 -type f -name '*.sql'", {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);
  const prefixes = files.map((f) => f.replace(/.*\/([0-9]+)_.*/, "$1"));
  const seen = new Set();
  const duplicates = new Set();
  for (const p of prefixes) {
    if (seen.has(p)) duplicates.add(p);
    seen.add(p);
  }
  if (duplicates.size === 0) {
    console.log(`✔ PASS: no duplicate migration prefixes (${files.length} files)`);
    results.push({ label: "no duplicate migration prefixes", pass: true });
  } else {
    console.error(`✗ FAIL: duplicate migration prefixes found: ${[...duplicates].join(", ")}`);
    results.push({ label: "no duplicate migration prefixes", pass: false });
  }
}

function checkForSecrets() {
  process.stdout.write(`\n▶ no obvious secrets in tracked files\n`);
  // A narrow, deliberately conservative pattern set -- real API keys/private keys, not every
  // string containing the word "key" or "secret" (which would flood with false positives across
  // this schema's own column/variable names). Excludes the well-known, documented-as-public local
  // Supabase demo anon/service keys (checked against tests/db/helpers.ts's own comment: "not
  // secrets, never valid against a real project").
  const patterns = [
    "-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----",
    "sk_live_[a-zA-Z0-9]+",
    "AKIA[0-9A-Z]{16}",
  ];
  const grepPattern = patterns.join("|");
  let output = "";
  try {
    // -e explicitly marks the pattern as a pattern, not a CLI option -- without it, a pattern that
    // itself starts with "-" (like the PEM private-key header below) is parsed as an unknown flag
    // instead of matched, silently turning this into a no-op that always "passes". Caught by
    // actually running this script and reading its real output, not assumed correct.
    output = execSync(`git grep -InE -e '${grepPattern}' -- . ':!scripts/release-preflight.mjs'`, {
      encoding: "utf8",
    });
  } catch (err) {
    // git grep exits 1 when it finds nothing -- that's the success case here.
    if (err.status === 1) {
      console.log("✔ PASS: no obvious secrets found in tracked files");
      results.push({ label: "no obvious secrets in tracked files", pass: true });
      return;
    }
    console.error("✗ FAIL: secret scan itself errored:", err.message);
    results.push({ label: "no obvious secrets in tracked files", pass: false });
    return;
  }
  console.error("✗ FAIL: possible secret(s) found:");
  console.error(output);
  results.push({ label: "no obvious secrets in tracked files", pass: false });
}

function checkLintBaseline() {
  const label = `lint (eslint .) against the documented baseline (${LINT_BASELINE.errors} errors / ${LINT_BASELINE.warnings} warnings)`;
  process.stdout.write(`\n▶ ${label}\n`);
  let raw;
  try {
    raw = execSync("npx eslint . --format=json", { encoding: "utf8" });
  } catch (err) {
    // eslint exits 1 whenever any error-level problem exists at all -- expected given the known
    // baseline, so its own exit code isn't the signal here; the JSON output on stdout is.
    raw = err.stdout ?? "[]";
  }
  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    console.error("✗ FAIL: could not parse eslint's JSON output");
    results.push({ label, pass: false });
    return;
  }
  const errors = report.reduce((sum, f) => sum + f.errorCount, 0);
  const warnings = report.reduce((sum, f) => sum + f.warningCount, 0);
  if (errors <= LINT_BASELINE.errors && warnings <= LINT_BASELINE.warnings) {
    console.log(`✔ PASS: ${errors} errors / ${warnings} warnings (baseline or better)`);
    results.push({ label, pass: true });
  } else {
    console.error(
      `✗ FAIL: ${errors} errors / ${warnings} warnings — worse than the documented baseline`,
    );
    results.push({ label, pass: false });
  }
}

checkGitClean();
checkDuplicateMigrationPrefixes();
checkForSecrets();
run("db:preflight (static migration text scan)", "npm run db:preflight");
run("route/generated-artifact guard", "npm run route-guard");
run("TypeScript (tsc --noEmit)", "npx tsc --noEmit");
checkLintBaseline();
run("build (vite build)", "npm run build");

if (WITH_DB) {
  run("full DB/API suite (test:db)", "npm run test:db");
  run("public contract drift (db:contract-check)", "npm run db:contract-check");
  run("schema drift (db:schema-drift)", "npm run db:schema-drift");
} else {
  console.log(
    "\nℹ Skipped live-database checks (test:db, db:contract-check, db:schema-drift) — " +
      "pass --with-db to include them once `supabase start`/`db reset` has already run.",
  );
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${"=".repeat(60)}`);
console.log(
  `Release preflight: ${results.length - failed.length}/${results.length} checks passed.`,
);
if (failed.length > 0) {
  console.error(`FAILED: ${failed.map((f) => f.label).join(", ")}`);
  console.error("\nThis does not deploy anything — fix the failures above before releasing.");
  process.exit(1);
}
console.log("All checks passed. This does not deploy anything on its own.");
