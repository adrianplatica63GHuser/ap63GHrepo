/**
 * Every writer to the four object tables, named and counted.   (Slice #34.07)
 *
 * ⚠️ **THE PREMISE THIS TEST EXISTS TO DEFEND: "one create function per
 * family" is a claim about the REPOSITORY, not about the application.** The
 * slice that produced this test counted the writers of `property`, `document`,
 * `natural_person` and `judicial_person` and found SEVEN where four were
 * expected — and two of the three extras were found only on a second search,
 * done differently. That is the failure mode: a create path that agrees with
 * the real one by inspection, and drifts from it in silence.
 *
 * What the extras were skipping was not cosmetic: no version-0 row (so a first
 * edit had nothing to diff against), no `updated_by`, no `calculated_area_mp`
 * and no `corner_order_self_intersects` (so a seeded property showed an empty
 * area beside four real corners), and `display_name` derived by a second rule.
 *
 * ⚠️ **AND ONE OF THE SEVEN CANNOT BE FOUND BY SEARCHING FOR A TABLE NAME AT
 * ALL.** Reference Data's bulk re-point writes
 * `sql`UPDATE ${table} SET ${column} = ...`` where `table` is a `PgTable`
 * resolved at run time from `LIST_DEPENDENCIES`. Grep for `property` and it is
 * not there. It is pinned below by its SHAPE, because that is the only handle
 * a static test has on it — and because a search that cannot see it is exactly
 * how a reviewer concludes there are four writers.
 *
 * WHAT THE SCAN COVERS, after an adversarial round widened it:
 *   - `.insert(x)` / `.update(x)` on the four Drizzle tables, in every
 *     `.ts/.tsx/.mts/.cts/.js/.jsx/.mjs/.cjs` under `src/`, `scripts/`, `e2e/`
 *     and the repository root;
 *   - raw `INSERT INTO` / `UPDATE` naming one of the four tables, in those same
 *     files (a `db.execute(sql`INSERT INTO property …`)` is a writer that the
 *     Drizzle scan alone would miss — `scripts/supabase-sync.ts` already writes
 *     other tables that way). Such a hit is labelled `~raw`, so that it can
 *     never be confused in the expected list with a Drizzle `.update(property)`
 *     in the same file;
 *   - the same, in EVERY `.sql` in the repository, found by walking from the
 *     root rather than by listing three directories — `docker/postgres/init/`
 *     and `scripts/testing/` both hold one, and a list of directories is a list
 *     somebody has to remember to extend;
 *   - **HOW MANY TIMES each writes**, not merely that it does. A per-file list
 *     would let a second, hand-rolled `.insert(property)` be added inside
 *     `src/lib/properties/queries.ts` — the single most likely home for a new
 *     create path — without changing anything.
 *
 * WHAT IT STILL CANNOT SEE, stated so the list is not read as stronger than it
 * is:
 *   - a table imported under an alias (`import { property as t }` then
 *     `.insert(t)`). The qualified form (`.insert(schema.property)`) IS caught,
 *     by its own assertion below;
 *   - SQL assembled from fragments, or a table name built at run time — the
 *     bulk re-point is the one instance and is pinned by shape;
 *   - the raw-SQL regex is textual, and template literals and JSX text are NOT
 *     blanked (blanking them would hide the `sql`…`` writers it exists to
 *     catch). So user-facing prose reading "update property" would be counted.
 *     That is the safe direction — a false writer is looked at and dismissed,
 *     a missed one is not — but it is why a failure here may be a sentence
 *     rather than a statement;
 *   - `src/db/migration_*.sql` and `drizzle/*.sql`, the two migration chains. A
 *     migration writes these tables by definition and runs once; the rule here
 *     is about code that runs on every request or every seed.
 *     `hard-delete-single-source.test.ts` holds migrations to their own rules.
 *     (Neither chain writes a row into the four tables today — the exclusion is
 *     about what they are FOR, not about what they currently contain.)
 *   - comments and string literals, which are stripped before the scan. That
 *     is deliberate — a comment quoting `.insert(property)` is not a writer —
 *     and it is also why this file is excluded from its own walk.
 */

import fs from "fs";
import path from "path";
import {
  DOCUMENT_SNAPSHOT_KEYS,
  JUDICIAL_PERSON_SNAPSHOT_FIELDS_KEYS,
  NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS,
  PERSON_ADDRESS_SNAPSHOT_KEYS,
  PROPERTY_SNAPSHOT_ADDRESS_KEYS,
  PROPERTY_SNAPSHOT_PROPERTY_KEYS,
} from "@/lib/versioning/snapshot-registry";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const SCRIPTS = path.join(ROOT, "scripts");
const DB_DIR = path.join(SRC, "db");

/**
 * Read normalised to LF. `.gitattributes` enforces LF in the repository, but a
 * multi-line `toContain` is exactly the assertion that would fail obscurely on
 * a checkout that had picked up CRLF anyway.
 */
function read(...parts: string[]): string {
  return fs.readFileSync(path.join(...parts), "utf8").replace(/\r\n/g, "\n");
}

/**
 * Source with comments and quoted strings blanked — the same helper shape as
 * `tarla-is-a-reference.test.ts`. Template literals are deliberately LEFT
 * INTACT: raw SQL in this codebase lives inside `sql`…`` backticks, and
 * blanking those would hide the writers this scan was widened to catch.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

/** SQL with its `--` comment lines removed, for the same reason. */
function sqlWithoutComments(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
}

const CODE_EXT = /\.(tsx?|mts|cts|jsx?|mjs|cjs)$/;

/** Directories neither walk descends into: generated, vendored or transient. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".swc",
  "test-results",
  "playwright-report",
  "coverage",
  "_to_delete",
]);

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    // The test tree is excluded wholesale rather than by name: more than one
    // test quotes one of these call shapes in an assertion, and none of them
    // is a writer.
    if (entry.isDirectory() && entry.name === "__tests__") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (CODE_EXT.test(entry.name)) acc.push(full);
  }
  return acc;
}

/** Root-level code files (middleware.ts, drizzle.config.ts, …). */
function rootFiles(): string[] {
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && CODE_EXT.test(e.name))
    .map((e) => path.join(ROOT, e.name));
}

const CODE_FILES = [
  ...walk(SRC),
  ...walk(SCRIPTS),
  ...walk(path.join(ROOT, "e2e")),
  ...rootFiles(),
];

/**
 * Every `.sql` in the repository that is not part of a migration chain.
 *
 * Walked from the root rather than read out of a list of directories: the
 * first version of this named `src/db`, `scripts` and `drizzle`, which already
 * missed `docker/postgres/init/` and `scripts/testing/`. A directory list is
 * one more thing to remember to extend, and forgetting silently un-covers a
 * writer — the exact failure this suite exists to prevent.
 */
function sqlFiles(dir: string = ROOT, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // Generated and transient trees. `.git` in particular can hold a
    // `_stranded_locks/` quarantine (see the sandbox rules), and a build
    // directory can vanish between the readdir and the recursion — a walk that
    // throws would fail this suite with a stack trace instead of a finding.
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      sqlFiles(full, acc);
      continue;
    }
    if (!entry.name.endsWith(".sql")) continue;
    const r = rel(full);
    // The two migration chains — see the header.
    if (r.startsWith("src/db/migration_")) continue;
    if (r.startsWith("drizzle/")) continue;
    acc.push(full);
  }
  return acc;
}

function rel(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

/**
 * The four families, in both languages they are written in.
 *
 * `sql` is the table name Postgres knows; `ts` is the Drizzle export the query
 * builder is handed. They are searched separately because the extra writers
 * this test was born from were written one in each.
 */
const FAMILIES = [
  { ts: "property", sql: "property" },
  { ts: "document", sql: "document" },
  { ts: "naturalPerson", sql: "natural_person" },
  { ts: "judicialPerson", sql: "judicial_person" },
] as const;

/**
 * `\b` would be wrong here: `document` is a prefix of `document_version` and
 * `document_page`, and `\b` does not fire between `t` and `_`. The negative
 * lookahead on `[_\w]` is what keeps `INSERT INTO document_page` out of the
 * `document` count — and getting this wrong would make the test pass by
 * over-matching, which is the direction that hides a writer rather than
 * inventing one.
 */
function sqlWriteRe(table: string, verb: "INSERT INTO" | "UPDATE"): RegExp {
  return new RegExp(`${verb}\\s+(?:public\\.)?"?${table}"?(?![_\\w])`, "gi");
}

function tsWriteRe(tsName: string, verb: "insert" | "update"): RegExp {
  return new RegExp(`\\.${verb}\\(\\s*${tsName}\\s*\\)`, "g");
}

function count(src: string, re: RegExp): number {
  return [...src.matchAll(re)].length;
}

/** "<path>:<family>:<VERB>:<n>" for every write site found, sorted. */
function foundWriters(): string[] {
  const out: string[] = [];

  for (const file of CODE_FILES) {
    const src = code(read(file));
    for (const fam of FAMILIES) {
      for (const verb of ["insert", "update"] as const) {
        const n = count(src, tsWriteRe(fam.ts, verb));
        if (n) out.push(`${rel(file)}:${fam.sql}:${verb.toUpperCase()}:${n}`);
      }
      for (const [verb, label] of [
        ["INSERT INTO", "INSERT"],
        ["UPDATE", "UPDATE"],
      ] as const) {
        const n = count(src, sqlWriteRe(fam.sql, verb));
        // `~raw` so a Drizzle `.update(property)` and a raw `UPDATE property`
        // in ONE file are two distinguishable entries rather than one
        // ambiguous `file:property:UPDATE:n`.
        if (n) out.push(`${rel(file)}:${fam.sql}:${label}~raw:${n}`);
      }
    }
  }

  for (const file of sqlFiles()) {
    const src = sqlWithoutComments(read(file));
    for (const fam of FAMILIES) {
      for (const [verb, label] of [
        ["INSERT INTO", "INSERT"],
        ["UPDATE", "UPDATE"],
      ] as const) {
        const n = count(src, sqlWriteRe(fam.sql, verb));
        if (n) out.push(`${rel(file)}:${fam.sql}:${label}:${n}`);
      }
    }
  }

  return out.sort();
}

/**
 * Every write site, with the reason it is allowed to exist.
 *
 * Read this list as prose: four creates, four updates (one of them twice —
 * `updateProperty`'s patch and its corner rewrite), one bulk re-point that
 * stamps `updated_by`, one maintenance script, one SQL fixture.
 */
const EXPECTED_WRITERS = [
  // ── The four create/update functions. Each owns its family end to end:
  //    the principal_object code, the row, `updated_by` and version 0.
  "src/lib/documents/queries.ts:document:INSERT:1",
  "src/lib/documents/queries.ts:document:UPDATE:1",
  "src/lib/judicial-persons/queries.ts:judicial_person:INSERT:1",
  "src/lib/judicial-persons/queries.ts:judicial_person:UPDATE:1",
  "src/lib/persons/queries.ts:natural_person:INSERT:1",
  "src/lib/persons/queries.ts:natural_person:UPDATE:1",
  "src/lib/properties/queries.ts:property:INSERT:1",
  "src/lib/properties/queries.ts:property:UPDATE:2",

  // ── Reference Data's bulk re-point, stamping `updated_by` on the objects
  //    whose lookup value moved (Slice #29.14). It writes no field a user
  //    typed; the value itself moves through `moveRef`'s dynamic UPDATE, which
  //    no scan of this shape can see — pinned separately below.
  "src/lib/admin/value-lists/move-history.ts:document:UPDATE:1",
  "src/lib/admin/value-lists/move-history.ts:property:UPDATE:1",

  // ── A maintenance script, and the only writer here that exists to correct
  //    rows rather than to make them: it settles `corner_order_self_intersects`
  //    from corners already stored, behind an explicit --apply flag, with the
  //    `updated_at` trigger disabled. It writes that column and NOTHING else —
  //    not the area, not a corner, not a version row — which is its own
  //    header's first rule and was misdescribed here until a review round.
  "scripts/mark-bow-tie-properties.ts:property:UPDATE:1",

  // ── The SQL dev fixture. Slice #34.07 decided to leave it as SQL rather
  //    than rewrite it around the create functions, and its own header states
  //    every field it therefore does not write. That decision is what these
  //    lines record: it is a writer, deliberately, and knowing what it skips
  //    is the price of keeping it.
  "src/db/seed_dev_data.sql:document:INSERT:1",
  "src/db/seed_dev_data.sql:document:UPDATE:1",
  "src/db/seed_dev_data.sql:judicial_person:INSERT:1",
  "src/db/seed_dev_data.sql:natural_person:INSERT:1",
  "src/db/seed_dev_data.sql:property:INSERT:1",
].sort();

describe("every writer to the four object tables is named", () => {
  it("is exactly this list, counts included — an eighth writer fails here", () => {
    expect(foundWriters()).toEqual(EXPECTED_WRITERS);
  });

  it("nothing reaches a table through a qualified name, which would dodge the scan", () => {
    // `.insert(schema.property)` is legal Drizzle and invisible to
    // `tsWriteRe`. Nothing writes that way today; this keeps it that way
    // rather than widening a regex to a shape nobody uses.
    const offenders: string[] = [];
    for (const file of CODE_FILES) {
      const src = code(read(file));
      for (const fam of FAMILIES) {
        const re = new RegExp(
          `\\.(?:insert|update)\\(\\s*\\w+\\.${fam.ts}\\s*\\)`,
        );
        if (re.test(src)) offenders.push(`${rel(file)} → ${fam.ts}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("src/db/seed.ts is not one of them any more", () => {
    // It was, until #34.07: four hand-written INSERTs re-implementing all four
    // families. Asserted separately from the list above so that a regression
    // names the file rather than printing a 16-line diff.
    const src = code(read(DB_DIR, "seed.ts"));
    for (const fam of FAMILIES) {
      expect(count(src, tsWriteRe(fam.ts, "insert"))).toBe(0);
      expect(count(src, tsWriteRe(fam.ts, "update"))).toBe(0);
    }
  });

  it("and it calls all four create functions instead", () => {
    const src = read(DB_DIR, "seed.ts");
    // `createPropertyIn` and not `createProperty`, because the properties
    // section supplies its own transaction and stays all-or-nothing.
    for (const fn of [
      "createPropertyIn(",
      "createDocument(",
      "createNaturalPerson(",
      "createJudicialPerson(",
    ]) {
      expect(src).toContain(fn);
    }
  });

  it("the standalone judicial seed still calls the create function too", () => {
    // The example that showed the alternative before the slice took it.
    expect(read(SCRIPTS, "seed-judicial-persons.ts")).toContain(
      "createJudicialPerson(",
    );
  });

  it("the bulk re-point's dynamic UPDATE is still shaped the way it is", () => {
    // ⚠️ The seventh writer, and the one a table-name search cannot find. If
    // this statement is ever rewritten to name a table, it becomes visible to
    // the scan above and that test fails instead — which is the outcome to
    // want. If it is rewritten to route through the update functions, read the
    // header of `move-history.ts` first: the per-object round trip that would
    // reintroduce is ~25 000 statements for a 5 000-property move against
    // about 60, which is why the port is set-shaped. Slice #34.07 examined it
    // and deliberately left it.
    expect(read(SRC, "lib", "admin", "value-lists", "queries.ts")).toContain(
      "sql`UPDATE ${table} SET ${column} = ${to} WHERE ${column} = ${from} RETURNING ${returning}`",
    );
  });
});

// ---------------------------------------------------------------------------
// The comparison that decides whether a write is recorded
// ---------------------------------------------------------------------------

/**
 * All four families, not just the property one the slice was pointed at.
 *
 * The defect found was `SNAPSHOT_PROPERTY_KEYS` holding nine keys where the
 * compile-guarded registry array held ten — and the hand-written one was what
 * `snapshotsEqual` read, so `calculatedAreaMp` was written into every snapshot
 * and compared in none. The other three families had lists of exactly the same
 * shape with exactly the same absence of a guard; they happened to agree,
 * which is a fact about that day rather than a property of the code.
 */
describe("every snapshot comparison reads the registry, not its own copy", () => {
  const BINDINGS: ReadonlyArray<[string, string[], readonly string[]]> = [
    [
      "src/lib/properties/queries.ts",
      [
        'SNAPSHOT_PROPERTY_KEYS: ReadonlyArray<keyof PropertySnapshot["property"]> =\n  PROPERTY_SNAPSHOT_PROPERTY_KEYS',
        'SNAPSHOT_ADDRESS_KEYS: ReadonlyArray<keyof NonNullable<PropertySnapshot["address"]>> =\n  PROPERTY_SNAPSHOT_ADDRESS_KEYS',
      ],
      [...PROPERTY_SNAPSHOT_PROPERTY_KEYS, ...PROPERTY_SNAPSHOT_ADDRESS_KEYS],
    ],
    [
      "src/lib/documents/queries.ts",
      ["SNAPSHOT_KEYS: ReadonlyArray<keyof DocumentSnapshot> = DOCUMENT_SNAPSHOT_KEYS"],
      DOCUMENT_SNAPSHOT_KEYS,
    ],
    [
      "src/lib/persons/queries.ts",
      [
        'NAT_FIELD_KEYS: ReadonlyArray<keyof NaturalPersonSnapshot["natural"]> =\n  NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS',
        "ADDR_SNAP_KEYS: ReadonlyArray<keyof PersonAddressSnapshot> =\n  PERSON_ADDRESS_SNAPSHOT_KEYS",
      ],
      [...NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS, ...PERSON_ADDRESS_SNAPSHOT_KEYS],
    ],
    [
      "src/lib/judicial-persons/queries.ts",
      [
        'JUD_FIELD_KEYS: ReadonlyArray<keyof JudicialPersonSnapshot["judicial"]> =\n  JUDICIAL_PERSON_SNAPSHOT_FIELDS_KEYS',
        "JUD_ADDR_KEYS: ReadonlyArray<keyof PersonAddressSnapshot> =\n  PERSON_ADDRESS_SNAPSHOT_KEYS",
      ],
      [...JUDICIAL_PERSON_SNAPSHOT_FIELDS_KEYS, ...PERSON_ADDRESS_SNAPSHOT_KEYS],
    ],
  ];

  it.each(BINDINGS.map(([file, binds]) => [file, binds] as const))(
    "%s assigns its key list from the registry",
    (file, binds) => {
      const src = read(ROOT, file);
      for (const bind of binds) expect(src).toContain(bind);
      expect(src).toContain('from "@/lib/versioning/snapshot-registry"');
    },
  );

  /**
   * Keys these files are allowed to quote, and why.
   *
   * `customFields` is compared by `customFieldsEqual` rather than `!==` — it
   * is a nested record, so identity comparison is always unequal — and the
   * branch that does it has to name the key: `if (k === "customFields")`. That
   * is a comparison RULE, not a second key list, and it is the only one.
   */
  const ALLOWED_QUOTED: Record<string, readonly string[]> = {
    "src/lib/documents/queries.ts": ["customFields"],
  };

  it("so nothing re-lists the keys as literals beside the assignment", () => {
    // The tell that a copy has come back: a quoted key from that family's
    // registry array appearing in the file. The snapshot builders write them
    // unquoted (`propertyTypeId:`), so a quoted `"propertyTypeId"` in one of
    // these four files is a second list — or, at best, a key singled out for a
    // rule, which is what the allowance above is for.
    for (const [file, , keys] of BINDINGS) {
      const src = read(ROOT, file);
      const allowed = ALLOWED_QUOTED[file] ?? [];
      const quoted = keys
        .filter((k) => src.includes(`"${k}"`))
        .filter((k) => !allowed.includes(k));
      expect([file, quoted]).toEqual([file, []]);
    }
  });

  it("and the property comparison therefore includes calculatedAreaMp", () => {
    // The one key the hand-written list was missing. Named explicitly so the
    // regression that started this has a test of its own.
    expect(PROPERTY_SNAPSHOT_PROPERTY_KEYS).toContain("calculatedAreaMp");
  });
});

// ---------------------------------------------------------------------------
// Provenance: written after the row is committed, so never able to un-commit it
// ---------------------------------------------------------------------------

describe("every initial-provenance write is guarded at its call site", () => {
  /**
   * Source with the DECLARATION renamed out of the way, so it is not counted
   * as a call. `src/lib/metadata/queries.ts` would otherwise appear as an
   * unguarded caller of the function it defines — which it is not, and which
   * would have made the guard assertion below permanently red.
   */
  function calls(file: string): string {
    return code(read(file)).replace(
      /function\s+setInitialProvenance\s*\(/g,
      "function __declaration__(",
    );
  }

  /** Every file that CALLS it — discovered, not listed, so a new caller counts. */
  function callers(): string[] {
    return CODE_FILES.filter((f) =>
      /setInitialProvenance\s*\(/.test(calls(f)),
    ).map(rel);
  }

  it("finds the callers by scanning, and there are seven", () => {
    // A hand-written list cannot fail for the case that matters — a brand-new
    // caller in a brand-new file. This one can.
    expect(callers().sort()).toEqual(
      [
        "src/app/api/calculation/commit/route.ts",
        "src/app/api/documents/[id]/process/route.ts",
        "src/app/api/documents/route.ts",
        "src/app/api/judicial-persons/route.ts",
        "src/app/api/people/route.ts",
        "src/app/api/properties/route.ts",
        "src/lib/properties/import-property.ts",
      ].sort(),
    );
  });

  it("and EVERY call in them carries its own .catch()", () => {
    // ⚠️ The guarantee belongs to the CALLER, which has already committed the
    // row, not to `setInitialProvenance`'s private catch block. That catch
    // currently swallows everything it sees, so these `.catch()`es are defence
    // in depth — and the depth is the point: narrowing it to the 23514 case its
    // own comment is written about is the obvious future edit, and would
    // otherwise put a dropped connection between a committed row and a 201.
    //
    // Counted rather than `.test()`ed, so a SECOND, unguarded call added to a
    // file that already has a guarded one cannot pass.
    const unguarded: string[] = [];
    for (const file of CODE_FILES) {
      const src = calls(file);
      const total = count(src, /setInitialProvenance\s*\(/g);
      if (total === 0) continue;
      const guarded = count(
        src,
        /setInitialProvenance\s*\([\s\S]{0,400}?\)\s*\.catch\s*\(/g,
      );
      if (guarded !== total) unguarded.push(`${rel(file)}: ${guarded}/${total}`);
    }
    expect(unguarded).toEqual([]);
  });

  it("nothing writes an initial provenance through patchEntityMetadata any more", () => {
    // The calculation-commit route was the one that did, and it was the one
    // with no swallow at all: a `Promise.all` over bare `patchEntityMetadata`
    // calls, run after N properties, a group and a calculation run were
    // already committed. `setInitialProvenance`'s own docblock claimed to
    // mirror it, which had stopped being true.
    const src = read(ROOT, "src/app/api/calculation/commit/route.ts");
    expect(src).not.toContain("patchEntityMetadata(");
    expect(src).not.toContain("import { patchEntityMetadata }");
    expect(src).toContain("setInitialProvenance(");
  });
});

// ---------------------------------------------------------------------------
// One required-field rule, stated the same way in both routes
// ---------------------------------------------------------------------------

describe("the import's two cadastral gates are the same gate", () => {
  it.each([
    ["src/app/api/admin/import/property/route.ts", "the WRITE route"],
    ["src/app/api/admin/import/property-plan/route.ts", "the PLAN route"],
  ])("%s folds whitespace before it decides", (file) => {
    // `.min(1)` counts characters; `hasCadastralIdentity` — which
    // `ensurePropertyForFolder` asks one layer below — folds whitespace away
    // first. So `"  "` passed the write route's schema and was refused deeper,
    // with a different error body, mid-loop, after earlier folders had been
    // written. The plan route already carried the folding refinement and a
    // comment describing the difference it had fixed on one side only.
    //
    // Named per field rather than counted: a count of two would still pass if
    // one of them were `folderName`, which the plan route also validates with
    // a `.min(1)` that is correct there because a folder name is not a
    // cadastral identifier.
    const src = read(ROOT, file);
    expect(src).toContain(
      'tarlaSola: z.string().refine((v) => cadastralKey(v) !== "", "tarla is required")',
    );
    expect(src).toContain(
      'parcela: z.string().refine((v) => cadastralKey(v) !== "", "parcela is required")',
    );
    expect(src).not.toContain("tarlaSola: z.string().min(1)");
    expect(src).not.toContain("parcela: z.string().min(1)");
    expect(src).toContain('from "@/lib/properties/cadastral-identity"');
  });
});
