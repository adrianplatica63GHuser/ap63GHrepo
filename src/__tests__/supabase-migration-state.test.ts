/**
 * The contract `scripts\supabase-migrate.ts` shares with
 * `scripts\Apply-Migration.ps1`, pinned where it can be run without a database.
 *
 * `scripts\migration-state.ts` is a deliberate TypeScript twin of
 * `scripts\MigrationState.ps1` -- two language runtimes, no shared source (the
 * header of the .ts file argues that at length). What keeps them honest is the
 * CONTRACT rather than the code, and these are the parts of it that a wrong
 * answer would make expensive:
 *
 *   * the checksum is MD5 of RAW BYTES in UPPER-CASE hex, so a row written by
 *     either runner is comparable by the other;
 *   * an empty stored checksum is UNKNOWN, never CHANGED;
 *   * a recorded name with no file, whose hash matches an UNRECORDED file, is
 *     a RENAME -- the single case that makes a runner re-apply a
 *     non-idempotent migration;
 *   * a baseline is a NUMBER, so all three files numbered 035 move together.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";

import {
  MIGRATION_FILE_RE,
  compareMigrationState,
  hashMigration,
  parseBaselineArg,
  readMigrationsOnDisk,
  selectBaseline,
  type DiskMigration,
} from "../../scripts/migration-state";

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "db");

function fakeDisk(entries: [string, string][]): DiskMigration[] {
  return entries.map(([name, checksum]) => ({
    name,
    fullPath: `/fake/${name}`,
    number: Number(MIGRATION_FILE_RE.exec(name)![1]),
    checksum,
  }));
}

describe("hashMigration", () => {
  it("is MD5 of the raw bytes in upper-case hex, which is what Get-FileHash writes", () => {
    const bytes = Buffer.from("SELECT 1;\r\n", "utf-8");
    const expected = crypto.createHash("md5").update(bytes).digest("hex").toUpperCase();

    expect(hashMigration(bytes)).toBe(expected);
    expect(hashMigration(bytes)).toMatch(/^[0-9A-F]{32}$/);
  });

  it("distinguishes CRLF from LF, because the local runner hashes bytes too", () => {
    expect(hashMigration(Buffer.from("SELECT 1;\n"))).not.toBe(
      hashMigration(Buffer.from("SELECT 1;\r\n")),
    );
  });
});

describe("readMigrationsOnDisk against the real src/db", () => {
  const disk = readMigrationsOnDisk(MIGRATIONS_DIR);

  it("finds the migration chain and nothing else in that folder", () => {
    expect(disk.length).toBeGreaterThan(80);
    for (const f of disk) {
      expect(f.name).toMatch(MIGRATION_FILE_RE);
      expect(f.checksum).toMatch(/^[0-9A-F]{32}$/);
    }
    // src/db also holds seed_dev_data.sql, supabase_reset.sql and friends.
    expect(disk.map((f) => f.name)).not.toContain("seed_dev_data.sql");
    expect(disk.map((f) => f.name)).not.toContain("supabase_schema_full.sql");
  });

  it("is sorted, so the apply order is the migration order", () => {
    const names = disk.map((f) => f.name);
    expect(names).toEqual([...names].sort());
  });

  it("hashes the real bytes of each file", () => {
    const first = disk[0];
    expect(first.checksum).toBe(hashMigration(fs.readFileSync(first.fullPath)));
  });

  it("throws rather than reporting an empty chain for a folder it cannot read", () => {
    expect(() => readMigrationsOnDisk(path.join(MIGRATIONS_DIR, "no-such-folder"))).toThrow(
      /Migrations folder not found/,
    );
    expect(() => readMigrationsOnDisk(path.resolve(__dirname))).toThrow(/No migration_\*\.sql found/);
  });
});

describe("compareMigrationState", () => {
  const disk = fakeDisk([
    ["migration_008_a.sql", "AAAA0000AAAA0000AAAA0000AAAA0000"],
    ["migration_009_b.sql", "BBBB0000BBBB0000BBBB0000BBBB0000"],
    ["migration_010_c.sql", "CCCC0000CCCC0000CCCC0000CCCC0000"],
  ]);

  it("calls a file with no row pending, and one that matches neither changed nor pending", () => {
    const state = compareMigrationState(disk, [
      { filename: "migration_008_a.sql", checksum: "AAAA0000AAAA0000AAAA0000AAAA0000" },
    ]);

    expect(state.pending.map((f) => f.name)).toEqual(["migration_009_b.sql", "migration_010_c.sql"]);
    expect(state.changed).toEqual([]);
    expect(state.comparable).toBe(1);
  });

  it("reads an empty stored checksum as UNKNOWN, never as CHANGED", () => {
    const state = compareMigrationState(disk, [{ filename: "migration_008_a.sql", checksum: "" }]);

    expect(state.unknown).toEqual(["migration_008_a.sql"]);
    expect(state.changed).toEqual([]);
    expect(state.comparable).toBe(0);
  });

  it("reports a file edited since it was applied as CHANGED", () => {
    const state = compareMigrationState(disk, [
      { filename: "migration_008_a.sql", checksum: "DEAD0000DEAD0000DEAD0000DEAD0000" },
    ]);

    expect(state.changed).toEqual([
      {
        name: "migration_008_a.sql",
        stored: "DEAD0000DEAD0000DEAD0000DEAD0000",
        actual: "AAAA0000AAAA0000AAAA0000AAAA0000",
      },
    ]);
  });

  it("accepts a hash re-recorded by hand in lower case", () => {
    const state = compareMigrationState(disk, [
      { filename: "migration_008_a.sql", checksum: "aaaa0000aaaa0000aaaa0000aaaa0000" },
    ]);

    expect(state.changed).toEqual([]);
  });

  it("names the file a recorded-but-absent migration was RENAMED to", () => {
    // 009's row, 009's hash, but the file on disk is now called 010 -- so 010
    // looks pending and applying it would re-run SQL the database has.
    const renamedDisk = fakeDisk([
      ["migration_008_a.sql", "AAAA0000AAAA0000AAAA0000AAAA0000"],
      ["migration_010_c.sql", "BBBB0000BBBB0000BBBB0000BBBB0000"],
    ]);
    const state = compareMigrationState(renamedDisk, [
      { filename: "migration_009_b.sql", checksum: "BBBB0000BBBB0000BBBB0000BBBB0000" },
    ]);

    expect(state.absent).toEqual([{ name: "migration_009_b.sql", nowCalled: "migration_010_c.sql" }]);
    expect(state.pending.map((f) => f.name)).toContain("migration_010_c.sql");
  });

  it("does not call a file with its own row somewhere a migration went", () => {
    // Two byte-identical migrations, both recorded. Nothing is at risk, and
    // calling this a rename produces a repair that fails on the primary key.
    const twinDisk = fakeDisk([
      ["migration_008_a.sql", "AAAA0000AAAA0000AAAA0000AAAA0000"],
      ["migration_009_b.sql", "AAAA0000AAAA0000AAAA0000AAAA0000"],
    ]);
    const state = compareMigrationState(twinDisk, [
      { filename: "migration_008_a.sql", checksum: "AAAA0000AAAA0000AAAA0000AAAA0000" },
      { filename: "migration_009_b.sql", checksum: "AAAA0000AAAA0000AAAA0000AAAA0000" },
      { filename: "migration_007_gone.sql", checksum: "AAAA0000AAAA0000AAAA0000AAAA0000" },
    ]);

    expect(state.absent).toEqual([{ name: "migration_007_gone.sql", nowCalled: null }]);
  });

  it("reports a row recorded in the wrong case instead of treating it as applied", () => {
    const state = compareMigrationState(disk, [
      { filename: "MIGRATION_008_A.sql", checksum: "AAAA0000AAAA0000AAAA0000AAAA0000" },
    ]);

    expect(state.miscased).toEqual([
      { recorded: "MIGRATION_008_A.sql", onDisk: "migration_008_a.sql" },
    ]);
    // The real file is NOT recorded, so it is still pending.
    expect(state.pending.map((f) => f.name)).toContain("migration_008_a.sql");
    expect(state.absent).toEqual([]);
  });

  it("reports two rows differing only in case rather than collapsing them", () => {
    const state = compareMigrationState(disk, [
      { filename: "migration_008_a.sql", checksum: "AAAA0000AAAA0000AAAA0000AAAA0000" },
      { filename: "Migration_008_A.sql", checksum: "AAAA0000AAAA0000AAAA0000AAAA0000" },
    ]);

    expect(state.duplicateNames.length).toBeGreaterThan(0);
  });
});

describe("baseline selection", () => {
  it("takes a number, a zero-padded number or a whole filename", () => {
    expect(parseBaselineArg("86")).toBe(86);
    expect(parseBaselineArg("086")).toBe(86);
    expect(parseBaselineArg(" 086 ")).toBe(86);
    expect(parseBaselineArg("migration_086_document_reference_direction.sql")).toBe(86);
  });

  it("refuses anything else rather than baselining a number it guessed", () => {
    expect(() => parseBaselineArg("latest")).toThrow(/--baseline takes a migration number/);
    expect(() => parseBaselineArg("")).toThrow();
  });

  it("moves every twin of a repeated number together", () => {
    const disk = readMigrationsOnDisk(MIGRATIONS_DIR);
    const through35 = selectBaseline(disk, 35).map((f) => f.name);

    // src/db holds four files numbered 035; a baseline that stopped inside
    // that group would leave its twins pending against a schema that has them.
    expect(through35.filter((n) => n.startsWith("migration_035_")).length).toBe(
      disk.filter((f) => f.number === 35).length,
    );
    expect(through35.every((n) => Number(MIGRATION_FILE_RE.exec(n)![1]) <= 35)).toBe(true);
    expect(through35).not.toContain("migration_036_natural_person_physical_type.sql");
  });

  it("includes the whole chain at the repository's current head", () => {
    const disk = readMigrationsOnDisk(MIGRATIONS_DIR);
    const head = Math.max(...disk.map((f) => f.number));

    expect(selectBaseline(disk, head).length).toBe(disk.length);
    expect(selectBaseline(disk, 7).length).toBe(0);
  });
});

describe("npm wiring", () => {
  it("exposes the cloud runner as supabase:migrate", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "..", "..", "package.json"), "utf-8"),
    ) as { scripts: Record<string, string> };

    expect(pkg.scripts["supabase:migrate"]).toContain("scripts/supabase-migrate.ts");
    // --env-file=.env, because SUPABASE_SYNC_URL lives there and nowhere else.
    expect(pkg.scripts["supabase:migrate"]).toContain("--env-file=.env");
  });
});
