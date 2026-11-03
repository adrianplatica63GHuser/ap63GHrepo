/**
 * Slice 41.62 — supabase:sync leaves the migration record filled.
 *
 * Adrian's supabase:migrate stopped right after a supabase:sync with „STOPPING -- schema_migrations is EMPTY, but this
 * project already holds 61 table(s) … npm run supabase:migrate -- --baseline 086": the sync rebuilt the schema from a
 * file that creates the record empty, and never wrote it. So the sync copies the local record, after three guards; and
 * migrate's advice names the newest migration on disk, not 086.
 */
import fs from "node:fs";
import path from "node:path";

import {
  planSyncRecord,
  schemaFileNewest,
  suggestedBaseline,
  type DiskMigration,
  type LocalRecordRow,
} from "../../scripts/migration-state";

const ROOT = process.cwd();
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

const disk = (...names: string[]): DiskMigration[] =>
  names.map((name) => ({ name, fullPath: `/x/${name}`, number: Number(/^migration_(\d{3})_/.exec(name)![1]), checksum: "ABC" }));
const row = (filename: string, checksum: string | null = null): LocalRecordRow => ({ filename, checksum, appliedAt: "2026-11-01T00:00:00Z" });
const header = (n: number, newest: string) => `-- Generated : 2026-11-03 06:00\n-- Migrations : ${n}, newest ${newest}\n-- Source    : x\n`;

const A = "migration_008_a.sql";
const B = "migration_125_b.sql";
const C = "migration_126_c.sql";

describe("the record the sync copies (41.62, Ask first 1–3)", () => {
  it("every file applied and the schema file current: the local rows, checksums as stored (NULL kept)", () => {
    const plan = planSyncRecord(disk(A, B, C), [row(C, "D3"), row(A), row(B, "B2")], header(3, C));
    expect(plan).toEqual({ ok: true, headerMissing: false, rows: [row(A), row(B, "B2"), row(C, "D3")] });
  });

  it("one file on disk not applied locally: stop, naming it", () => {
    expect(planSyncRecord(disk(A, B, C), [row(A), row(B)], header(2, B))).toEqual({ ok: false, unapplied: [C], orphans: [], stale: null });
  });

  it("a local row with no file on disk: stop, naming it", () => {
    expect(planSyncRecord(disk(A, C), [row(A), row(B), row(C)], header(3, C))).toMatchObject({ ok: false, orphans: [B] });
  });

  it("a schema file exported before the newest migration: stop — regenerate it", () => {
    expect(planSyncRecord(disk(A, B, C), [row(A), row(B), row(C)], header(2, B))).toEqual({
      ok: false,
      unapplied: [],
      orphans: [],
      stale: { file: B, local: C },
    });
  });

  it("a schema file with no „-- Migrations” line (before 41.62): not refused, and said so", () => {
    const plan = planSyncRecord(disk(A, C), [row(A), row(C)], "-- Generated : 2026-11-02 22:14\n");
    expect(plan).toMatchObject({ ok: true, headerMissing: true });
  });

  it("the header line is read back exactly as Export writes it", () => {
    expect(schemaFileNewest(header(119, "migration_126_notary_link_from_issuer.sql"))).toEqual({ count: 119, newest: "migration_126_notary_link_from_issuer.sql" });
    expect(schemaFileNewest("-- Generated : x\n")).toBeNull();
    const exporter = read("scripts", "Export-SupabaseSchema.ps1");
    expect(exporter).toContain("-- Migrations : $migrationCount, newest $newestMigration");
    expect(exporter).toContain("$newestMigration = $allFiles[-1].Name");
  });
});

describe("the sync's wiring (41.62)", () => {
  const sync = read("scripts", "supabase-sync.ts");
  it("checks before anything is dropped, and records right after the schema is rebuilt", () => {
    const check = sync.indexOf("const plan = planSyncRecord(disk, localRecord, schemaSql);");
    const drop = sync.indexOf('await execFile(supaPool, "src/db/supabase_reset.sql");');
    const schema = sync.indexOf('await execFile(supaPool, "src/db/supabase_schema_full.sql");');
    const record = sync.indexOf("INSERT INTO schema_migrations (filename, applied_at, checksum)");
    const reference = sync.indexOf('step(4, TOTAL, "Syncing reference data from Docker to Supabase...");');
    expect([check > 0, check < drop, drop < schema, schema < record, record < reference]).toEqual([true, true, true, true, true]);
    expect(sync).toMatch(/if \(!plan\.ok\) \{[\s\S]*?process\.exitCode = 2;\s*return;\s*\}/);
    expect(sync).toContain("const TOTAL = 6;");
  });
});

describe("migrate's advice on an empty record (41.62, Ask first 4)", () => {
  it("is the newest migration number on disk, three digits — never a hard-coded 086", () => {
    expect(suggestedBaseline(disk(A, B, C))).toBe("126");
    expect(suggestedBaseline(disk("migration_009_x.sql"))).toBe("009");
    const migrate = read("scripts", "supabase-migrate.ts");
    expect(migrate).not.toContain("log(`npm run supabase:migrate -- --baseline 086`);");
    expect(migrate.match(/log\(`npm run supabase:migrate -- --baseline \$\{suggestedBaseline\(disk\)\}`\);/g)).toHaveLength(2);
  });
});
