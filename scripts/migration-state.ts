/**
 * migration-state.ts
 *
 * The comparison of `src\db\migration_*.sql` against a `schema_migrations`
 * table, with no database and no printing in it.
 *
 * ⚠️ **THIS IS THE TYPESCRIPT TWIN OF `scripts\MigrationState.ps1`, AND THE
 * DUPLICATION IS DELIBERATE.** That file is dot-sourced by
 * `Apply-Migration.ps1` and `build-ciprian-image.ps1`, both of which are
 * PowerShell talking to a Docker container through `docker exec psql`. This
 * one is imported by `scripts\supabase-migrate.ts`, which is Node talking to
 * Supabase over TLS through `pg`. There is no runtime the two share, so a
 * single source would mean one of them shelling out to the other -- a
 * PowerShell dependency inside a cloud deploy path, or a Node dependency
 * inside the image build. The bucketing is ~80 lines; a shell-out between
 * language runtimes to avoid copying it is the more expensive mistake.
 *
 * What is NOT duplicated is the contract, and that is what
 * `src\__tests__\supabase-migration-state.test.ts` pins:
 *
 *   * the checksum is MD5 of the file's RAW BYTES in UPPER-CASE hex, which is
 *     what `Get-FileHash -Algorithm MD5` produces. Both runners write into the
 *     same shaped table, and a slice that regenerates a database from the
 *     other side must not make every row look CHANGED.
 *   * a NULL / empty stored checksum is UNKNOWN, never CHANGED. Two different
 *     facts, two different sentences.
 *   * `filename` is a case-SENSITIVE primary key in Postgres and a
 *     case-INSENSITIVE lookup on Windows. Every place those disagree is
 *     reported rather than normalised away.
 *
 * ⚠️ **NOTHING HERE PRINTS, NOTHING HERE EXITS, NOTHING HERE OPENS A
 * CONNECTION.** Same reason as the PowerShell file: the caller decides what a
 * bucket means, and every function stays testable without a database.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * `migration_086_document_reference_direction.sql` -> number 86.
 *
 * Three digits, always: the repository has held that shape since
 * migration_008 and `--baseline` reads the number out of the NAME rather than
 * out of a separate index, so a two-digit file would silently sort and
 * baseline wrong. A name that does not match is not a migration and is
 * skipped -- `seed_dev_data.sql`, `supabase_reset.sql` and the rest of
 * `src\db` live in the same folder.
 */
export const MIGRATION_FILE_RE = /^migration_(\d{3})_.+\.sql$/;

export interface DiskMigration {
  /** File name only, e.g. `migration_086_document_reference_direction.sql`. */
  name: string;
  /** Absolute path. */
  fullPath: string;
  /** The three-digit prefix as a number, e.g. 86. */
  number: number;
  /** MD5 of the raw bytes, upper-case hex. */
  checksum: string;
}

/**
 * MD5 of raw bytes in UPPER-CASE hex -- byte-for-byte what PowerShell's
 * `Get-FileHash -Algorithm MD5` writes into `schema_migrations.checksum`.
 *
 * ⚠️ **A BUFFER, NOT A STRING.** Reading the file as UTF-8 first and hashing
 * that would drop a BOM and, on a checkout with `core.autocrlf` doing
 * anything, could renormalise line endings -- either of which changes the
 * hash. The local runner hashes bytes; so does this.
 */
export function hashMigration(bytes: Buffer): string {
  return crypto.createHash("md5").update(bytes).digest("hex").toUpperCase();
}

/**
 * Enumerate the migrations folder ONCE and hash every file.
 *
 * Throws rather than returning an empty list for a folder that is missing or
 * holds no migrations. `Get-MigrationFilesOnDisk` carries the same guard and
 * the same reason: an unreadable folder used to end a run at "up to date,
 * nothing to do", exit 0, with every recorded row filed under NO FILE.
 */
export function readMigrationsOnDisk(migrationsDir: string): DiskMigration[] {
  if (!fs.existsSync(migrationsDir) || !fs.statSync(migrationsDir).isDirectory()) {
    throw new Error(`Migrations folder not found: ${migrationsDir}`);
  }

  const files = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isFile() && MIGRATION_FILE_RE.test(e.name))
    .map((e) => e.name)
    .sort();

  if (files.length === 0) {
    throw new Error(
      `No migration_*.sql found in ${migrationsDir}. Either the folder is empty or it cannot be read; a database with recorded migrations and no files on disk is not a state to call up to date.`,
    );
  }

  return files.map((name) => {
    const fullPath = path.join(migrationsDir, name);
    const bytes = fs.readFileSync(fullPath);
    const m = MIGRATION_FILE_RE.exec(name);
    return {
      name,
      fullPath,
      number: Number(m![1]),
      checksum: hashMigration(bytes),
    };
  });
}

/** One row of `schema_migrations`, checksum "" where the column is NULL. */
export interface AppliedRow {
  filename: string;
  checksum: string;
}

export interface MigrationState {
  /** Recorded, and the file on disk no longer hashes to what was stored. */
  changed: { name: string; stored: string; actual: string }[];
  /** Recorded with no checksum -- nothing to compare. Not a mismatch. */
  unknown: string[];
  /** Recorded, and no file of that name. `nowCalled` names an UNRECORDED file carrying the stored hash, i.e. a rename. */
  absent: { name: string; nowCalled: string | null }[];
  /** Recorded under a spelling the file does not have. */
  miscased: { recorded: string; onDisk: string }[];
  /** On disk, with no row. */
  pending: DiskMigration[];
  /** Rows that had something to compare. */
  comparable: number;
  /** Filenames recorded twice differing only in case. Postgres allows it; Windows cannot tell them apart. */
  duplicateNames: string[];
}

/**
 * The buckets. Pure: two inputs, one report, no opinion about what to do.
 *
 * ⚠️ A RENAME IS NOT A MISSING FILE. The same SQL is still on disk under a new
 * name, so it looks pending and would be applied a SECOND time -- and most of
 * these files are not idempotent. The stored hash identifies it exactly, which
 * is why `nowCalled` is a report and not a guess, and why only an UNRECORDED
 * twin counts: a file that already has its own row is not somewhere this
 * migration "went".
 */
export function compareMigrationState(
  disk: DiskMigration[],
  appliedRows: AppliedRow[],
): MigrationState {
  const byName = new Map<string, DiskMigration>();
  const byLowerName = new Map<string, DiskMigration>();
  const byHash = new Map<string, string[]>();
  for (const f of disk) {
    byName.set(f.name, f);
    byLowerName.set(f.name.toLowerCase(), f);
    byHash.set(f.checksum, [...(byHash.get(f.checksum) ?? []), f.name]);
  }

  // Postgres keys `filename` case-sensitively, so two rows CAN differ only in
  // case; a JS Map is case-sensitive too and would keep both, which is why the
  // collision is detected explicitly instead of being discovered as a missing
  // file later.
  const seenLower = new Map<string, string>();
  const duplicateNames: string[] = [];
  const applied = new Map<string, string>();
  for (const row of appliedRows) {
    const lower = row.filename.toLowerCase();
    if (seenLower.has(lower) && seenLower.get(lower) !== row.filename) {
      duplicateNames.push(row.filename);
    }
    seenLower.set(lower, row.filename);
    applied.set(row.filename, row.checksum ?? "");
  }

  const changed: MigrationState["changed"] = [];
  const unknown: string[] = [];
  const absent: MigrationState["absent"] = [];
  const miscased: MigrationState["miscased"] = [];

  for (const name of [...applied.keys()].sort()) {
    const stored = applied.get(name)!;
    const exact = byName.get(name);

    if (!exact) {
      const insensitive = byLowerName.get(name.toLowerCase());
      if (insensitive) {
        // Same file, different spelling. The real file is NOT recorded, and
        // Windows's case-insensitive lookup is what hides that: left alone the
        // pending test below reports the migration as applied and never runs it.
        miscased.push({ recorded: name, onDisk: insensitive.name });
        continue;
      }
      const twins = (byHash.get(stored) ?? []).filter((n) => !applied.has(n));
      absent.push({ name, nowCalled: stored !== "" && twins.length > 0 ? twins.join(", ") : null });
      continue;
    }

    if (stored === "") {
      unknown.push(name);
      continue;
    }

    // Case-insensitive compare: `Get-FileHash` returns upper-case hex, a row
    // re-recorded by hand may not, and the two are the same checksum.
    if (stored.toUpperCase() !== exact.checksum.toUpperCase()) {
      changed.push({ name, stored, actual: exact.checksum });
    }
  }

  const pending = disk.filter((f) => !applied.has(f.name));

  return {
    changed,
    unknown,
    absent,
    miscased,
    pending,
    comparable: applied.size - unknown.length - absent.length - miscased.length,
    duplicateNames,
  };
}

/**
 * Read a `--baseline` argument. Accepts `86`, `086` or a whole filename, so
 * pasting the name out of a handover works.
 *
 * Returns the migration NUMBER, never a filename: `src\db` holds three files
 * numbered 035 and two numbered 013, and a baseline that stopped at one of
 * them would leave its twins pending and apply them against a schema that
 * already has them.
 */
export function parseBaselineArg(arg: string): number {
  const trimmed = arg.trim();
  const fromName = MIGRATION_FILE_RE.exec(trimmed);
  if (fromName) return Number(fromName[1]);
  if (/^\d{1,3}$/.test(trimmed)) return Number(trimmed);
  throw new Error(
    `--baseline takes a migration number or file name, e.g. --baseline 086 or --baseline migration_086_document_reference_direction.sql. Got: ${arg}`,
  );
}

/** Every migration whose number is at or below the baseline -- all twins of a repeated number included. */
export function selectBaseline(disk: DiskMigration[], through: number): DiskMigration[] {
  return disk.filter((f) => f.number <= through);
}

/**
 * `--reapply NNN`: the one file to run again, or why not.   (Slices #37.59, #37.63)
 *
 * ⚠️ **AN UNVERIFIED ROW IS AN EMPTY STRING HERE, NOT `null`.** The runner
 * reads `coalesce(checksum, '')` (see `AppliedRow`), so a baseline row arrives
 * as "". #37.59 tested `checksum !== null` inline in supabase-migrate.ts, which
 * is true for EVERY row — and refused 084 as „recorded WITH a checksum" on
 * Adrian's first try (2026-10-03), though `Checksum match` on the same screen
 * counted it among the 82 unknown. Pure, so the rule is held by a test.
 */
export function reapplyTarget(
  disk: DiskMigration[],
  appliedRows: AppliedRow[],
  number: number,
): { target: DiskMigration } | { refusal: string } {
  const files = disk.filter((f) => f.number === number);
  if (files.length !== 1) {
    return { refusal: `${files.length} migration file(s) on disk are numbered ${number}; --reapply runs exactly one. Nothing run.` };
  }
  const target = files[0];
  const row = appliedRows.find((r) => r.filename === target.name);
  if (!row) {
    return { refusal: `${target.name} is not recorded here, so it is simply pending -- run without --reapply.` };
  }
  if ((row.checksum ?? "") !== "") {
    return { refusal: `${target.name} is recorded WITH a checksum, so it verifiably ran here. Nothing run.` };
  }
  return { target };
}

// ---------------------------------------------------------------------------
// Slice 41.62 — supabase:sync leaves the migration record filled
// ---------------------------------------------------------------------------
//
// Adrian's supabase:migrate stopped on 2026-11-01 with „schema_migrations is EMPTY, but this project already holds 61
// table(s)", right after a supabase:sync: the sync drops everything, rebuilds from supabase_schema_full.sql — which
// creates schema_migrations EMPTY — and never wrote it. So the sync now copies the LOCAL record into Supabase's, rows
// and checksums as stored: the record of what actually built the schema the file was exported from, never a claim
// made from the files on disk. Before anything is dropped, three guards (Ask first 2, 3).

/** A row of the local `schema_migrations`, checksum `null` where the column is NULL. */
export interface LocalRecordRow {
  filename: string;
  checksum: string | null;
  appliedAt: Date | string | null;
}

/** The line Export-SupabaseSchema.ps1 writes into the schema file's header (Ask first 3). */
export const SCHEMA_MIGRATIONS_LINE_RE = /^-- Migrations\s*:\s*(\d+), newest (migration_\d{3}_\S+\.sql)\s*$/m;

/** The newest migration the schema file says it was exported with, or null when it carries no such line. */
export function schemaFileNewest(sql: string): { count: number; newest: string } | null {
  const m = SCHEMA_MIGRATIONS_LINE_RE.exec(sql);
  return m ? { count: Number(m[1]), newest: m[2] } : null;
}

export type SyncRecordPlan =
  | { ok: true; rows: LocalRecordRow[]; headerMissing: boolean }
  | { ok: false; unapplied: string[]; orphans: string[]; stale: { file: string; local: string } | null };

/**
 * What the sync writes into Supabase's `schema_migrations`, or why it must stop first:
 *  - `unapplied` — a migration on disk the local database never recorded (run migrate-local / Apply-Migration);
 *  - `orphans`   — a local row naming no file on disk (a file renamed or deleted after it was applied);
 *  - `stale`     — the schema file names a newest migration other than the local record's (regenerate it).
 * A schema file with no „-- Migrations" line (exported before 41.62) is not refused — `headerMissing` says so, and
 * the next migrate-local writes the line.
 */
export function planSyncRecord(disk: readonly DiskMigration[], local: readonly LocalRecordRow[], schemaSql: string): SyncRecordPlan {
  const recorded = new Set(local.map((r) => r.filename));
  const onDisk = new Set(disk.map((d) => d.name));
  const unapplied = disk.map((d) => d.name).filter((n) => !recorded.has(n));
  const orphans = local.map((r) => r.filename).filter((n) => !onDisk.has(n)).sort();
  const header = schemaFileNewest(schemaSql);
  const newestLocal = [...recorded].sort().at(-1) ?? "";
  const stale = header && header.newest !== newestLocal ? { file: header.newest, local: newestLocal } : null;
  if (unapplied.length || orphans.length || stale) return { ok: false, unapplied, orphans, stale };
  const rows = [...local].sort((a, b) => a.filename.localeCompare(b.filename));
  return { ok: true, rows, headerMissing: header === null };
}

/**
 * The baseline to advise when a project's record is empty (Ask first 4): the newest migration number on disk, three
 * digits — it was a hard-coded „086" until 41.62, which by then was 37 migrations short.
 */
export function suggestedBaseline(disk: readonly DiskMigration[]): string {
  const newest = disk.reduce((m, d) => Math.max(m, d.number), 0);
  return String(newest).padStart(3, "0");
}
