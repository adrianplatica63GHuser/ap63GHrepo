/**
 * scripts/backup/state.ts                  (Slice #37.11, FU-006)
 *
 * Where the backups are, and what is in that folder — read-only, and cheap
 * enough for the test runner to call on every idle check. Shared by
 * `scripts/backup/archive.ts` (which writes the folder) and
 * `scripts/test-runner/runner.ts` (which decides from it when to back up on its
 * own). Nothing here spawns a process or writes a file.
 */
import fs from "fs";
import path from "path";

import { BACKUP_DIR_NAME, DRILL_LOG_FILE, MANIFEST_FILE, parseBackupFolderName } from "./rules";

/**
 * The folder that holds every backup: `%OneDrive%\ga40prj-backups` (decision 2),
 * or `GA40_BACKUP_ROOT` when that is set to an absolute path — the one way to
 * point it somewhere else (an external disk) without editing code.
 * `OneDrive` is what the OneDrive client sets for the signed-in user;
 * `OneDriveConsumer` / `OneDriveCommercial` are its per-account twins.
 */
export function backupRoot(env: NodeJS.ProcessEnv = process.env): { root: string | null; why: string } {
  const override = env.GA40_BACKUP_ROOT?.trim();
  if (override) {
    return path.isAbsolute(override)
      ? { root: override, why: "GA40_BACKUP_ROOT" }
      : { root: null, why: `GA40_BACKUP_ROOT is set but not absolute (${override})` };
  }
  for (const key of ["OneDrive", "OneDriveConsumer", "OneDriveCommercial"] as const) {
    const v = env[key]?.trim();
    if (v && fs.existsSync(v)) return { root: path.join(v, BACKUP_DIR_NAME), why: `%${key}%` };
  }
  return {
    root: null,
    why: "OneDrive is not set up for this Windows user (no %OneDrive% folder); set GA40_BACKUP_ROOT to an absolute path to use another place",
  };
}

export interface BackupEntry {
  name: string;
  dir: string;
  at: Date;
  latestMigration: string | null;
}

/** Every complete backup under the root — a folder with a backup's name AND a manifest — newest first. */
export function listBackups(root: string): BackupEntry[] {
  let names: string[] = [];
  try {
    names = fs.readdirSync(root);
  } catch {
    return [];
  }
  const out: BackupEntry[] = [];
  for (const name of names) {
    const at = parseBackupFolderName(name);
    if (!at) continue;
    const dir = path.join(root, name);
    const mf = path.join(dir, MANIFEST_FILE);
    if (!fs.existsSync(mf)) continue;
    let latestMigration: string | null = null;
    try {
      const m = JSON.parse(fs.readFileSync(mf, "utf8")) as { latestMigration?: unknown };
      latestMigration = typeof m.latestMigration === "string" ? m.latestMigration : null;
    } catch {
      continue; // an unreadable manifest is not a backup the drill could use
    }
    out.push({ name, dir, at, latestMigration });
  }
  return out.sort((a, b) => b.at.getTime() - a.at.getTime());
}

export interface DrillLogEntry {
  at: string;
  backup: string;
  verdict: "passed" | "failed" | "error";
  latestMigration: string | null;
  resultId: string | null;
  line: string;
}

/** `drills.json` under the root: every drill so far, oldest first. Missing or unreadable reads as none. */
export function readDrillLog(root: string): DrillLogEntry[] {
  try {
    const x = JSON.parse(fs.readFileSync(path.join(root, DRILL_LOG_FILE), "utf8")) as unknown;
    return Array.isArray(x) ? (x as DrillLogEntry[]) : [];
  } catch {
    return [];
  }
}
