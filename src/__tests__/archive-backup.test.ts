/**
 * The archive's backup and its restore drill — the rules.   (Slice #37.11, FU-006, FU-251)
 *
 * `scripts/backup/rules.ts` decides everything about a backup and a drill that
 * can be decided without a disk, a container or a clock: what a manifest must
 * hold, what makes a restored copy „the same archive", which backups a prune
 * keeps, when the runner takes a backup or runs the drill on its own, and what
 * the drill's app may see of `.env`. `scripts/backup/archive.ts` does the I/O
 * and nothing else, so what is pinned here is what the drill actually checks.
 *
 * The header's three rules, each pinned below by name:
 *   THE LIVE DATABASE IS ONLY READ   — every SQL the backup runs on live is a SELECT.
 *   THE PAGES ARE PART OF THE BACKUP — a row with no file, a file with no row, or a
 *                                      hash that differs fails the drill.
 *   NOTHING RESTORED MAY ACT         — the drill's app has no key and no sync URL.
 */
import fs from "fs";
import path from "path";

import {
  AUTO_RETRY_MS,
  BACKUP_EVERY_MS,
  DRILL_APP_PORT,
  DRILL_BLANKED_KEYS,
  DRILL_DIST_DIR,
  DRILL_EVERY_MS,
  DRILL_PORT,
  KEEP_DAYS,
  LATEST_MIGRATION_SQL,
  MANIFEST_FORMAT,
  PAGE_PATHS_SQL,
  TABLE_COUNT_SQL,
  backupFolderName,
  compareCounts,
  drillAppEnv,
  envFileKeys,
  nextAutoRun,
  parseBackupFolderName,
  reconcileDrill,
  selectPrune,
  validateManifest,
  type DrillObservation,
  type Manifest,
} from "../../scripts/backup/rules";
import { SEQUENCES, skipReasonFor, summariseStep } from "../../scripts/test-runner/protocol";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_D = "d".repeat(64);
const P1 = "document-pages/11111111-1111-1111-1111-111111111111/p1.jpg";
const P2 = "document-pages/22222222-2222-2222-2222-222222222222/p2.pdf";

const manifest = (over: Partial<Manifest> = {}): Manifest => ({
  format: MANIFEST_FORMAT,
  createdAt: "2026-09-28T16:00:00.000Z",
  source: { container: "ga40prj-postgres", database: "ga40db" },
  appCommit: "0123456789abcdef0123456789abcdef01234567",
  latestMigration: "migration_087_property_property_direction.sql",
  dump: { file: "ga40db.dump", size: 1234, sha256: SHA_D },
  tables: [
    { table: "public.document", rows: 105 },
    { table: "public.document_page", rows: 2 },
    { table: "public.person", rows: 40 },
  ],
  files: [
    { path: P1, size: 10, sha256: SHA_A },
    { path: P2, size: 20, sha256: SHA_B },
  ],
  ...over,
});

const obs = (over: Partial<DrillObservation> = {}): DrillObservation => ({
  backup: "2026-09-28T160000Z",
  manifest: manifest(),
  dumpSha256: SHA_D,
  restoreErrors: [],
  restoredTables: manifest().tables,
  liveTables: manifest().tables,
  pagePaths: [P1, P2],
  restoredFiles: manifest().files,
  app: [
    { list: "people", status: 200, total: 40 },
    { list: "judicial-persons", status: 200, total: 3 },
    { list: "properties", status: 200, total: 13 },
    { list: "documents", status: 200, total: 105 },
  ],
  ...over,
});

describe("THE LIVE DATABASE IS ONLY READ — every query the backup sends to live", () => {
  it.each([
    ["TABLE_COUNT_SQL", TABLE_COUNT_SQL],
    ["PAGE_PATHS_SQL", PAGE_PATHS_SQL],
    ["LATEST_MIGRATION_SQL", LATEST_MIGRATION_SQL],
  ])("%s is one SELECT and writes nothing", (_name, sql) => {
    const s = sql.replace(/--.*$/gm, "").trim();
    expect(s).toMatch(/^SELECT\b/i);
    expect(s.replace(/;\s*$/, "")).not.toContain(";");
    expect(s).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|GRANT|COPY|CALL|DO)\b/i);
  });

  it("counts every table except the ones an extension owns, which CREATE EXTENSION rebuilds on its own", () => {
    expect(TABLE_COUNT_SQL).toMatch(/deptype\s*=\s*'e'/);
    expect(TABLE_COUNT_SQL).toMatch(/relkind\s*=\s*'r'/);
  });

  it("the drill's database and app ports are neither Adrian's nor the runner's", () => {
    expect(DRILL_PORT).toBe(5434);
    expect([5432, 5433]).not.toContain(DRILL_PORT);
    expect(DRILL_APP_PORT).toBe(3200);
    expect([3000, 3100]).not.toContain(DRILL_APP_PORT);
  });
});

describe("a backup folder's name is its time", () => {
  it("round-trips, in UTC, to the second", () => {
    const d = new Date("2026-09-28T16:28:03.456Z");
    const name = backupFolderName(d);
    expect(name).toBe("2026-09-28T162803Z");
    expect(parseBackupFolderName(name)?.toISOString()).toBe("2026-09-28T16:28:03.000Z");
  });

  it.each(["2026-09-28T162803Z.partial", "2026-13-28T162803Z", "notes", "drills.json", "2026-09-28"])(
    "%s is not a backup",
    (name) => {
      expect(parseBackupFolderName(name)).toBeNull();
    },
  );
});

describe("a manifest", () => {
  it("that is whole is accepted", () => {
    expect(validateManifest(manifest())).toEqual({ ok: true, manifest: manifest() });
  });

  it.each([
    ["an unknown format", { format: 2 }, "format"],
    ["no dump hash", { dump: { file: "ga40db.dump", size: 1, sha256: "xyz" } }, "dump"],
    ["a negative row count", { tables: [{ table: "public.person", rows: -1 }] }, "public.person"],
    ["a table named twice", { tables: [{ table: "public.person", rows: 1 }, { table: "public.person", rows: 1 }] }, "twice"],
    ["a file path that climbs out", { files: [{ path: "../.env", size: 1, sha256: SHA_A }] }, "../.env"],
    ["a file path with backslashes", { files: [{ path: "document-pages\\x\\p.jpg", size: 1, sha256: SHA_A }] }, "document-pages"],
    ["an absolute file path", { files: [{ path: "/etc/passwd", size: 1, sha256: SHA_A }] }, "/etc/passwd"],
    ["a file named twice", { files: [{ path: P1, size: 1, sha256: SHA_A }, { path: P1, size: 1, sha256: SHA_A }] }, "twice"],
    ["a bad file hash", { files: [{ path: P1, size: 1, sha256: "A".repeat(64) }] }, P1],
    ["no creation time", { createdAt: "yesterday" }, "createdAt"],
  ] as const)("with %s is refused, naming it", (_what, over, named) => {
    const r = validateManifest({ ...manifest(), ...over });
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.problems.join(" | ")).toContain(named);
  });

  it("that is not an object is refused", () => {
    expect(validateManifest(null).ok).toBe(false);
    expect(validateManifest([]).ok).toBe(false);
  });
});

describe("row counts, compared table by table", () => {
  it("say which table moved, and which one is missing on either side", () => {
    const a = [
      { table: "public.a", rows: 1 },
      { table: "public.b", rows: 2 },
      { table: "public.c", rows: 3 },
    ];
    const b = [
      { table: "public.a", rows: 1 },
      { table: "public.b", rows: 5 },
      { table: "public.d", rows: 0 },
    ];
    expect(compareCounts(a, b)).toEqual({
      equal: false,
      differences: ["public.b: 2 → 5", "public.c: 3 → missing", "public.d: missing → 0"],
    });
    expect(compareCounts(a, [...a].reverse())).toEqual({ equal: true, differences: [] });
  });
});

describe("the drill — what makes a restored copy the same archive", () => {
  it("passes when every row and every file is accounted for, and says so in one line", () => {
    const r = reconcileDrill(obs());
    expect(r.verdict).toBe("passed");
    expect(r.problems).toEqual([]);
    expect(r.line).toBe(
      "PASSED — backup 2026-09-28T160000Z: 3 tables, 147 rows restored = backup; 2/2 files same SHA-256; " +
        "0 rows without a file, 0 files without a row; app on 3200: 4/4 lists answered 200; live now: same rows",
    );
  });

  it("a table whose count differs from the backup fails it", () => {
    const r = reconcileDrill(obs({ restoredTables: [{ table: "public.document", rows: 104 }, ...manifest().tables.slice(1)] }));
    expect(r.verdict).toBe("failed");
    expect(r.problems).toContain("rows: public.document: 105 → 104");
  });

  it("pg_restore reporting an error fails it, even when the counts agree", () => {
    const r = reconcileDrill(obs({ restoreErrors: ['pg_restore: error: could not execute query: ERROR:  type "x" does not exist'] }));
    expect(r.verdict).toBe("failed");
    expect(r.problems[0]).toMatch(/^pg_restore reported 1 error/);
  });

  it("a dump whose hash is not the manifest's is not restored as if it were", () => {
    const r = reconcileDrill(obs({ dumpSha256: SHA_A }));
    expect(r.verdict).toBe("failed");
    expect(r.problems.join(" ")).toContain("dump");
  });

  describe("THE PAGES ARE PART OF THE BACKUP", () => {
    it("a document_page row whose file did not come back fails it", () => {
      const r = reconcileDrill(obs({ restoredFiles: [manifest().files[0]] }));
      expect(r.verdict).toBe("failed");
      expect(r.problems).toContain(`row without a file: ${P2}`);
      expect(r.problems).toContain(`in the backup, not restored: ${P2}`);
    });

    it("a file no row points at fails it", () => {
      const r = reconcileDrill(obs({ pagePaths: [P1] }));
      expect(r.verdict).toBe("failed");
      expect(r.problems).toEqual([`file without a row: ${P2}`]);
    });

    it("a file whose hash differs from the backup's fails it", () => {
      const r = reconcileDrill(obs({ restoredFiles: [manifest().files[0], { path: P2, size: 20, sha256: SHA_A }] }));
      expect(r.verdict).toBe("failed");
      expect(r.problems).toEqual([`hash differs: ${P2}`]);
    });

    it("a file the backup never listed fails it", () => {
      const extra = "document-pages/33333333-3333-3333-3333-333333333333/p3.jpg";
      const r = reconcileDrill(obs({ pagePaths: [P1, P2, extra], restoredFiles: [...manifest().files, { path: extra, size: 1, sha256: SHA_A }] }));
      expect(r.verdict).toBe("failed");
      expect(r.problems).toContain(`restored, not in the backup: ${extra}`);
    });

    it("a path stored with backslashes is the same file", () => {
      const r = reconcileDrill(obs({ pagePaths: [P1.replace(/\//g, "\\"), P2] }));
      expect(r.verdict).toBe("passed");
    });

    it("rows pointing at one file twice count one file, not a file without a row", () => {
      const r = reconcileDrill(obs({ pagePaths: [P1, P1, P2] }));
      expect(r.verdict).toBe("passed");
    });

    it("lists at most ten paths per kind, and says how many more", () => {
      const many = Array.from({ length: 13 }, (_, i) => `document-pages/x/${String(i).padStart(2, "0")}.jpg`);
      const r = reconcileDrill(obs({ pagePaths: [P1, P2, ...many] }));
      expect(r.problems.filter((p) => p.startsWith("row without a file: document-pages/"))).toHaveLength(10);
      expect(r.problems).toContain("row without a file: … and 3 more");
      expect(r.line).toContain("13 rows without a file");
    });
  });

  it("an entity list that does not answer 200 fails it", () => {
    const r = reconcileDrill(obs({ app: [...obs().app!.slice(0, 3), { list: "documents", status: 500, total: null }] }));
    expect(r.verdict).toBe("failed");
    expect(r.problems).toEqual(["app on 3200: documents answered 500"]);
    expect(r.line).toContain("3/4 lists answered 200");
  });

  it("an app that never came up fails it", () => {
    const r = reconcileDrill(obs({ app: [{ list: "server", status: null, total: null, error: "not ready within 300 s" }] }));
    expect(r.verdict).toBe("failed");
    expect(r.problems).toEqual(["app on 3200: server — not ready within 300 s"]);
  });

  it("live having moved on since the backup is reported, never a failure — a day of work is expected", () => {
    const live = [{ table: "public.document", rows: 107 }, ...manifest().tables.slice(1)];
    const r = reconcileDrill(obs({ liveTables: live }));
    expect(r.verdict).toBe("passed");
    expect(r.line).toMatch(/live now: 1 table moved since the backup$/);
    expect(r.details).toContain("live since the backup: public.document: 105 → 107");
  });

  it("live not answering is reported as unread, not as a failure", () => {
    const r = reconcileDrill(obs({ liveTables: null }));
    expect(r.verdict).toBe("passed");
    expect(r.line).toMatch(/live now: not read$/);
  });
});

describe("the prune keeps the last fourteen days", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const day = (d: number): string => backupFolderName(new Date(now.getTime() - d * 86_400_000));

  it("removes a backup older than fourteen days and keeps everything younger", () => {
    expect(KEEP_DAYS).toBe(14);
    const names = [day(0), day(1), day(13.9), day(14.1), day(30)];
    const r = selectPrune(names, now);
    expect(r.keep).toEqual([day(0), day(1), day(13.9)]);
    expect(r.remove).toEqual([day(14.1), day(30)]);
  });

  it("never removes the newest backup, however old — a laptop that was off for a month still has one", () => {
    const r = selectPrune([day(40), day(45)], now);
    expect(r.keep).toEqual([day(40)]);
    expect(r.remove).toEqual([day(45)]);
  });

  it("never touches a name that is not a backup", () => {
    const r = selectPrune(["drills.json", "LAST-RESULT.txt", "mine", day(20), day(1)], now);
    expect(r.remove).toEqual([day(20)]);
    expect(r.keep).toEqual([day(1)]);
  });
});

describe("the runner's own schedule", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const ago = (ms: number): Date => new Date(now.getTime() - ms);
  const H = 3_600_000;
  const M87 = "migration_087_x.sql";
  const M88 = "migration_088_y.sql";
  const base = {
    now,
    newestBackup: { at: ago(2 * H), latestMigration: M87 },
    lastDrill: { at: ago(5 * 86_400_000), latestMigration: M87 },
    liveLatestMigration: M87,
    lastAttempt: {},
  };

  it("does nothing when the newest backup is under a day old and the drill ran this month", () => {
    expect(BACKUP_EVERY_MS).toBe(24 * H);
    expect(nextAutoRun(base)).toBeNull();
  });

  it("backs up when there is no backup, or the newest is a day old", () => {
    expect(nextAutoRun({ ...base, newestBackup: null })).toBe("backup");
    expect(nextAutoRun({ ...base, newestBackup: { at: ago(24 * H), latestMigration: M87 } })).toBe("backup");
  });

  it("runs the drill when none has run, or the last one is a month old", () => {
    expect(DRILL_EVERY_MS).toBe(30 * 86_400_000);
    expect(nextAutoRun({ ...base, lastDrill: null })).toBe("restore-drill");
    expect(nextAutoRun({ ...base, lastDrill: { at: ago(DRILL_EVERY_MS), latestMigration: M87 } })).toBe("restore-drill");
  });

  it("after a migration, backs up first, so the drill restores a backup of the new schema", () => {
    const migrated = { ...base, liveLatestMigration: M88 };
    expect(nextAutoRun(migrated)).toBe("backup");
    expect(nextAutoRun({ ...migrated, newestBackup: { at: ago(60_000), latestMigration: M88 } })).toBe("restore-drill");
  });

  it("an attempt that failed is not retried for six hours — the runner does not hammer a stopped Docker", () => {
    expect(AUTO_RETRY_MS).toBe(6 * H);
    const noBackup = { ...base, newestBackup: null };
    expect(nextAutoRun({ ...noBackup, lastAttempt: { backup: ago(H) } })).toBeNull();
    expect(nextAutoRun({ ...noBackup, lastAttempt: { backup: ago(6 * H) } })).toBe("backup");
    expect(nextAutoRun({ ...base, lastDrill: null, lastAttempt: { "restore-drill": ago(H) } })).toBeNull();
  });

  it("with live unreadable, the migration rule stays quiet and the calendar still applies", () => {
    expect(nextAutoRun({ ...base, liveLatestMigration: null })).toBeNull();
    expect(nextAutoRun({ ...base, liveLatestMigration: null, newestBackup: null })).toBe("backup");
  });
});

describe("NOTHING RESTORED MAY ACT — the drill's app environment", () => {
  const envText = [
    "# comment",
    "DATABASE_URL=postgres://postgres:secret@localhost:5432/ga40db",
    "RESEND_API_KEY=re_live",
    'ANTHROPIC_API_KEY="sk-live"',
    "  export SUPABASE_SYNC_URL = postgres://cloud",
    "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=maps",
    "E2E_PASSWORD=pw",
    "not a line",
  ].join("\n");

  it("reads the NAMES of .env's keys, never needing a value", () => {
    expect(envFileKeys(envText)).toEqual([
      "DATABASE_URL",
      "RESEND_API_KEY",
      "ANTHROPIC_API_KEY",
      "SUPABASE_SYNC_URL",
      "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
      "E2E_PASSWORD",
    ]);
  });

  it("blanks every key .env names and every key that could reach mail, the AI or Supabase, and points at the drill's database", () => {
    const base = { PATH: "C:\\Windows", RESEND_API_KEY: "re_from_shell", SUPABASE_SERVICE_ROLE_KEY: "svc", CI: "1" };
    const url = `postgres://postgres:drill@127.0.0.1:${DRILL_PORT}/ga40db`;
    const env = drillAppEnv(base, envFileKeys(envText), url, ".next/drill");
    for (const k of [...DRILL_BLANKED_KEYS, ...envFileKeys(envText)].filter((k) => k !== "DATABASE_URL")) {
      expect([k, env[k]]).toEqual([k, ""]);
    }
    expect(DRILL_BLANKED_KEYS).toEqual(
      expect.arrayContaining([
        "RESEND_API_KEY",
        "ANTHROPIC_API_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_SYNC_URL",
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      ]),
    );
    expect(env.DATABASE_URL).toBe(url);
    expect(env.UAT_NO_AUTH).toBe("true");
    expect(env.LOCAL_FILE_STORAGE).toBe("true");
    expect(env.GA40_NEXT_DIST_DIR).toBe(".next/drill");
    expect(env.PATH).toBe("C:\\Windows");
    expect(env.CI).toBeUndefined();
  });

  it("tsconfig.json already holds the drill's type globs, so the drill's next dev never rewrites it", () => {
    const tsconfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "tsconfig.json"), "utf8")) as { include: string[] };
    expect(DRILL_DIST_DIR).toBe(".next/drill");
    expect(tsconfig.include).toEqual(expect.arrayContaining([`${DRILL_DIST_DIR}/types/**/*.ts`, `${DRILL_DIST_DIR}/dev/types/**/*.ts`]));
  });

  it("refuses a database URL that is not the drill's own port on loopback", () => {
    expect(() => drillAppEnv({}, [], "postgres://postgres:x@localhost:5432/ga40db", ".next/drill")).toThrow(/5434/);
    expect(() => drillAppEnv({}, [], "postgres://postgres:x@db.example.com:5434/ga40db", ".next/drill")).toThrow(/loopback/);
  });
});

describe("the runner's sequences (Slice #37.11)", () => {
  it("backup and restore-drill are sequences of their own, and migrate-local backs up first", () => {
    expect(SEQUENCES.backup).toEqual(["backup"]);
    expect(SEQUENCES["restore-drill"]).toEqual(["restore-drill"]);
    expect(SEQUENCES["migrate-local"]).toEqual(["backup", "apply-migration", "export-schema"]);
  });

  it("no migration is applied without a backup that passed", () => {
    expect(skipReasonFor("apply-migration", { status: "passed", applied: 0 })).toBeNull();
    expect(skipReasonFor("apply-migration", { status: "failed", applied: 0 })).toMatch(/backup before it ended failed/);
    expect(skipReasonFor("apply-migration", null)).toMatch(/backup before it ended unrun/);
  });

  it("export-schema still runs only after a migration was applied", () => {
    expect(skipReasonFor("export-schema", { status: "passed", applied: 1 })).toBeNull();
    expect(skipReasonFor("export-schema", { status: "passed", applied: 0 })).toBe("nothing was applied, so there is nothing to regenerate");
    expect(skipReasonFor("export-schema", { status: "skipped", applied: 0 })).toBe("the step before it ended skipped");
    expect(skipReasonFor("e2e", null)).toBeNull();
  });

  it("each step's summary is its script's last BACKUP: or DRILL: line", () => {
    expect(summariseStep("backup", "copying\nBACKUP: 2026-09-28T162803Z — 48 tables\n", 0)).toBe("2026-09-28T162803Z — 48 tables (exit 0)");
    expect(summariseStep("restore-drill", "DRILL: FAILED — backup x: …\n", 1)).toBe("FAILED — backup x: … (exit 1)");
  });
});
