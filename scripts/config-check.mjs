#!/usr/bin/env node
// Stage CJO (third/fourth supplemental queue): safe config validation. A static, offline check
// over .env presence/shape -- reports which required/optional variables are set, never their
// values. Complements the existing runtime checks in src/lib/supabase/browser.ts and server.ts
// (which already throw a clear error at first client construction if the required Supabase vars
// are missing) with something that can be run standalone, in CI, before anything tries to
// actually connect -- matching the same "fast, offline, static scan" shape as db:preflight.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(repoRoot, ".env");

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const vars = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

const fileVars = parseEnvFile(envPath);
// process.env can also supply these (e.g. CI secrets) -- a variable set either way counts as set.
function get(name) {
  return process.env[name] ?? fileVars[name] ?? "";
}

let hasError = false;
const warnings = [];

console.log(`Checking configuration (${existsSync(envPath) ? ".env found" : "no .env file"})...\n`);

// Required for the app to function at all -- browser.ts/server.ts already throw on these at
// runtime; failing fast here catches it before a dev server or build even starts.
for (const name of ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]) {
  const value = get(name);
  if (!value) {
    console.log(`✗ ${name} is not set (required)`);
    hasError = true;
  } else {
    console.log(`✓ ${name} is set`);
  }
}

// CLAUDE.md's own standing rule: no production Supabase project is configured for this app. A
// VITE_SUPABASE_URL pointing at a real *.supabase.co project (instead of a local 127.0.0.1/
// localhost instance) would mean the app -- and every test run -- is silently talking to
// production. This never prints the URL itself, only whether its *shape* looks local.
const supabaseUrl = get("VITE_SUPABASE_URL");
if (supabaseUrl && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(supabaseUrl)) {
  warnings.push(
    "VITE_SUPABASE_URL does not look like a local Supabase instance (127.0.0.1/localhost) -- " +
      "if this is pointing at a real *.supabase.co project, stop: no production project is " +
      "configured for this app (see CLAUDE.md).",
  );
}

// Optional OAuth providers -- half-configured (client id set, secret missing, or vice versa) is
// worth flagging even though supabase/config.toml's own `enabled = false` default already keeps
// both providers off regardless (defense in depth: a value here alone can't turn a provider on).
for (const provider of ["GOOGLE", "FACEBOOK"]) {
  const clientId = get(`SUPABASE_AUTH_${provider}_CLIENT_ID`);
  const secret = get(`SUPABASE_AUTH_${provider}_SECRET`);
  if (Boolean(clientId) !== Boolean(secret)) {
    warnings.push(
      `SUPABASE_AUTH_${provider}_CLIENT_ID and SUPABASE_AUTH_${provider}_SECRET are half-set ` +
        `(one present, one missing) -- ${provider.toLowerCase()} sign-in needs both, and ` +
        `supabase/config.toml also needs enabled = true for either to take effect.`,
    );
  }
}

if (warnings.length > 0) {
  console.log("\nWarnings:");
  for (const w of warnings) console.log(`  ! ${w}`);
}

if (hasError) {
  console.log("\nConfig check failed: required variables are missing. See .env.example.");
  process.exit(1);
}

console.log("\nConfig check passed.");
