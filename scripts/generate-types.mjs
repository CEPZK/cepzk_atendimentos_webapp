#!/usr/bin/env node
/**
 * Keeps the frontend's view of the database honest.
 *
 *   SUPABASE_PROJECT_REF=abcdefghijk npm run types:generate     # from a project
 *   npm run types:generate -- --local                            # `supabase start`
 *   npm run contract:check                                       # diff, no CLI
 *
 * The generated file is machine-owned; contracts/types/database.types.ts is
 * hand-owned and is what the app imports. They stay separate deliberately:
 * typegen would clobber the frozen identity region, and silently re-typing the
 * app against whatever the DB currently holds is exactly how a dropped column
 * becomes a runtime crash in production instead of a red CI run.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const generatedPath = join(root, "contracts/types/database.generated.ts");
const contractPath = join(root, "contracts/types/database.types.ts");

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const local = args.includes("--local");
const ref =
  process.env.SUPABASE_PROJECT_REF ??
  process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF;

/* ── table extraction ─────────────────────────────────────────────────────── */
/**
 * Pulls the table names out of the `Tables: { ... }` block of either file.
 * Regex over generated TS is acceptable *only* because this is a drift alarm,
 * not a security check: a false "no drift" costs a review miss, it cannot grant
 * access to anything.
 */
function tablesIn(text) {
  const block = text.match(/Tables:\s*\{([\s\S]*?)\n {4}\}/);
  if (!block) return new Set();
  return new Set(
    [...block[1].matchAll(/^ {6}([a-z_][a-z0-9_]*):\s*\{/gm)].map((m) => m[1]),
  );
}

function readOrEmpty(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function reportDrift(output) {
  const contractTables = tablesIn(readOrEmpty(contractPath));
  const liveTables = tablesIn(output);

  const added = [...liveTables].filter((t) => !contractTables.has(t));
  const removed = [...contractTables].filter((t) => !liveTables.has(t));

  console.log(
    `\ncontract tables: ${[...contractTables].join(", ") || "(none)"}`,
  );
  console.log(`live db tables:  ${[...liveTables].join(", ") || "(none)"}`);

  if (added.length)
    console.log(
      `\n+ in the database, not in the contract: ${added.join(", ")}`,
    );
  if (removed.length)
    console.log(
      `- in the contract, missing in the database: ${removed.join(", ")}`,
    );

  if (added.length || removed.length) {
    console.log(
      "\nDrift. Update contracts/sql/ + contracts/types/database.types.ts in this\n" +
        "repo first (that is the contract), then have the backend apply it — not the\n" +
        "other way round. The app compiles against the contract, so a silent rename\n" +
        "here is a blank screen in production, not a type error.",
    );
    return false;
  }
  console.log("\n✓ no table-level drift");
  return true;
}

/* ── check-only mode ──────────────────────────────────────────────────────── */
if (checkOnly) {
  if (!existsSync(generatedPath)) {
    console.error(
      "Nothing to check: contracts/types/database.generated.ts is absent.\n" +
        "Run `npm run types:generate` (needs the Supabase CLI + project access),\n" +
        "or have the backend pipeline publish it as a build artifact.",
    );
    process.exit(1);
  }
  console.log(
    `checking ${generatedPath.slice(root.length + 1)} against the contract`,
  );
  process.exit(reportDrift(readFileSync(generatedPath, "utf8")) ? 0 : 2);
}

/* ── generate mode ────────────────────────────────────────────────────────── */
if (!local && !ref) {
  console.error(
    "Missing SUPABASE_PROJECT_REF (or pass --local for a `supabase start` database).",
  );
  process.exit(1);
}

const cli = process.env.SUPABASE_CLI ?? "supabase";
const source = local ? "--local" : `--project-id=${ref}`;
console.log(`$ ${cli} gen types typescript ${source} --schema public`);

let output;
try {
  output = execFileSync(
    cli,
    ["gen", "types", "typescript", source, "--schema", "public"],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
      env: {
        ...process.env,
        SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN ?? "",
      },
    },
  );
} catch (e) {
  console.error(
    "\nCould not run the Supabase CLI. Either `npm i -D supabase`, or have the\n" +
      "backend repo commit contracts/types/database.generated.ts so typegen stays\n" +
      "a single trusted source. Nothing was written.\n",
  );
  process.exit(e?.status ?? 1);
}

if (!output.includes("export type Database")) {
  console.error(
    "Unexpected typegen output — refusing to write.\n" + output.slice(0, 400),
  );
  process.exit(1);
}

mkdirSync(dirname(generatedPath), { recursive: true });
writeFileSync(
  generatedPath,
  [
    "/* eslint-disable */",
    "// @ts-nocheck",
    "// ⚠️ MACHINE-GENERATED by scripts/generate-types.mjs — do not edit, do not import from app code.",
    `// source: supabase gen types typescript ${source} --schema public`,
    `// generated: ${new Date().toISOString()}`,
    "",
    "",
    output,
  ].join("\n"),
);
console.log(
  `wrote ${generatedPath.slice(root.length + 1)} (${output.length} bytes)`,
);

process.exit(reportDrift(output) ? 0 : 2);
