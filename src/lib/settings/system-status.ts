/**
 * What „Setări" reads about the installation: backups, AI, and itself.
 *                                                               (Slice #38.40)
 *
 * READ-ONLY, ALL OF IT. The backups are written by the test runner on Adrian's
 * laptop (scripts/backup/), to `%OneDrive%\ga40prj-backups\<UTC time>\`, and
 * the restore drill's verdicts go to `drills.json` beside them. This module
 * lists the folders and reads that file through scripts/backup/state.ts — the
 * runner's own reader — and never writes, starts or deletes anything.
 *
 * WHERE THE FILES CANNOT BE REACHED — UAT, Vercel (#38.22), or a laptop with no
 * OneDrive — the answer says so (`reachable: false` and why) instead of
 * failing: the section is information, not a gate.
 *
 * „Despre" never carries a credential: the database is its host and its name,
 * read out of DATABASE_URL by `URL`, the user and the password left behind.
 */

import fs from "fs";
import path from "path";
import { backupRoot, listBackups, readDrillLog } from "../../../scripts/backup/state";
import { MANIFEST_FILE } from "../../../scripts/backup/rules";
import { isUatNoAuth } from "@/lib/auth/current-user";
import { aiModelsInUse, type AiModelUse } from "@/lib/ai/models";

export type BackupStatus =
  | { reachable: false; why: string }
  | {
      reachable: true;
      /** The newest complete backup, or null when the folder holds none. */
      lastBackup: { at: string; latestMigration: string | null; dumpBytes: number | null } | null;
      /** How many complete backups are kept (14 days' worth). */
      count: number;
      /** The newest drill: when, which backup, the verdict and the runner's one line. */
      lastDrill: { at: string; backup: string; verdict: "passed" | "failed" | "error"; line: string } | null;
    };

/** The backups and the drill, as the runner left them. Never throws. */
export function readBackupStatus(env: NodeJS.ProcessEnv = process.env): BackupStatus {
  try {
    const { root, why } = backupRoot(env);
    if (!root) return { reachable: false, why };
    if (!fs.existsSync(root)) return { reachable: false, why: `${root} does not exist on this machine` };
    const backups = listBackups(root);
    const newest = backups[0] ?? null;
    let dumpBytes: number | null = null;
    if (newest) {
      try {
        const m = JSON.parse(fs.readFileSync(path.join(newest.dir, MANIFEST_FILE), "utf8")) as { dump?: { size?: unknown } };
        dumpBytes = typeof m.dump?.size === "number" ? m.dump.size : null;
      } catch {
        dumpBytes = null;
      }
    }
    const drills = readDrillLog(root);
    const last = drills.length > 0 ? drills[drills.length - 1] : null;
    return {
      reachable: true,
      lastBackup: newest ? { at: newest.at.toISOString(), latestMigration: newest.latestMigration, dumpBytes } : null,
      count: backups.length,
      lastDrill: last ? { at: last.at, backup: last.backup, verdict: last.verdict, line: last.line } : null,
    };
  } catch (err) {
    return { reachable: false, why: err instanceof Error ? err.message : String(err) };
  }
}

export type EnvironmentName = "DEV" | "UAT" | "VERCEL";

/** The three places #38.22 named: Ciprian's box (no sign-in), Vercel, and Adrian's laptop. */
export function environmentName(env: NodeJS.ProcessEnv = process.env): EnvironmentName {
  if (isUatNoAuth()) return "UAT";
  if (env.VERCEL === "1") return "VERCEL";
  return "DEV";
}

/** DATABASE_URL's host and database name — and nothing else of it. */
export function databaseOf(url: string | undefined): { host: string; name: string } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const name = decodeURIComponent(u.pathname.replace(/^\//, ""));
    return { host: u.port ? `${u.hostname}:${u.port}` : u.hostname, name: name || "—" };
  } catch {
    return null;
  }
}

/** The commit this build runs: Vercel's variable, else the repository's HEAD, else null. */
export function currentCommit(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): string | null {
  const fromEnv = env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    const gitDir = path.join(cwd, ".git");
    const head = fs.readFileSync(path.join(gitDir, "HEAD"), "utf8").trim();
    if (!head.startsWith("ref: ")) return head.slice(0, 7);
    const ref = head.slice(5);
    const loose = path.join(gitDir, ref);
    if (fs.existsSync(loose)) return fs.readFileSync(loose, "utf8").trim().slice(0, 7);
    const packed = fs.readFileSync(path.join(gitDir, "packed-refs"), "utf8");
    const line = packed.split("\n").find((l) => l.endsWith(` ${ref}`));
    return line ? line.slice(0, 7) : null;
  } catch {
    return null;
  }
}

export type SystemStatus = {
  backups: BackupStatus;
  /**
   * `paidReads` is this month's successful reads and when counting began
   * (migration_100) — added by the route, which can await the database; null
   * when the count could not be read.
   */
  ai: { models: AiModelUse[]; paidReads?: { count: number; since: string | null } | null };
  about: {
    version: string;
    commit: string | null;
    environment: EnvironmentName;
    database: { host: string; name: string } | null;
  };
};

export function readSystemStatus(version: string, env: NodeJS.ProcessEnv = process.env): SystemStatus {
  return {
    backups: readBackupStatus(env),
    ai: { models: aiModelsInUse(env) },
    about: {
      version,
      commit: currentCommit(env),
      environment: environmentName(env),
      database: databaseOf(env.DATABASE_URL),
    },
  };
}
