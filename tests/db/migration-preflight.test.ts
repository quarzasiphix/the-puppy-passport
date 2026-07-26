// Stage XR-2 (append-only queue): SECURITY DEFINER audit. scripts/migration-preflight.mjs
// (Stage CA) had no test file at all despite its own commit message claiming each check was
// "unit-tested... against synthetic bad SQL to confirm the detection logic actually fires" --
// found while extending it with a 5th check (SECURITY DEFINER without a pinned search_path,
// this stage's own real deliverable, turning the manual `psql` audit run by hand at Stages
// IR-13/IR-17 into something automated and repeatable). No DB connection needed -- this is a
// pure static-text-parsing script, tested here the same way any other pure function in this repo
// is (see notification-template-versioning.test.ts's render-purity tests), just living in
// tests/db/ since that's the one test command this repo's package.json actually wires up.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findFailures,
  collectAllGrantedTables,
  collectSecurityDefinerSearchPathStatus,
  stripSqlComments,
} from "../../scripts/migration-preflight.mjs";

test("stripSqlComments: removes line comments, leaves real SQL untouched", () => {
  const sql = "select 1; -- a comment\nselect 2;";
  assert.equal(stripSqlComments(sql), "select 1; \nselect 2;");
});

test("check 1 (GRANT-vs-RLS gap): fires only when a table has RLS+policy but no grant anywhere", () => {
  const withGrant = `
    create table public.widgets (id uuid primary key);
    alter table public.widgets enable row level security;
    create policy "owners manage widgets" on public.widgets for all using (true);
    grant select, insert on public.widgets to authenticated;
  `;
  assert.deepEqual(findFailures("f.sql", withGrant, collectAllGrantedTables(withGrant)), []);

  const withoutGrant = `
    create table public.gadgets (id uuid primary key);
    alter table public.gadgets enable row level security;
    create policy "owners manage gadgets" on public.gadgets for all using (true);
  `;
  const failures = findFailures("f.sql", withoutGrant, collectAllGrantedTables(withoutGrant));
  assert.equal(failures.length, 1);
  assert.match(failures[0], /gadgets.*no "grant/s);
});

test("check 1: a grant living in a different file still counts (global, not per-file)", () => {
  const fileA = `
    create table public.thingies (id uuid primary key);
    alter table public.thingies enable row level security;
    create policy "p" on public.thingies for all using (true);
  `;
  const fileB = `grant select on public.thingies to authenticated;`;
  const granted = collectAllGrantedTables(fileA + "\n" + fileB);
  assert.deepEqual(findFailures("fileA.sql", fileA, granted), []);
});

test("check 2 (NOT NULL without DEFAULT): fires only without a default", () => {
  const bad = `alter table public.x add column y text not null;`;
  const failuresBad = findFailures("f.sql", bad, new Set());
  assert.equal(failuresBad.length, 1);
  assert.match(failuresBad[0], /not null.*no DEFAULT/);

  const good = `alter table public.x add column y text not null default 'z';`;
  assert.deepEqual(findFailures("f.sql", good, new Set()), []);
});

test("check 3 (enum value added and used in the same file): fires on same-file reuse only", () => {
  const bad = `
    alter type public.status_enum add value 'brand_new';
    update public.x set status = 'brand_new' where id = 1;
  `;
  const failuresBad = findFailures("f.sql", bad, new Set());
  assert.equal(failuresBad.length, 1);
  assert.match(failuresBad[0], /brand_new.*same transaction/);

  const onlyAdded = `alter type public.status_enum add value 'brand_new';`;
  assert.deepEqual(findFailures("f.sql", onlyAdded, new Set()), []);
});

test("check 4 (bare destructive drops): fires on drop table/column", () => {
  const dropTable = `drop table public.old_thing;`;
  assert.equal(findFailures("f.sql", dropTable, new Set()).length, 1);

  const dropColumn = `alter table public.x drop column y;`;
  assert.equal(findFailures("f.sql", dropColumn, new Set()).length, 1);

  // Every real "drop policy"/"drop trigger"/"drop function" in this schema is immediately
  // followed by a `create` in the same migration (the standard "replace" pattern) -- this check
  // only ever targets table/column drops, the two forms never immediately re-created.
  const dropPolicy = `drop policy "p" on public.x;\ncreate policy "p" on public.x for select using (true);`;
  assert.deepEqual(findFailures("f.sql", dropPolicy, new Set()), []);
});

test("check 5 (SECURITY DEFINER without pinned search_path): the real check this stage added", () => {
  const files = ["a.sql"];
  const unpinned = new Map([
    [
      "a.sql",
      `create function public.risky_fn(p_id uuid)
       returns boolean
       language plpgsql
       security definer
       as $$
       begin
         return true;
       end;
       $$;`,
    ],
  ]);
  const unpinnedStatus = collectSecurityDefinerSearchPathStatus(files, unpinned);
  assert.deepEqual(unpinnedStatus.get("risky_fn"), {
    securityDefiner: true,
    searchPathPinned: false,
  });

  const pinned = new Map([
    [
      "a.sql",
      `create function public.safe_fn(p_id uuid)
       returns boolean
       language plpgsql
       security definer
       set search_path = public
       as $$
       begin
         return true;
       end;
       $$;`,
    ],
  ]);
  const pinnedStatus = collectSecurityDefinerSearchPathStatus(files, pinned);
  assert.deepEqual(pinnedStatus.get("safe_fn"), { securityDefiner: true, searchPathPinned: true });

  // A plain (non-SECURITY DEFINER) function is never flagged regardless of search_path.
  const invoker = new Map([
    [
      "a.sql",
      `create function public.plain_fn() returns boolean language sql as $$ select true; $$;`,
    ],
  ]);
  const invokerStatus = collectSecurityDefinerSearchPathStatus(files, invoker);
  assert.deepEqual(invokerStatus.get("plain_fn"), {
    securityDefiner: false,
    searchPathPinned: false,
  });
});

test("check 5: a later redefinition (a later file) overrides an earlier one's status", () => {
  const files = ["a.sql", "b.sql"];
  const fileContents = new Map([
    [
      "a.sql",
      `create function public.evolving_fn()
       returns boolean
       language sql
       security definer
       as $$ select true; $$;`,
    ],
    [
      "b.sql",
      `create or replace function public.evolving_fn()
       returns boolean
       language sql
       security definer
       set search_path = public
       as $$ select true; $$;`,
    ],
  ]);
  const status = collectSecurityDefinerSearchPathStatus(files, fileContents);
  // The function started unpinned in a.sql but was fixed in b.sql -- only the latest definition
  // (processed last, since files are walked in filename order) should be what's recorded.
  assert.deepEqual(status.get("evolving_fn"), { securityDefiner: true, searchPathPinned: true });
});

test("the real, current migration set has zero SECURITY DEFINER functions without a pinned search_path", async () => {
  // Not a synthetic case -- a direct regression test against this repo's own real migrations,
  // matching what a fresh `npm run db:preflight` run already confirms via its CLI output.
  const { readdirSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const dir = join(import.meta.dirname, "..", "..", "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const fileContents = new Map(files.map((f) => [f, readFileSync(join(dir, f), "utf8")]));
  const status = collectSecurityDefinerSearchPathStatus(files, fileContents);
  const unpinned = [...status.entries()].filter(
    ([, s]) => s.securityDefiner && !s.searchPathPinned,
  );
  assert.deepEqual(unpinned, []);
});
