#!/usr/bin/env node
// Post-integration hardening: static route/generated-artifact guard. Written directly in response
// to two real bugs found by browser QA during the frontend/backend integration (see
// docs/FRONTEND_INTEGRATION_CONFLICT_LEDGER.md and docs/INTEGRATION_FINAL_REPORT.md):
//
// 1. A new route file (_public.foundations.$slug.tsx) whose parent (_public.foundations.tsx)
//    rendered list content directly with no <Outlet/> — the child route matched but had nowhere
//    to mount, so it silently never rendered. TanStack Router's own codegen can't catch this: the
//    routeTree it generates is happy either way, since both files are valid routes on their own.
// 2. A duplicate `test:unit` key in package.json, from two independent commits each adding it.
//
// Purely static — a fast text/AST-adjacent scan over committed source, no live database needed.
// Does NOT duplicate npm run db:contract-check (that needs a live database for RPC/grant
// signatures) or the route tree's own generation (never hand-edited, always regenerated via the
// real build/dev command per CLAUDE.md).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const ROUTES_DIR = join(ROOT, "src/routes");
const ROUTE_TREE = join(ROOT, "src/routeTree.gen.ts");
const PACKAGE_JSON = join(ROOT, "package.json");

let errors = [];
let warnings = [];

// --- Check 1: every "layout" route file (one with a $slug or nested sibling under the same
// prefix) either forwards to <Outlet/> or has no such sibling to worry about. A route file is a
// suspected layout if some *other* route file shares its dot-path as a strict prefix (e.g.
// `_public.foundations.tsx` is a prefix of `_public.foundations.$slug.tsx`).
const routeFiles = readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".tsx") && !f.startsWith("__"));

function dotPath(filename) {
  return filename.replace(/\.tsx$/, "");
}

for (const file of routeFiles) {
  const base = dotPath(file);
  const hasChildren = routeFiles.some((other) => {
    if (other === file) return false;
    const otherBase = dotPath(other);
    return otherBase !== base && otherBase.startsWith(base + ".");
  });
  if (!hasChildren) continue;

  const content = readFileSync(join(ROUTES_DIR, file), "utf8");
  const hasOutlet = /<Outlet\s*\/?>/.test(content);
  const isPureLayout = /component:\s*\(\)\s*=>\s*<Outlet\s*\/?>/.test(content);

  if (!hasOutlet) {
    errors.push(
      `${file}: has child routes (e.g. a $slug or .index sibling) but its component renders no ` +
        `<Outlet/> anywhere — the child route(s) will silently never render. See ` +
        `_public.breeders.tsx / _public.foundations.tsx for the correct pure-layout pattern.`,
    );
  } else if (!isPureLayout) {
    warnings.push(
      `${file}: has child routes and does render <Outlet/>, but not as a pure layout ` +
        `(component: () => <Outlet />) — worth a manual look to confirm the child route's content ` +
        `isn't being shadowed by this file's own content rendered alongside the Outlet.`,
    );
  }
}

// --- Check 2: every route file has a corresponding import in routeTree.gen.ts (catches a route
// file that was added but never picked up by a stale generated tree — regenerate via `npm run
// build` or `npm run dev`, never hand-edit).
if (!existsSync(ROUTE_TREE)) {
  errors.push(`src/routeTree.gen.ts does not exist — run 'npm run build' or 'npm run dev' once.`);
} else {
  const treeContent = readFileSync(ROUTE_TREE, "utf8");
  for (const file of routeFiles) {
    const base = dotPath(file);
    const importPath = `./routes/${base}`;
    if (!treeContent.includes(importPath)) {
      errors.push(
        `${file}: no import of './routes/${base}' found in src/routeTree.gen.ts — the route tree ` +
          `is stale. Regenerate via 'npm run build' or 'npm run dev', never hand-edit the file.`,
      );
    }
  }
}

// --- Check 3: no duplicate keys in package.json's "scripts" block (a real bug found and fixed
// during integration — two independent commits each added the same `test:unit` key).
{
  const raw = readFileSync(PACKAGE_JSON, "utf8");
  const scriptsMatch = raw.match(/"scripts"\s*:\s*\{([^}]*)\}/s);
  if (scriptsMatch) {
    const keyMatches = [...scriptsMatch[1].matchAll(/"([a-zA-Z0-9:_-]+)"\s*:/g)].map((m) => m[1]);
    const seen = new Map();
    for (const key of keyMatches) {
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    for (const [key, count] of seen) {
      if (count > 1) errors.push(`package.json: script key "${key}" is defined ${count} times.`);
    }
  }
}

// --- Check 4: no leftover git merge-conflict markers in any tracked source file (a real risk
// during the 52-commit cherry-pick this hardening branch descends from).
{
  const CONFLICT_MARKERS = ["<<<<<<< ", "=======\n", ">>>>>>> "];
  const SRC_EXTENSIONS = new Set([".ts", ".tsx", ".json", ".md", ".sql"]);
  const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".output", ".wrangler"]);

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (SRC_EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
        const content = readFileSync(full, "utf8");
        if (CONFLICT_MARKERS.some((marker) => content.includes(marker))) {
          errors.push(`${full.replace(ROOT, "")}: contains an unresolved merge-conflict marker.`);
        }
      }
    }
  }
  walk(join(ROOT, "src"));
  walk(join(ROOT, "supabase/migrations"));
}

for (const w of warnings) console.warn(`WARN  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);

if (errors.length > 0) {
  console.error(`\n${errors.length} route/artifact guard error(s) found.`);
  process.exit(1);
}
console.log(
  `Route/artifact guard clean: ${routeFiles.length} route files checked, ` +
    `${warnings.length} warning(s), 0 errors.`,
);
