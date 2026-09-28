/**
 * scripts/backup/rules.ts                  (Slice #37.11, FU-006, FU-251)
 *
 * The archive's backup and its restore drill — every decision that can be made
 * without a disk, a container or a clock. `scripts/backup/archive.ts` does the
 * I/O and calls these; `src/__tests__/archive-backup.test.ts` pins them.
 *
 * WHAT A BACKUP IS. Until this slice nothing copied the archive anywhere (FU-251,
 * found in #37.09): the rows live in the `ga40prj-postgres` container's volume
 * and the page files in `uploads\`, both only on the laptop. Adrian's decisions
 * of 2026-09-27 („YES to all recommendations!"): the laptop is the system of
 * record; a backup is a dated folder in OneDrive holding the dump, the files and
 * a manifest; the last 14 days are kept; one is taken daily and before every
 * migrate-local; the drill runs once when built, then monthly and after a
 * migration.
 *
 *   <OneDrive>\ga40prj-backups\
 *     2026-09-28T162803Z\          one backup; the name is its UTC time
 *       ga40db.dump                pg_dump -Fc of the live database
 *       uploads\document-pages\…   every page file, byte for byte
 *       manifest.json              rows per table, and every file's size and SHA-256
 *     drills.json                  every drill: when, which backup, the verdict
 *     LAST-RESULT.txt              the last backup's or drill's one line, for a glance
 *
 * WHAT THE DRILL PROVES. The newest backup is restored BESIDE the live archive —
 * a throwaway postgis container on 5434 with no volume, and the files in a
 * scratch folder — and reconciled: every table's rows against the manifest,
 * every `document_page.file_path` against a restored file, every restored file
 * against its manifest hash. Then the app is started on 3200 against the copy and
 * asked for each entity list once. Nothing is ever restored over live.
 */

// ---- constants -------------------------------------------------------------------

export const MANIFEST_FORMAT = 1 as const;
/** The folder under OneDrive that holds every backup. */
export const BACKUP_DIR_NAME = "ga40prj-backups";
export const DUMP_FILE = "ga40db.dump";
export const MANIFEST_FILE = "manifest.json";
export const UPLOADS_DIR = "uploads";
export const DRILL_LOG_FILE = "drills.json";
export const LAST_RESULT_FILE = "LAST-RESULT.txt";

/** Decision 2: keep the last fourteen days. */
export const KEEP_DAYS = 14;
const DAY_MS = 86_400_000;
/** Decision 3: one backup a day. */
export const BACKUP_EVERY_MS = DAY_MS;
/** Decision 4: the drill once a month (and after a migration — `nextAutoRun`). */
export const DRILL_EVERY_MS = 30 * DAY_MS;
/** An unattended attempt that failed is not retried sooner than this. */
export const AUTO_RETRY_MS = 6 * 3_600_000;

/** The drill's throwaway database: its own port, on loopback. Verify-Rebuild has 5433; live has 5432. */
export const DRILL_PORT = 5434;
export const DRILL_CONTAINER = "ga40prj-restore-drill";
export const DRILL_IMAGE = "postgis/postgis:16-3.4";
export const DRILL_DATABASE = "ga40db";
/** The drill's app: its own port and its own build folder. Adrian has 3000, the runner 3100. */
export const DRILL_APP_PORT = 3200;
export const DRILL_DIST_DIR = ".next/drill";
/** The entity lists the drill asks the restored app for, once each. */
export const DRILL_APP_LISTS = ["people", "judicial-persons", "properties", "documents"] as const;

// ---- the SQL the backup sends to live: SELECT only ---------------------------------

/**
 * Rows per table, as one JSON array — `[{"table":"public.person","rows":40}, …]`.
 *
 * Every ordinary table outside the system schemas, EXCEPT the ones an extension
 * owns (`pg_depend.deptype = 'e'`): `spatial_ref_sys` and the topology/tiger
 * tables are rebuilt by `CREATE EXTENSION` on restore, from whatever version of
 * PostGIS the image carries, so they are not archive and comparing them would
 * fail the drill over a PostGIS patch release. Exact counts, not `reltuples`.
 */
export const TABLE_COUNT_SQL = `SELECT coalesce(json_agg(json_build_object(
  'table', n.nspname || '.' || c.relname,
  'rows', (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', n.nspname, c.relname), false, true, '')))[1]::text::bigint
) ORDER BY n.nspname, c.relname), '[]'::json)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%'
  AND NOT EXISTS (
    SELECT 1 FROM pg_depend d
    WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e'
  );`;

/** Every page's storage key, as one JSON array. `document_page.file_path` is relative to `uploads\`. */
export const PAGE_PATHS_SQL = `SELECT coalesce(json_agg(file_path ORDER BY file_path), '[]'::json) FROM document_page;`;

/** The newest migration the database records — the schema a backup was taken under. */
export const LATEST_MIGRATION_SQL = `SELECT coalesce(max(filename), '') FROM schema_migrations;`;

// ---- folder names ------------------------------------------------------------------

const NAME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})(\d{2})(\d{2})Z$/;

/** `2026-09-28T162803Z` — sortable, UTC, and legal in a Windows path. */
export function backupFolderName(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/:/g, "");
}

/** The time a backup folder's name says, or null for anything that is not a backup's name. */
export function parseBackupFolderName(name: string): Date | null {
  const m = NAME_RE.exec(name);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) || d.toISOString() !== iso ? null : d;
}

// ---- the manifest --------------------------------------------------------------------

export interface TableCount {
  table: string;
  rows: number;
}

export interface ManifestFile {
  /** Relative to `uploads\`, forward slashes — the same shape as `document_page.file_path`. */
  path: string;
  size: number;
  sha256: string;
}

export interface Manifest {
  format: typeof MANIFEST_FORMAT;
  createdAt: string;
  source: { container: string; database: string };
  /** HEAD of the repository when the backup was taken. */
  appCommit: string | null;
  /** The newest row of `schema_migrations`: the schema this dump carries. */
  latestMigration: string | null;
  dump: { file: string; size: number; sha256: string };
  tables: TableCount[];
  files: ManifestFile[];
}

const SHA_RE = /^[0-9a-f]{64}$/;

/** A path relative to `uploads\`: forward slashes, no `..`, not absolute, no drive. */
export function isSafeRelativePath(p: string): boolean {
  return (
    p.length > 0 &&
    !p.includes("\\") &&
    !p.startsWith("/") &&
    !/^[A-Za-z]:/.test(p) &&
    p.split("/").every((seg) => seg !== "" && seg !== "." && seg !== "..")
  );
}

const isCount = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;

/**
 * Is this a manifest the drill can trust? A manifest is what a restore is
 * measured against, so a malformed one is refused rather than read around —
 * and a file path that could climb out of the restore folder is malformed.
 */
export function validateManifest(x: unknown): { ok: true; manifest: Manifest } | { ok: false; problems: string[] } {
  if (x === null || typeof x !== "object" || Array.isArray(x)) return { ok: false, problems: ["not a JSON object"] };
  const m = x as Record<string, unknown>;
  const problems: string[] = [];
  if (m.format !== MANIFEST_FORMAT) problems.push(`format is ${JSON.stringify(m.format)}, not ${MANIFEST_FORMAT}`);
  if (typeof m.createdAt !== "string" || Number.isNaN(Date.parse(m.createdAt)) || !/^\d{4}-\d{2}-\d{2}T/.test(m.createdAt)) {
    problems.push("createdAt is not an ISO time");
  }
  const src = m.source as Record<string, unknown> | undefined;
  if (!src || typeof src.container !== "string" || typeof src.database !== "string") problems.push("source is not {container, database}");
  const dump = m.dump as Record<string, unknown> | undefined;
  if (!dump || typeof dump.file !== "string" || !isCount(dump.size) || typeof dump.sha256 !== "string" || !SHA_RE.test(dump.sha256)) {
    problems.push("dump is not {file, size, sha256}");
  }
  if (!Array.isArray(m.tables)) {
    problems.push("tables is not a list");
  } else {
    const seen = new Set<string>();
    for (const t of m.tables as Record<string, unknown>[]) {
      const name = typeof t?.table === "string" ? t.table : JSON.stringify(t);
      if (typeof t?.table !== "string" || !isCount(t.rows)) problems.push(`table entry ${name} is not {table, rows ≥ 0}`);
      else if (seen.has(t.table)) problems.push(`table ${t.table} is listed twice`);
      else seen.add(t.table);
    }
  }
  if (!Array.isArray(m.files)) {
    problems.push("files is not a list");
  } else {
    const seen = new Set<string>();
    for (const f of m.files as Record<string, unknown>[]) {
      const p = typeof f?.path === "string" ? f.path : JSON.stringify(f);
      if (typeof f?.path !== "string" || !isSafeRelativePath(f.path)) problems.push(`file path ${p} is not a safe relative path`);
      else if (!isCount(f.size) || typeof f.sha256 !== "string" || !SHA_RE.test(f.sha256)) problems.push(`file ${p} has no valid size and sha256`);
      else if (seen.has(f.path)) problems.push(`file ${p} is listed twice`);
      else seen.add(f.path);
    }
  }
  if (m.appCommit !== null && typeof m.appCommit !== "string") problems.push("appCommit is not a string or null");
  if (m.latestMigration !== null && typeof m.latestMigration !== "string") problems.push("latestMigration is not a string or null");
  return problems.length > 0 ? { ok: false, problems } : { ok: true, manifest: x as Manifest };
}

// ---- comparing ---------------------------------------------------------------------

/** Table by table, in name order: `public.b: 2 → 5`, `public.c: 3 → missing`. */
export function compareCounts(before: readonly TableCount[], after: readonly TableCount[]): { equal: boolean; differences: string[] } {
  const a = new Map(before.map((t) => [t.table, t.rows]));
  const b = new Map(after.map((t) => [t.table, t.rows]));
  const names = [...new Set([...a.keys(), ...b.keys()])].sort();
  const differences: string[] = [];
  for (const n of names) {
    const x = a.get(n);
    const y = b.get(n);
    if (x !== y) differences.push(`${n}: ${x ?? "missing"} → ${y ?? "missing"}`);
  }
  return { equal: differences.length === 0, differences };
}

const norm = (p: string): string => p.replace(/\\/g, "/");
const totalRows = (t: readonly TableCount[]): number => t.reduce((s, x) => s + x.rows, 0);

export interface AppProbe {
  list: string;
  /** HTTP status, or null when there was no answer. */
  status: number | null;
  /** `total` from the list's JSON, when it had one. */
  total: number | null;
  error?: string;
}

export interface DrillObservation {
  /** The backup folder's name. */
  backup: string;
  manifest: Manifest;
  /** SHA-256 of the dump file as read at restore time. */
  dumpSha256: string;
  /** `pg_restore: error:` lines. */
  restoreErrors: string[];
  /** Rows per table in the RESTORED database. */
  restoredTables: TableCount[];
  /** Rows per table in live now, read-only — informational, or null when live could not be read. */
  liveTables: TableCount[] | null;
  /** `document_page.file_path` in the RESTORED database. */
  pagePaths: string[];
  /** What the restore folder holds, hashed after the copy. */
  restoredFiles: ManifestFile[];
  /** One GET per entity list against the restored copy, or null when the app step did not run. */
  app: AppProbe[] | null;
}

export interface DrillReport {
  verdict: "passed" | "failed";
  /** Every reason for a failure, one per line. Empty when passed. */
  problems: string[];
  /** Context that is not a failure — live having moved on, the app's totals. */
  details: string[];
  /** The one line: `PASSED — backup …: … ` (the caller prefixes `DRILL: `). */
  line: string;
}

const LIST_CAP = 10;
function capped(prefix: string, items: string[]): string[] {
  const out = items.slice(0, LIST_CAP).map((i) => `${prefix}: ${i}`);
  if (items.length > LIST_CAP) out.push(`${prefix}: … and ${items.length - LIST_CAP} more`);
  return out;
}

/**
 * ⚠️ **THE PAGES ARE PART OF THE BACKUP.** The drill fails when a
 * `document_page` row has no file, when a file has no row, when a file's hash is
 * not the one the backup recorded, when the backup lists a file that did not
 * come back or a file came back the backup never listed — and when any table's
 * rows differ from the backup's, or pg_restore reported an error, or the
 * restored app did not answer an entity list with 200.
 *
 * Live having moved on since the backup is NOT a failure: a backup is up to a
 * day old by design, so the rows restored are measured against the rows the
 * backup recorded, and live-now is reported beside them.
 */
export function reconcileDrill(o: DrillObservation): DrillReport {
  const problems: string[] = [];
  const details: string[] = [];

  if (o.dumpSha256 !== o.manifest.dump.sha256) {
    problems.push(`dump hash differs from the manifest's: the file in the backup is not the one that was written`);
  }
  if (o.restoreErrors.length > 0) {
    problems.push(`pg_restore reported ${o.restoreErrors.length} error${o.restoreErrors.length === 1 ? "" : "s"}; the first: ${o.restoreErrors[0]}`);
  }

  const rows = compareCounts(o.manifest.tables, o.restoredTables);
  problems.push(...rows.differences.map((d) => `rows: ${d}`));

  const manifestFiles = new Map(o.manifest.files.map((f) => [norm(f.path), f]));
  const restored = new Map(o.restoredFiles.map((f) => [norm(f.path), f]));
  const referenced = new Set(o.pagePaths.map(norm));

  const rowWithoutFile = [...referenced].filter((p) => !restored.has(p)).sort();
  const fileWithoutRow = [...restored.keys()].filter((p) => !referenced.has(p)).sort();
  const notRestored = [...manifestFiles.keys()].filter((p) => !restored.has(p)).sort();
  const notInBackup = [...restored.keys()].filter((p) => !manifestFiles.has(p)).sort();
  const hashDiffers = [...restored.entries()]
    .filter(([p, f]) => {
      const m = manifestFiles.get(p);
      return m !== undefined && (m.sha256 !== f.sha256 || m.size !== f.size);
    })
    .map(([p]) => p)
    .sort();

  problems.push(
    ...capped("row without a file", rowWithoutFile),
    ...capped("file without a row", fileWithoutRow),
    ...capped("hash differs", hashDiffers),
    ...capped("in the backup, not restored", notRestored),
    ...capped("restored, not in the backup", notInBackup),
  );

  let appPart = "app on 3200: not run";
  if (o.app !== null) {
    const ok = o.app.filter((a) => a.status === 200);
    for (const a of o.app) {
      if (a.status === 200) {
        if (a.total !== null) details.push(`app on 3200: ${a.list} answered 200, total ${a.total}`);
      } else {
        problems.push(`app on 3200: ${a.list}${a.status === null ? ` — ${a.error ?? "no answer"}` : ` answered ${a.status}`}`);
      }
    }
    const lists = o.app.filter((a) => a.list !== "server").length || DRILL_APP_LISTS.length;
    appPart = `app on 3200: ${ok.length}/${lists} lists answered 200`;
  } else {
    problems.push("app on 3200: the step did not run");
  }

  let livePart = "live now: not read";
  if (o.liveTables !== null) {
    const live = compareCounts(o.manifest.tables, o.liveTables);
    details.push(...live.differences.map((d) => `live since the backup: ${d}`));
    livePart = live.equal
      ? "live now: same rows"
      : `live now: ${live.differences.length} table${live.differences.length === 1 ? "" : "s"} moved since the backup`;
  }

  const sameHash = [...restored.keys()].filter((p) => manifestFiles.has(p) && !hashDiffers.includes(p)).length;
  const verdict = problems.length === 0 ? "passed" : "failed";
  const line =
    `${verdict.toUpperCase()} — backup ${o.backup}: ${o.manifest.tables.length} tables, ${totalRows(o.restoredTables)} rows restored` +
    `${rows.equal ? " = backup" : ` (${rows.differences.length} table${rows.differences.length === 1 ? "" : "s"} differ from the backup)`}; ` +
    `${sameHash}/${manifestFiles.size} files same SHA-256; ` +
    `${rowWithoutFile.length} rows without a file, ${fileWithoutRow.length} files without a row; ` +
    `${appPart}; ${livePart}`;
  return { verdict, problems, details, line };
}

// ---- the prune -----------------------------------------------------------------------

/**
 * Decision 2: keep the last fourteen days. Only names that ARE backups are
 * considered — anything else in the folder is never touched — and the newest
 * backup is always kept, however old: a laptop that was off for a month must
 * not wake up and delete its only copy.
 */
export function selectPrune(names: readonly string[], now: Date, keepDays = KEEP_DAYS): { keep: string[]; remove: string[] } {
  const backups = names
    .map((n) => ({ n, at: parseBackupFolderName(n) }))
    .filter((x): x is { n: string; at: Date } => x.at !== null)
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  const keep: string[] = [];
  const remove: string[] = [];
  backups.forEach((b, i) => {
    const young = now.getTime() - b.at.getTime() <= keepDays * DAY_MS;
    (i === 0 || young ? keep : remove).push(b.n);
  });
  return { keep, remove };
}

// ---- the runner's own schedule ---------------------------------------------------------

export type AutoRun = "backup" | "restore-drill";

export interface AutoState {
  now: Date;
  /** The newest complete backup, and the schema it was taken under. */
  newestBackup: { at: Date; latestMigration: string | null } | null;
  /** The newest drill of any verdict. */
  lastDrill: { at: Date; latestMigration: string | null } | null;
  /** `max(schema_migrations.filename)` in live now, or null when live could not be read. */
  liveLatestMigration: string | null;
  /** When the runner last started each kind on its own (this process's memory). */
  lastAttempt: Partial<Record<AutoRun, Date>>;
}

/**
 * What the runner starts on its own when it is idle, if anything.  (Decisions 3 and 4.)
 *
 *   backup         when there is none, or the newest is a day old;
 *   restore-drill  when none has run, the last is a month old, or live has had a
 *                  migration since — and then only after a backup of the new
 *                  schema exists, or the drill would restore the old one.
 *
 * „After a migration that changes a table holding archive rows" is read as
 * „after any migration": every migration here changes the schema those rows
 * sit in, and telling which ones touch archive tables is not worth a rule.
 * An attempt is not repeated within `AUTO_RETRY_MS`, so a stopped Docker costs
 * one failed run every six hours, not one per minute.
 */
export function nextAutoRun(s: AutoState): AutoRun | null {
  const t = s.now.getTime();
  const may = (k: AutoRun): boolean => {
    const at = s.lastAttempt[k];
    return at === undefined || t - at.getTime() >= AUTO_RETRY_MS;
  };
  const backupDue = s.newestBackup === null || t - s.newestBackup.at.getTime() >= BACKUP_EVERY_MS;
  if (backupDue) return may("backup") ? "backup" : null;

  const migrated =
    s.liveLatestMigration !== null && s.lastDrill !== null && s.lastDrill.latestMigration !== s.liveLatestMigration;
  const drillDue = s.lastDrill === null || t - s.lastDrill.at.getTime() >= DRILL_EVERY_MS || migrated;
  if (!drillDue) return null;
  const backupIsOld =
    s.liveLatestMigration !== null && s.newestBackup !== null && s.newestBackup.latestMigration !== s.liveLatestMigration;
  if (backupIsOld) return may("backup") ? "backup" : null;
  return may("restore-drill") ? "restore-drill" : null;
}

// ---- NOTHING RESTORED MAY ACT: the drill's app environment -------------------------------

/**
 * Keys that could reach the world — mail, the AI budget, Supabase — blanked in
 * the drill's app whether or not `.env` names them. Blank, not absent: Next's
 * env loader (@next/env) fills a key from `.env` only when the process does not
 * already have it, and an empty string counts as having it.
 */
export const DRILL_BLANKED_KEYS = [
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "ANTHROPIC_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SYNC_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

/** The key NAMES a dotenv file defines — the values are never needed and never returned. */
export function envFileKeys(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (m && !out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

/**
 * The drill app's whole environment. Every key `.env` defines is blanked, so
 * nothing of Adrian's configuration reaches the copy except what is set here:
 * the drill's own database, UAT mode (no sign-in, no Supabase), local file
 * storage, and the drill's own build folder.
 */
export function drillAppEnv(
  base: Readonly<Record<string, string | undefined>>,
  dotenvKeys: readonly string[],
  databaseUrl: string,
  distDir: string,
): Record<string, string> {
  let u: URL;
  try {
    u = new URL(databaseUrl);
  } catch {
    throw new Error("the drill's database URL does not parse");
  }
  if (!["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)) {
    throw new Error(`the drill's database must be on loopback, not ${u.hostname}`);
  }
  if (u.port !== String(DRILL_PORT)) throw new Error(`the drill's database is on port ${DRILL_PORT}, not ${u.port || "the default"}`);
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(base)) if (v !== undefined) env[k] = v;
  delete env.CI;
  for (const k of [...dotenvKeys, ...DRILL_BLANKED_KEYS]) env[k] = "";
  env.DATABASE_URL = databaseUrl;
  env.UAT_NO_AUTH = "true";
  env.LOCAL_FILE_STORAGE = "true";
  env.GA40_NEXT_DIST_DIR = distDir;
  env.FORCE_COLOR = "0";
  env.NO_COLOR = "1";
  return env;
}
