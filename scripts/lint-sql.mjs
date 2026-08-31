#!/usr/bin/env node
/**
 * Syntax-checks the contract's SQL with Postgres' own grammar (libpg-query, via
 * pgsql-parser) so a typo in contracts/sql/*.sql is caught in this repo, before
 * it is pasted into the backend's migration folder.
 *
 * Grammar only: it cannot know whether a referenced table exists or whether a
 * policy is missing. `supabase db push` on a branch is still the real test.
 */
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "contracts/sql");

let { parse } = await import("pgsql-parser").catch(() => ({ parse: null }));
if (!parse) {
  console.error("pgsql-parser is not installed — skipping SQL syntax check.");
  process.exit(0);
}

const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let failed = 0;
for (const f of files) {
  const sql = readFileSync(join(dir, f), "utf8");
  // Strip the pseudo-FK shorthand used in prose so the grammar sees valid SQL.
  const normalized = sql.replace(/\bfk\(([a-z_.]+)\)/gi, "references $1");
  try {
    const out = await parse(normalized);
    const statements = Array.isArray(out) ? out.length : (out?.stmts?.length ?? 0);
    console.log(`✓ ${f} — ${statements} statement${statements === 1 ? "" : "s"}`);
  } catch (e) {
    failed++;
    const msg = String(e?.message ?? e).split("\n").slice(0, 4).join("\n  ");
    console.error(`✗ ${f}\n  ${msg}`);
  }
}

if (failed) {
  console.error(`\n${failed} file(s) do not parse as Postgres SQL.`);
  process.exit(1);
}
console.log(`\n✓ all ${files.length} contract SQL file(s) parse`);
