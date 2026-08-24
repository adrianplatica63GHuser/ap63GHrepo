/**
 * @jest-environment node
 */

/**
 * Slice #29.14 — a bulk re-point that history can explain.
 *
 * THE DEFECT THIS FILE IS ABOUT
 *   `reassignDependents` rewrote its rows with one raw UPDATE per dependent
 *   ref and did nothing else: no version row, no `updated_by`. The columns it
 *   rewrites are INSIDE the version snapshots — `propertyTypeId`,
 *   `useCategoryId`, `tarlaSola`, `documentTypeId`, `institutionId`,
 *   `citizenshipId`, `physicalPersonTypeId`, `judicialPersonTypeId` — so the
 *   move changed what a fresh snapshot would say without saying it.
 *
 *   Nothing was lost. What was wrong was ATTRIBUTION, and it was wrong twice
 *   over: `updateProperty` and `updateDocument` insert a version only when a
 *   fresh snapshot differs from the latest stored one, so the NEXT ordinary
 *   edit to a moved object wrote a version whose diff contained the type
 *   change under whoever made THAT edit; and the row's own `updated_by` kept
 *   the previous writer while the `touch_updated_at` trigger moved
 *   `updated_at`, so the row read "changed just now, by someone who did not
 *   change it".
 *
 * WHAT THIS FILE CAN AND CANNOT ASSERT
 *   It has no database — no test in this repo has one. So it splits the claim
 *   in two and asserts both halves honestly:
 *
 *     • **The RULE**, exercised for real. `appendVersionsIfChanged`
 *       (src/lib/versioning/append.ts) takes its three database operations as
 *       closures, so §1 below runs the actual decision against plain fakes: a
 *       changed snapshot writes, an unchanged one does not, the number is
 *       `latest + 1`, and the acting user reaches the row. That is the whole
 *       of "a move that changes a snapshot writes a version, a move that
 *       changes nothing writes none, and the attribution belongs to the person
 *       who ran the move" — at the level of the rule.
 *
 *     • **That the mover really uses it**, and uses it in the right place —
 *       §4 and §5, at source level, in the style this repo already uses for
 *       auth-single-source and value-list-dependents. A rule the mover does
 *       not call is worth nothing, and a version written outside the move's
 *       transaction is a history a rollback leaves disagreeing with its rows.
 *
 *   ⚠️ **THE SOURCE GUARDS ARE SCOPED, AND AN ADVERSARIAL ROUND IS WHY.** A
 *   first draft asserted the tx-only reads against `record*IfChanged` alone —
 *   but the reads live in the `*FullsIn` helpers one function above, so the
 *   guard could be kept green with every snapshot rebuilt from the global `db`
 *   handle, which is exactly the Slice #18.05 defect it exists to prevent. The
 *   readers are named in `ENTITIES` below and checked with the rest. The same
 *   round found the `RETURNING` guard asserted against the whole file rather
 *   than against `moveRef`; it is scoped now.
 *
 *   The half neither can reach — that a live move against live rows really
 *   leaves the trail — is Adrian's, through the UI, and is named in the
 *   handover.
 */

import fs from "fs";
import path from "path";
import { getTableName } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { VALID_LIST_KEYS, type ListKey } from "@/lib/admin/value-lists/config";
import {
  LIST_DEPENDENCIES,
  UNVERSIONED_MOVE_TABLES,
  type VersionedEntityKey,
} from "@/lib/admin/value-lists/dependents";
import {
  appendVersionsIfChanged,
  batched,
  VERSION_BATCH,
} from "@/lib/versioning/append";

const SRC = path.join(process.cwd(), "src");

function read(...parts: string[]): string {
  return fs.readFileSync(path.join(SRC, ...parts), "utf8");
}

/** The table a column belongs to, by name. */
function ownerTable(column: PgColumn): string {
  return getTableName(column.table);
}

/**
 * A file with comments and string bodies blanked — the same helper
 * value-list-dependents.test.ts uses, and for the same reason: the guards
 * below are about what the CODE does, and this slice's whole method is to
 * write the reasoning down in comments. A guard tripped by the sentence
 * explaining the fix would push that reasoning out of the codebase.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

/**
 * One top-level function's body, comments and string bodies blanked.
 *
 * Scoped rather than whole-file for the reason the sibling files record: a
 * guard asserting "this function writes no version row directly" passes
 * happily on `createProperty`, which is SUPPOSED to write version 0, and would
 * keep the guard green with the update path rewritten to anything at all.
 *
 * Matches non-exported functions too — three of the four readers this file
 * guards are module-private.
 */
function functionBody(source: string, name: string): string {
  const stripped = code(source);
  // `\\s*(<[^>]*>)?` so a generic signature is found too — `latestPersonVersionsIn<S>`
  // is one, and a helper that silently "was not found" would throw rather than
  // pass, but only after someone renamed it.
  const re = new RegExp(`^(export )?async function ${name}\\s*(<[^>]*>)?\\(`, "m");
  const m = re.exec(stripped);
  if (!m) throw new Error(`${name} not found as a top-level function`);
  const rest = stripped.slice(m.index + 1);
  const end = rest.search(/^(export )?(async )?function /m);
  return end === -1 ? rest : rest.slice(0, end);
}

/** One `pgTable(...)` block of the schema, by its exported const name. */
function schemaBlock(name: string): string {
  const schema = read("db", "schema", "index.ts");
  const start = schema.indexOf(`export const ${name} = pgTable(`);
  expect(start).toBeGreaterThan(-1);
  const next = schema.indexOf("\nexport const ", start + 1);
  return schema.slice(start, next === -1 ? undefined : next);
}

const LISTS = VALID_LIST_KEYS as readonly ListKey[];

// ---------------------------------------------------------------------------
// 1. The rule itself — the only part of this that can be RUN
// ---------------------------------------------------------------------------

type Snap = { typeId: string | null; name: string };

const equalSnaps = (a: Snap, b: Snap) => a.typeId === b.typeId && a.name === b.name;

/** A port over plain objects. `inserted` is what the version table would hold. */
function fakePort(
  next: Array<[string, Snap]>,
  latest: Array<[string, { versionNumber: number; snapshot: Snap }]> = [],
) {
  const inserted: Array<{
    rows: Array<{ id: string; versionNumber: number; snapshot: Snap }>;
    updatedBy: string | null;
  }> = [];
  const asked: string[][] = [];
  return {
    inserted,
    asked,
    port: {
      buildSnapshots: async (ids: readonly string[]) => {
        // Recorded, not ignored: the batching lives inside
        // `appendVersionsIfChanged`, so "which ids did each round actually ask
        // about" is the only place a dropped batch would show.
        asked.push([...ids]);
        return new Map(next.filter(([id]) => ids.includes(id)));
      },
      latestVersions: async (ids: readonly string[]) =>
        new Map(latest.filter(([id]) => ids.includes(id))),
      equal: equalSnaps,
      insertVersions: async (
        rows: ReadonlyArray<{ id: string; versionNumber: number; snapshot: Snap }>,
        updatedBy: string | null,
      ) => {
        inserted.push({ rows: [...rows], updatedBy });
      },
    },
  };
}

describe("appending versions for rewritten objects", () => {
  it("writes one where the snapshot really changed, numbered latest + 1", async () => {
    // The shape a move actually produces: everything identical except the
    // lookup id the re-point rewrote.
    const { port, inserted } = fakePort(
      [["p1", { typeId: "TARGET", name: "Lot 12" }]],
      [["p1", { versionNumber: 3, snapshot: { typeId: "SOURCE", name: "Lot 12" } }]],
    );

    await expect(appendVersionsIfChanged(port, ["p1"], "ana@example.com")).resolves.toBe(1);
    expect(inserted).toEqual([
      {
        rows: [
          { id: "p1", versionNumber: 4, snapshot: { typeId: "TARGET", name: "Lot 12" } },
        ],
        updatedBy: "ana@example.com",
      },
    ]);
  });

  it("writes none where nothing the snapshot carries changed", async () => {
    // The backstop every edit path already had, inherited rather than invented.
    // No move can reach it today — every column the eight versioned refs move
    // is inside its snapshot, so a rewritten row's snapshot must differ. It is
    // kept because the rule is shared with the four edit paths, where it fires
    // constantly, and because a future ref whose column is NOT in the snapshot
    // would otherwise write a version recording nothing.
    const { port, inserted } = fakePort(
      [["p1", { typeId: "TARGET", name: "Lot 12" }]],
      [["p1", { versionNumber: 3, snapshot: { typeId: "TARGET", name: "Lot 12" } }]],
    );

    await expect(appendVersionsIfChanged(port, ["p1"], "ana@example.com")).resolves.toBe(0);
    expect(inserted).toEqual([]);
  });

  it("decides per object, not per batch", async () => {
    // The half of "one version per object" that can be run: a batch where one
    // object changed and one did not writes exactly one row, and each row
    // carries its OWN next number rather than a number shared with the batch.
    const { port, inserted } = fakePort(
      [
        ["p1", { typeId: "TARGET", name: "Lot 12" }],
        ["p2", { typeId: "TARGET", name: "Lot 13" }],
        ["p3", { typeId: "TARGET", name: "Lot 14" }],
      ],
      [
        ["p1", { versionNumber: 3, snapshot: { typeId: "SOURCE", name: "Lot 12" } }],
        ["p2", { versionNumber: 7, snapshot: { typeId: "TARGET", name: "Lot 13" } }],
        // p3 has no history at all.
      ],
    );

    await expect(
      appendVersionsIfChanged(port, ["p1", "p2", "p3"], "ana@example.com"),
    ).resolves.toBe(2);
    expect(inserted[0].rows.map((r) => [r.id, r.versionNumber])).toEqual([
      ["p1", 4],
      ["p3", 0],
    ]);
  });

  it("opens a history at 0 for an object that has none", async () => {
    // Not hypothetical: the version-0 backfills only covered rows that existed
    // when their migration ran, so a move can meet an object with no versions
    // at all. The alternative to this arithmetic is leaving it empty.
    const { port, inserted } = fakePort([["p1", { typeId: "TARGET", name: "Lot 12" }]]);

    await expect(appendVersionsIfChanged(port, ["p1"], null)).resolves.toBe(1);
    expect(inserted[0].rows[0].versionNumber).toBe(0);
  });

  it("records the person who ran the move, not the row's previous writer", async () => {
    // The whole point of the slice. `null` is a legitimate value — UAT mode
    // and legacy rows carry it — so the assertion is that whatever the caller
    // resolved is what lands, never something invented.
    for (const actor of ["ana@example.com", null]) {
      const { port, inserted } = fakePort(
        [["p1", { typeId: "TARGET", name: "Lot 12" }]],
        [["p1", { versionNumber: 0, snapshot: { typeId: "SOURCE", name: "Lot 12" } }]],
      );
      await appendVersionsIfChanged(port, ["p1"], actor);
      expect(inserted[0].updatedBy).toBe(actor);
    }
  });

  it("skips an object that is no longer there rather than throwing", async () => {
    // A concurrent delete between the move's UPDATE and the snapshot rebuild.
    const { port, inserted } = fakePort(
      [["p1", { typeId: "TARGET", name: "Lot 12" }]],
      [["p2", { versionNumber: 0, snapshot: { typeId: "SOURCE", name: "Lot 99" } }]],
    );

    await expect(appendVersionsIfChanged(port, ["p1", "p2"], "ana@example.com"))
      .resolves.toBe(1);
    expect(inserted[0].rows.map((r) => r.id)).toEqual(["p1"]);
  });

  it("covers every id, in batches, when there are more than one round's worth", async () => {
    // ⚠️ **The mutation this exists for.** An adversarial round changed the
    // loop bound to `i < 1` and the whole suite stayed green: a 900-property
    // move would have stamped and versioned the first 500 and silently left
    // 400 with the old author and no history — the defect this slice closes,
    // reintroduced past its own guard. So this asserts COVERAGE, not shape.
    const n = VERSION_BATCH * 2 + 1;
    const ids = Array.from({ length: n }, (_, i) => `p${i}`);
    const { port, inserted, asked } = fakePort(
      ids.map((id) => [id, { typeId: "TARGET", name: id }] as [string, Snap]),
    );

    await expect(appendVersionsIfChanged(port, ids, "ana@example.com")).resolves.toBe(n);
    // Every id asked about exactly once, in order, and none twice.
    expect(asked.flat()).toEqual(ids);
    expect(asked.map((b) => b.length)).toEqual([VERSION_BATCH, VERSION_BATCH, 1]);
    // Every id written exactly once.
    expect(inserted.flatMap((i) => i.rows.map((r) => r.id))).toEqual(ids);
  });

  it("cuts on a boundary small enough for the wire protocol", () => {
    // Not tuning: `inArray` binds one parameter per id and an insert binds four
    // per row, and the Bind message counts them in an Int16. A guard written as
    // `VERSION_BATCH * 4 < 65_535` passes at 16 000, which was the point an
    // adversarial round made, so this pins the order of magnitude instead.
    expect(VERSION_BATCH).toBeGreaterThan(0);
    expect(VERSION_BATCH).toBeLessThanOrEqual(1000);
    expect(batched([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(batched([])).toEqual([]);
    expect(batched(["a"])).toEqual([["a"]]);
  });

  it("touches the database not at all when there is nothing to record", async () => {
    let touched = false;
    await expect(
      appendVersionsIfChanged(
        {
          buildSnapshots: async () => {
            touched = true;
            return new Map<string, Snap>();
          },
          latestVersions: async () => new Map(),
          equal: equalSnaps,
          insertVersions: async () => {
            touched = true;
          },
        },
        [],
        "ana@example.com",
      ),
    ).resolves.toBe(0);
    expect(touched).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. The map says which rewritten tables record themselves
// ---------------------------------------------------------------------------

describe("which refs are versioned", () => {
  it("is exactly the eight refs whose table is versioned by full snapshot", () => {
    const versioned = LISTS.flatMap((l) =>
      LIST_DEPENDENCIES[l].refs
        .filter((r) => r.versioned)
        .map(
          (r) =>
            `${l}:${getTableName(r.table)}.${r.column.name}→${r.versioned!.entity}`,
        ),
    ).sort();

    expect(versioned).toEqual(
      [
        "property-types:property.property_type_id→property",
        "use-categories:property.use_category_id→property",
        "tarla:property.tarla_sola→property",
        "person-types:natural_person.physical_person_type_id→natural-person",
        "citizenships:natural_person.citizenship_id→natural-person",
        "judicial-person-types:judicial_person.judicial_person_type_id→judicial-person",
        "document-types:document.document_type_id→document",
        "institutions:document.institution_id→document",
      ].sort(),
    );
  });

  it("keys each one on a column of its own table", () => {
    // A `versioned.idColumn` naming another table's column would send the
    // move's UPDATE ... RETURNING looking for a column that is not there, and
    // take the whole move down mid-transaction.
    for (const list of LISTS) {
      for (const ref of LIST_DEPENDENCIES[list].refs) {
        if (!ref.versioned) continue;
        expect([list, ownerTable(ref.versioned.idColumn)]).toEqual([
          list,
          getTableName(ref.table),
        ]);
      }
    }
  });

  it("keys the two person satellites on person_id, which IS person.id", () => {
    // `person_version` keys on `person.id`. The move rewrites `natural_person`
    // / `judicial_person`, whose PK is also the FK to `person` — so the id the
    // UPDATE returns is directly the version's key AND the row to stamp
    // `updated_by` on, one table over. Getting this wrong writes a person's
    // history under a satellite id that matches nothing.
    const satellites: Array<[ListKey, VersionedEntityKey]> = [
      ["person-types", "natural-person"],
      ["citizenships", "natural-person"],
      ["judicial-person-types", "judicial-person"],
    ];
    for (const [list, entity] of satellites) {
      const ref = LIST_DEPENDENCIES[list].refs.find((r) => r.versioned);
      expect(ref?.versioned?.entity).toBe(entity);
      expect(ref?.versioned?.idColumn.name).toBe("person_id");
    }
  });

  it("gives no list two versioned refs on one table", () => {
    // "One version per object per move" survives only while this holds: the
    // mover calls `recordMoveHistory` once per REF, so two versioned refs on
    // the same table would give one object versions n and n+1 in a single
    // move, the first recording a half-moved state that was never a user
    // action. The header invites a twelfth list; this is what it must not do.
    for (const list of LISTS) {
      const tables = LIST_DEPENDENCIES[list].refs
        .filter((r) => r.versioned)
        .map((r) => getTableName(r.table));
      expect([list, tables]).toEqual([list, [...new Set(tables)]]);
    }
  });

  it("keys the root entities on their primary key, not just on some column", () => {
    // `versioned.idColumn` belonging to the right TABLE is not enough: naming
    // `property.code` would type-check, return codes from the UPDATE, find no
    // snapshots, and report `versions: 0` for a move that recorded nothing.
    for (const list of ["property-types", "use-categories", "tarla", "document-types", "institutions"] as ListKey[]) {
      const ref = LIST_DEPENDENCIES[list].refs.find((r) => r.versioned);
      expect([list, ref?.versioned?.idColumn.name]).toEqual([list, "id"]);
    }
  });

  it("never versions a configuration ref", () => {
    // Configuration never reaches the mover at all (see `configuration` in
    // dependents.ts). A version of a whitelist tick would record something
    // that never happened.
    for (const list of LISTS) {
      for (const ref of LIST_DEPENDENCIES[list].refs) {
        if (ref.configuration) expect(ref.versioned).toBeUndefined();
      }
    }
  });

  it("agrees with the snapshot registry in both directions", () => {
    // The reason a version is owed AT ALL is that the moved column is inside
    // the snapshot — which `def.snapshot` records against the real registry
    // array (see `dependentNotes`). So the two must not be able to disagree: a
    // list whose value lives in a snapshot must have a versioned ref, and a
    // list whose value lives on a junction row must not.
    //
    // ⚠️ This checks the REGISTRY array, which is what the note is derived
    // from — NOT the hand-kept key lists the equality functions loop over
    // (`SNAPSHOT_PROPERTY_KEYS` and its three siblings). Those already differ
    // from the registry by one field (`calculatedAreaMp`), which changes
    // nothing for any column a move rewrites and is in the handover as its own
    // item. Do not read this test as a guard over the comparison.
    for (const list of LISTS) {
      const def = LIST_DEPENDENCIES[list];
      const hasVersionedRef = def.refs.some((r) => r.versioned);
      expect([list, hasVersionedRef]).toEqual([list, def.snapshot !== undefined]);
      if (def.snapshot) {
        expect([list, def.snapshot.keys as readonly string[]]).toEqual([
          list,
          expect.arrayContaining([def.snapshot.field]),
        ]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. The five tables that are owed nothing — named, not silently skipped
// ---------------------------------------------------------------------------

describe("the unversioned association tables", () => {
  it("are exactly the ones the map leaves unversioned", () => {
    const unversioned = LISTS.flatMap((l) =>
      LIST_DEPENDENCIES[l].refs
        .filter((r) => !r.configuration && !r.versioned)
        .map((r) => getTableName(r.table)),
    );
    expect([...new Set(unversioned)].sort()).toEqual(
      [...UNVERSIONED_MOVE_TABLES].sort(),
    );
  });

  it("really carry no version table, no updated_by and no updated_at", () => {
    // The claim that nothing is owed rests on this, and it is a claim about
    // the SCHEMA rather than about the mover. If one of these ever gains an
    // `updated_by`, a move would start leaving it stale — the exact defect
    // this slice closes one table over — and this is what says so.
    const CONSTS: Record<string, string> = {
      property_person:   "propertyPerson",
      person_document:   "personDocument",
      person_person:     "personPerson",
      property_property: "propertyProperty",
      document_document: "documentDocument",
    };
    const schema = read("db", "schema", "index.ts");

    for (const table of UNVERSIONED_MOVE_TABLES) {
      // `code()` first: these blocks are heavily commented, and a future
      // comment merely MENTIONING `updated_at` would otherwise fail the build.
      const block = code(schemaBlock(CONSTS[table]));
      expect([table, /timestamp\(\s*""\s*,?[^)]*\)/.test(block)]).toEqual([
        table,
        true,
      ]);
      expect([table, /updatedBy/.test(block)]).toEqual([table, false]);
      expect([table, /updatedAt/.test(block)]).toEqual([table, false]);
      // …and no version table keys on them.
      expect([table, schema.includes(`pgTable("${table}_version"`)]).toEqual([
        table,
        false,
      ]);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. The mover really writes the trail, in the transaction that moved the rows
// ---------------------------------------------------------------------------

describe("the move records itself", () => {
  const moverSource = () => read("lib", "admin", "value-lists", "queries.ts");
  const writersSource = () => read("lib", "admin", "value-lists", "move-history.ts");

  it("resolves the acting user from the session, before the transaction", () => {
    // Before, so the cookie read and the Supabase round trip do not happen
    // while two lookup rows are locked. The acting user did not need
    // inventing — `getCurrentUser()` is the same helper every other
    // `updated_by` in this app comes from.
    const body = functionBody(moverSource(), "reassignDependents");
    const actorAt = body.indexOf("getCurrentUser()");
    const txAt = body.indexOf("db.transaction");
    expect(actorAt).toBeGreaterThan(-1);
    expect(txAt).toBeGreaterThan(-1);
    expect(actorAt).toBeLessThan(txAt);
    // …the IDENTITY, not the address, and a missing one refuses. Resolving the
    // email reports "UAT" and "the Auth API just failed" as the same null, and
    // the second of those would rewrite every moved row's author to nobody —
    // the defect this slice closes, differently spelled.
    expect(body).toMatch(/const acting = await getCurrentUser\(\);/);
    expect(body).toMatch(/if \(acting === null\) \{[\s\S]{0,200}?throw new Error\(/);
    // …and what gets stamped is that identity's own email, never a constant.
    // An adversarial round replaced this line with a literal address and every
    // other guard in this file stayed green.
    expect(body).toMatch(/updatedBy = acting\.email;/);
  });

  it("writes the history inside the move's own transaction", () => {
    // A version written after the commit is a history a rollback leaves
    // disagreeing with its own rows, and a crash between the two loses it
    // outright. `recordMoveHistory` takes `tx` — the same one `moveRef` was
    // handed — and that is the whole guarantee.
    const body = functionBody(moverSource(), "reassignDependents");
    expect(body).toContain("db.transaction");
    expect(body).toContain("recordMoveHistory(tx");
  });

  it("writes it AFTER the rows move, or it would snapshot the old value", () => {
    // The mirror image of #29.13's grant, which has to run BEFORE. The
    // snapshot is built from the row as it stands; built before the UPDATE it
    // would faithfully record the state the move was undoing.
    const body = functionBody(moverSource(), "reassignDependents");
    const moveAt = body.indexOf("moveRef(tx");
    const histAt = body.indexOf("recordMoveHistory(tx");
    expect(moveAt).toBeGreaterThan(-1);
    expect(histAt).toBeGreaterThan(moveAt);
  });

  it("takes the rewritten objects from the UPDATE, not from a second query", () => {
    // After the UPDATE the rows carry the TARGET value, mixed in with rows
    // that already had it — the same reason #29.13's grant has to run first.
    // `RETURNING` is the only place that knows which rows this move touched.
    // Scoped to `moveRef`: asserted against the whole file this passed on the
    // import block and on any sibling that happened to mention the phrase.
    const body = functionBody(moverSource(), "moveRef");
    expect(body).toContain("RETURNING ${returning}");
    expect(body).toMatch(/sql\.identifier\(\s*versioned\.idColumn\.name\s*\)/);
    // …and the ids really come OUT of it. An adversarial round replaced the
    // whole expression with `[]` and the two assertions above stayed green:
    // the move then recorded nothing at all and reported `versions: 0` on
    // every list.
    expect(body).toMatch(/ids:\s*versioned[\s\S]{0,120}?rows\.map\(/);
  });

  it("passes the acting user to the history writer, and keeps the count", () => {
    const body = functionBody(moverSource(), "reassignDependents");
    expect(body).toMatch(
      /versions \+= await recordMoveHistory\(tx,\s*ref,\s*rewritten\.ids,\s*updatedBy\)/,
    );
    // …and the count reaches the caller. "900 moved" and "900 recorded" are
    // different facts; a mover that counted the second and dropped it on the
    // floor could not tell anyone they had diverged.
    expect(body).toContain("versions,");
  });

  it("stamps updated_by on every batch and records versions for the whole set", () => {
    // The stamp binds one parameter per id, so it is cut on the SAME boundary
    // the version writer uses — `batched` from the append module, not a second
    // constant that could drift from it. The version writer is handed the
    // whole set because it does its own cutting, which is what makes the bound
    // hold for its other callers too.
    const body = functionBody(writersSource(), "recordMoveHistory");
    expect(body).toMatch(/for \(const batch of batched\(unique\)\)/);
    expect(body).toContain("touchUpdatedBy(tx, batch, updatedBy)");
    expect(body).toContain("recordVersions(tx, unique, updatedBy)");
    // No second bound: one place decides how big a batch is.
    expect(body).not.toMatch(/const CHUNK/);
  });

  it("returns early for a ref that records nothing, rather than throwing", () => {
    // `WRITERS[undefined]` is a TypeError, and the three lists whose refs are
    // all unversioned — person-roles and the two relationship-role lists —
    // reach this function on every move. An adversarial round deleted the
    // `!versioned` half of the guard and nothing noticed.
    const body = functionBody(writersSource(), "recordMoveHistory");
    expect(body).toMatch(/if \(!versioned \|\| ids\.length === 0\) return 0;/);
  });

  it("de-duplicates and sorts the ids before taking any row lock", () => {
    // De-duplicate: a future ref holding several rows per object would
    // otherwise write the same `(object, version_number)` twice and take the
    // move down with a 23505. Sort: two administrators moving overlapping sets
    // would otherwise take the same row locks in `RETURNING` scan order, which
    // is whatever the planner chose — a deadlock nobody can reproduce.
    const body = functionBody(writersSource(), "recordMoveHistory");
    expect(body).toMatch(/new Set\(ids\)\]\.sort\(\)/);
  });

  it("stamps the ACTING user, never a constant and never an unconditional null", () => {
    // ⚠️ **Three mutations lived here.** An adversarial round replaced the
    // stamped value with a hardcoded address, then with an unconditional
    // `null`, then set `updatedBy: null` inside all four `insertVersions` —
    // and the suite stayed green through all three, because it only asserted
    // that an `inArray(...)` appeared somewhere. Attribution IS the slice, so
    // it is the value that is pinned now, not the statement's shape.
    const writers = code(writersSource());
    // Written through the caller's `tx`, never the global handle: a stamp
    // outside the move's transaction survives a rollback the moved rows do
    // not, and blocks against rows this same session already locked.
    expect(writers).not.toMatch(
      /\bdb\s*\n?\s*\.(select|insert|update|delete|execute|query)\b/,
    );
    // Every `set()` in the four writers is the parameter, shorthand, unaltered.
    const sets = writers.match(/\.set\(\{[^}]*\}\)/g) ?? [];
    expect(sets).toEqual([
      ".set({ updatedBy })",
      ".set({ updatedBy })",
      ".set({ updatedBy })",
      ".set({ updatedBy })",
    ]);
    // …and it arrives from the caller rather than being resolved again here.
    expect(writers).not.toContain("getCurrentUser");
  });

  it("maps each versioned entity to ITS OWN version writer", () => {
    // A swapped pair would push a judicial-shaped snapshot into
    // `person_version` for a natural person, and the suite noticed nothing.
    // Asserted as source text rather than by importing `WRITERS`, because this
    // module pulls a `pg.Pool` into whatever imports it.
    const writers = code(writersSource());
    for (const [key, fn] of [
      ["property", "recordPropertyVersionsIfChanged"],
      ["document", "recordDocumentVersionsIfChanged"],
      ["natural-person", "recordNaturalPersonVersionsIfChanged"],
      ["judicial-person", "recordJudicialPersonVersionsIfChanged"],
    ]) {
      // `""` is what `code()` leaves of a quoted key, so match the two person
      // entries by the writer that follows the previous entry instead.
      expect([key, new RegExp(`recordVersions:\\s*${fn},`).test(writers)])
        .toEqual([key, true]);
    }
    // The order of the four entries is the order of the four writers — which
    // is what a swap would break, and what the per-key check above cannot see.
    expect(writers.match(/recordVersions:\s*(\w+),/g)).toEqual([
      "recordVersions: recordPropertyVersionsIfChanged,",
      "recordVersions: recordDocumentVersionsIfChanged,",
      "recordVersions: recordNaturalPersonVersionsIfChanged,",
      "recordVersions: recordJudicialPersonVersionsIfChanged,",
    ]);
  });

  it("stamps the two person subtypes on person, where the column actually is", () => {
    // `natural_person` and `judicial_person` carry no `updated_by` at all. A
    // writer that skipped the stamp for them would leave exactly the stale
    // attribution this slice is about, on the two lists nobody would think to
    // check.
    const writers = code(writersSource());
    expect(writers).toMatch(/inArray\(property\.id,\s*ids\)/);
    expect(writers).toMatch(/inArray\(document\.id,\s*ids\)/);
    expect((writers.match(/inArray\(person\.id,\s*ids\)/g) ?? []).length).toBe(2);
    for (const t of ["naturalPerson", "judicialPerson"]) {
      expect([t, schemaBlock(t).includes('text("updated_by")')]).toEqual([t, false]);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. One comparison, not five copies of one
// ---------------------------------------------------------------------------

describe("the comparison the move makes is the one an edit makes", () => {
  /**
   * module path parts, update function, record function, version table, and
   * the readers the record function delegates its `tx` reads to.
   *
   * The readers are in the table because an adversarial round proved the
   * tx-only guard vacuous without them: every property/person read happens in
   * a `*FullsIn` helper, so a version of that guard scoped to the record
   * function alone stayed green with all of them switched to the global `db`
   * handle.
   */
  const ENTITIES: Array<[string[], string, string, string, string[]]> = [
    [
      ["lib", "properties", "queries.ts"],
      "updatePropertyIn",
      "recordPropertyVersionsIfChanged",
      "propertyVersion",
      ["propertyFullsIn"],
    ],
    [
      ["lib", "documents", "queries.ts"],
      "updateDocument",
      "recordDocumentVersionsIfChanged",
      "documentVersion",
      [],
    ],
    [
      ["lib", "persons", "queries.ts"],
      "updateNaturalPerson",
      "recordNaturalPersonVersionsIfChanged",
      "personVersion",
      ["personFullsIn", "latestPersonVersionsIn"],
    ],
    [
      ["lib", "judicial-persons", "queries.ts"],
      "updateJudicialPerson",
      "recordJudicialPersonVersionsIfChanged",
      "personVersion",
      ["judicialFullsIn"],
    ],
  ];

  it.each(ENTITIES)(
    "%s — the update path appends through the shared entry point",
    (parts, updateFn, recordFn, versionTable) => {
      const body = functionBody(read(...parts), updateFn);
      // The claim the slice makes is that a move leaves the trail an ordinary
      // edit leaves. That is only true while the edit and the move go through
      // the same function; an update path that inlines its own insert again is
      // a second copy of the rule, which is how the two start disagreeing.
      expect(body).toContain(`${recordFn}(`);
      expect(body).not.toContain(`insert(${versionTable})`);
    },
  );

  it.each(ENTITIES)(
    "%s — and that entry point is the shared append rule",
    (parts, _updateFn, recordFn) => {
      const body = functionBody(read(...parts), recordFn);
      expect(body).toContain("appendVersionsIfChanged");
      // The version row carries the acting user the port was handed — not
      // null, not a constant. An adversarial round set all four of these to
      // `null` and nothing in the suite noticed.
      expect(body).toMatch(/updatedBy:\s*by,/);
    },
  );

  it.each(ENTITIES)(
    "%s — every read on that path goes through the caller's tx",
    (parts, _updateFn, recordFn, _versionTable, readers) => {
      // The row these have to snapshot is one the caller's transaction has
      // written and not committed, so a read through the global `db` handle
      // returns the state the move was undoing and records it as the version
      // FOR the move. Slice #18.05 hit exactly this with
      // `getJudicialPersonById`.
      // ⚠️ Every verb, not just `select`. An adversarial round switched
      // `tx.insert(propertyVersion)` to `db.insert(...)` and a `select`-only
      // guard stayed green — a version row written outside the move's
      // transaction, which a rollback leaves disagreeing with its own rows.
      const source = read(...parts);
      const GLOBAL_HANDLE = /\bdb\s*\n?\s*\.(select|insert|update|delete|execute|query)\b/;
      for (const fn of [recordFn, ...readers]) {
        const body = functionBody(source, fn);
        expect([fn, GLOBAL_HANDLE.test(body)]).toEqual([fn, false]);
        expect([fn, /\btx\s*\n?\s*\.(select|selectDistinctOn|insert)\b/.test(body)])
          .toEqual([fn, true]);
      }
    },
  );

  it("still writes version 0 at creation, which is a different write", () => {
    // The guard above says the UPDATE path must not insert directly. The
    // CREATE path must — version 0 is the state at creation and there is no
    // previous snapshot to compare it with. Asserted so that "no direct
    // inserts" is never generalised into deleting it.
    expect(functionBody(read("lib", "properties", "queries.ts"), "createPropertyIn"))
      .toContain("insert(propertyVersion)");
    expect(functionBody(read("lib", "documents", "queries.ts"), "createDocument"))
      .toContain("insert(documentVersion)");
  });

  it("reads the newest version per object, not the oldest", () => {
    // DISTINCT ON keeps the FIRST row of each group, so the descending
    // `version_number` in the ORDER BY is the whole query. Without it every
    // object would be compared against its version 0 forever: a move would
    // write a version whose diff is the object's entire life, and an edit
    // would stop skipping no-ops.
    for (const [parts, , recordFn] of [
      [["lib", "properties", "queries.ts"], "", "recordPropertyVersionsIfChanged"],
      [["lib", "documents", "queries.ts"], "", "recordDocumentVersionsIfChanged"],
      [["lib", "persons", "queries.ts"], "", "latestPersonVersionsIn"],
    ] as Array<[string[], string, string]>) {
      const body = functionBody(read(...parts), recordFn);
      expect([recordFn, /selectDistinctOn\(/.test(body)]).toEqual([recordFn, true]);
      // POSITIONAL, not merely present. Postgres requires DISTINCT ON's
      // expressions to lead the ORDER BY, so `orderBy(desc(versionNumber), id)`
      // is a 42P10 at runtime — and an adversarial round showed a
      // presence-only guard passes on it.
      expect([
        recordFn,
        /orderBy\(\s*\w+\.(propertyId|documentId|personId),\s*desc\(\s*\w+\.versionNumber\s*\)/
          .test(body),
      ]).toEqual([recordFn, true]);
    }
  });
});
