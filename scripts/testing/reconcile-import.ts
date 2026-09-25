/**
 * What became of every file in an import's source folder.   (Slice #36.22, FU-012)
 *
 *   npx tsx scripts/testing/reconcile-import.ts "C:\dev\TEST.DATA\Test.Claude\07.smoke.tc.marker"
 *
 * Normally run by the test runner's `reconcile` sequence
 * (`bash scripts/test-runner/claude.sh request reconcile <folder>`), which only
 * accepts a folder directly under `C:\dev\TEST.DATA\Test.Claude\` and passes its
 * absolute path here. The rules and the query are in `src/lib/import/reconcile.ts`;
 * this file does the I/O: a Node stand-in for the browser's directory handle, so
 * the wizard's own `walkFolder` walks the disk, and one read-only query.
 *
 * ⚠️ **READ-ONLY, TWICE OVER.** The query is SELECT only (`reconcile.test.ts`
 * pins it), and it runs in a psql session started with
 * `PGOPTIONS=-c default_transaction_read_only=on`, so even a writing statement
 * would be refused by Postgres. It reaches the local Docker database the same
 * way `scripts/Check-ImportHealth.ps1` does — `docker exec … psql` against
 * `ga40prj-postgres` / `ga40db` as `postgres`, with `POSTGRES_DB` and
 * `POSTGRES_USER` from `.env` overriding the last two — and nothing else: no
 * connection string is taken from the environment, and Supabase and UAT are
 * never reached.
 *
 * Exit: 0 nothing wrong (including "nothing from this folder is in the
 * database", the state after a case's cleanup) · 1 some of the folder landed
 * and some of it is missing — the defect this exists to catch · 2 the check
 * could not run.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { FSDirectoryHandle, FSFileHandle } from "@/lib/import/folder-utils";
import {
  buildArchiveQuery,
  formatReport,
  planSourceFolder,
  reconcile,
  type ArchivePage,
} from "@/lib/import/reconcile";

const CONTAINER = "ga40prj-postgres";

function fail(message: string): never {
  console.error(`reconcile-import: ${message}`);
  console.log(`RECONCILE: could not run — ${message}`);
  process.exit(2);
}

/** A directory on disk, shaped like the File System Access handle the wizard walks. */
function directoryHandle(abs: string, name: string): FSDirectoryHandle {
  return {
    kind: "directory",
    name,
    values: async function* () {
      for (const child of fs.readdirSync(abs)) {
        const p = path.join(abs, child);
        let stat: fs.Stats;
        try {
          stat = fs.statSync(p); // follows links, as the browser's handle does
        } catch {
          continue;
        }
        if (stat.isDirectory()) {
          yield directoryHandle(p, child);
        } else if (stat.isFile()) {
          const file: FSFileHandle = {
            kind: "file",
            name: child,
            // Only `.size` is read; a Blob-shaped stand-in is enough.
            getFile: async () => ({ name: child, size: fs.statSync(p).size }) as unknown as File,
          };
          yield file;
        }
      }
    },
  };
}

/** `POSTGRES_DB` / `POSTGRES_USER` from `.env` — those two keys and nothing else. */
function databaseNames(repo: string): { database: string; user: string } {
  const out = { database: "ga40db", user: "postgres" };
  const envFile = path.join(repo, ".env");
  if (!fs.existsSync(envFile)) return out;
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*(POSTGRES_DB|POSTGRES_USER)\s*=\s*"?([^"#\s]+)"?/.exec(line);
    if (!m) continue;
    if (m[1] === "POSTGRES_DB") out.database = m[2];
    else out.user = m[2];
  }
  return out;
}

function queryArchive(sql: string, repo: string): ArchivePage[] {
  const { database, user } = databaseNames(repo);
  const r = spawnSync(
    "docker",
    [
      "exec", "-i",
      "-e", "PGOPTIONS=-c default_transaction_read_only=on",
      "-e", "PGCLIENTENCODING=UTF8",
      CONTAINER,
      "psql", "-U", user, "-d", database, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1",
    ],
    { input: sql, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, windowsHide: true },
  );
  if (r.error) fail(`could not start docker: ${r.error.message}`);
  if (r.status !== 0) fail(`psql exited ${r.status}: ${(r.stderr || "").trim().split(/\r?\n/).slice(-3).join(" | ")}`);
  const text = (r.stdout || "").trim();
  if (text === "") return [];
  try {
    return JSON.parse(text) as ArchivePage[];
  } catch (e) {
    fail(`the query's answer was not JSON: ${(e as Error).message}`);
  }
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) fail("usage: npx tsx scripts/testing/reconcile-import.ts <folder>");
  const abs = path.resolve(arg);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) fail(`not a folder: ${abs}`);
  const repo = path.resolve(__dirname, "..", "..");

  const plan = await planSourceFolder(directoryHandle(abs, path.basename(abs)));
  const sizes = plan.expectations.flatMap((e) => (e.kind === "page" ? [e.file.size] : []));
  const pages = queryArchive(buildArchiveQuery(sizes, plan.rootName), repo);
  const report = reconcile(plan, pages);
  console.log(formatReport(report));
  process.exit(report.exitCode);
}

main().catch((e: unknown) => fail((e as Error).stack ?? String(e)));
