/**
 * @jest-environment node
 */

/**
 * Slice #29.05 — deleting a value that is in use is a conversation.
 *
 * The two lists this file is really about are the two that behave unlike the
 * other seven, and both are unlike them in the database rather than in the
 * code:
 *
 *   • **document-types** is the ONE list Postgres protects on its own.
 *     `document.document_type_id` is NOT NULL with no `onDelete` clause, so the
 *     default "no action" refuses the delete. Everything the application does
 *     for this list has to agree with a refusal it did not author — and the
 *     protection is one line long and one edit away from being "tidied up"
 *     into an `onDelete: "set null"` that would compile, pass every test that
 *     existed before this file, and silently untype every document in the
 *     archive.
 *
 *   • **person-roles** is the worst case. FOUR inbound edges since Slice
 *     #34.04 (six until then): one CASCADE that deletes „Roluri pe Document"
 *     whitelist rows outright, and three SET NULL ones that blank the role tag
 *     on property_person, person_document and person_person. One unguarded
 *     click damages four tables, and none of the four is visible from the
 *     screen the click happens on. The two that went were
 *     `lookup_property_person_role` and `lookup_person_person_role`, each a
 *     UNIQUE NOT NULL FK to `lookup_person_role` and nothing else; migration_079
 *     made them `valid_for_property` / `valid_for_person` ON that row, and a
 *     column on the row being deleted is not an inbound edge.
 *
 * WHAT THIS FILE CAN AND CANNOT ASSERT
 *   It has no database. So it asserts the two halves that decide whether the
 *   conversation is possible at all: that the MAP matches the SCHEMA (each ref
 *   names the table its column actually belongs to, and the `enforcement` it
 *   claims is the one the schema declares), and that every key the dialog will
 *   ask next-intl for exists in BOTH locales. A missing Romanian key renders as
 *   a raw key path in the shipping locale — `DEFAULT_LOCALE` is `ro-RO` — which
 *   on this screen would be a delete confirmation reading
 *   "valueList.dependents.classes.documents".
 *
 *   The half it cannot reach — that a refusal really happens against live rows
 *   — is Adrian's, through the UI, and is named in the handover.
 *
 * SLICE #29.13 ADDED THREE MORE SECTIONS, AND THEY ARE ABOUT THE SAME FAILURE
 * ONE MODAL OVER.
 *   • The two relationship-role lists (§8) had their own screen, their own
 *     routes and a bare `db.delete` with no count, so deleting a role that
 *     forty associations carried blanked forty relationship tags and answered
 *     204. They are ordinary members of `VALID_LIST_KEYS` now, which is why
 *     most of what guards them is the loops above rather than §8 itself —
 *     what §8 pins is that the second write door is really gone.
 *   • The move is whitelist-aware (§9), so the sentence that used to ask the
 *     administrator to repair three other panels by hand is deleted. The
 *     order — grant, THEN move — is the whole guarantee, and it is pinned.
 *   • The sibling panels (§10) say their failures in Romanian and no longer
 *     have a delete with no `onError` at all.
 */

import fs from "fs";
import path from "path";
import { getTableName } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { LIST_META, VALID_LIST_KEYS, type ListKey } from "@/lib/admin/value-lists/config";
import {
  LIST_DEPENDENCIES,
  dependentNotes,
} from "@/lib/admin/value-lists/dependents";
import { isInUseBody, type InUseBody } from "@/lib/admin/value-lists/responses";
import { FAILURE_CODES } from "@/lib/admin/value-lists/failures";

const SRC = path.join(process.cwd(), "src");

function read(...parts: string[]): string {
  return fs.readFileSync(path.join(SRC, ...parts), "utf8");
}

function messages(locale: "ro-RO" | "en-GB"): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", `${locale}.json`), "utf8"),
  );
}

/** `valueList.dependents.classes.documents` → the string, or undefined. */
function at(obj: unknown, dotted: string): unknown {
  return dotted
    .split(".")
    .reduce<unknown>(
      (acc, k) =>
        typeof acc === "object" && acc !== null
          ? (acc as Record<string, unknown>)[k]
          : undefined,
      obj,
    );
}

/** The table a column belongs to, by name — the pairing the map could get wrong. */
function ownerTable(column: PgColumn): string {
  return getTableName(column.table);
}

/**
 * A file with comments and string bodies blanked.
 *
 * Hoisted out of `functionBody` by Slice #29.13, which needed it whole: the
 * sibling-panel guards below ask whether a component still renders
 * `err.message`, and that question has to be asked of the CODE — this file's
 * own comments say the phrase repeatedly, and a guard tripped by the sentence
 * explaining the fix is a guard that pushes the reasoning out of the codebase.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

/**
 * One exported function's body, comments and string bodies blanked.
 *
 * Same shape as `hard-delete-single-source.test.ts`'s helper and for the same
 * reason: a guard that reads the whole FILE passes on a comment, and passes on
 * a sibling function that happens to contain the phrase. An adversarial round
 * caught this file asserting `db.transaction` against all of queries.ts, where
 * `countDependents` alone would have kept it green with `deleteValue` rewritten
 * to no transaction at all.
 */
function functionBody(source: string, name: string): string {
  const stripped = code(source);
  const re = new RegExp(`^export async function ${name}\\(`, "m");
  const m = re.exec(stripped);
  if (!m) throw new Error(`${name} not found as a top-level export`);
  const rest = stripped.slice(m.index + 1);
  const end  = rest.search(/^export /m);
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
// 1. The map covers every list, and every ref points where it says
// ---------------------------------------------------------------------------

describe("the dependency map", () => {
  it("has one entry per list and no others", () => {
    expect(Object.keys(LIST_DEPENDENCIES).sort()).toEqual([...LISTS].sort());
  });

  it.each(LISTS)("%s — every column belongs to the table beside it", (list) => {
    const def = LIST_DEPENDENCIES[list];
    // A copy-pasted ref that names one table and another table's column would
    // otherwise produce a count of zero — a delete offered as safe on a row
    // that half the archive depends on.
    expect(ownerTable(def.idColumn)).toBe(getTableName(def.table));
    expect(def.refs.length).toBeGreaterThan(0);
    for (const ref of def.refs) {
      expect(ownerTable(ref.column)).toBe(getTableName(ref.table));
      for (const u of ref.uniqueWith ?? []) {
        expect(ownerTable(u)).toBe(getTableName(ref.table));
      }
    }
  });

  /**
   * ⚠️ **The file header's own arithmetic, as an assertion.** That paragraph
   * counts the foreign keys reaching the eleven lookup tables and splits them
   * by enforcement, and it is the first thing a reader checks against the
   * tree — it has now drifted twice, once when Slice #34.04 removed two refs
   * and once in the very edit that fixed the first drift. Nothing pinned it.
   * It does now: change the map and this fails with the numbers to write.
   */
  it("has the number of edges its own header claims", () => {
    const all = LISTS.flatMap((l) => LIST_DEPENDENCIES[l].refs);
    const by = (e: string) => all.filter((r) => r.enforcement === e).length;
    expect({
      total:      all.length,
      clears:     by("clears"),
      cascades:   by("cascades"),
      blocks:     by("blocks"),
      configured: all.filter((r) => r.configuration).length,
    }).toEqual({ total: 15, clears: 12, cascades: 2, blocks: 1, configured: 2 });
  });

  it("marks exactly the two whitelist edges as configuration", () => {
    // A configuration ref does not block a delete and is never moved. Getting
    // this set wrong in either direction is a real failure: too wide and a
    // delete silently blanks real associations, too narrow and a role ticked
    // in a panel can never be deleted.
    const configuration = LISTS.flatMap((l) =>
      LIST_DEPENDENCIES[l].refs
        .filter((r) => r.configuration)
        .map((r) => `${l}:${getTableName(r.table)}.${r.column.name}`),
    ).sort();
    expect(configuration).toEqual(
      [
        // Slice #34.04: two of the four are gone. The document-type junction
        // does NOT collapse — it is unique over the PAIR — so both of its
        // halves stay.
        "document-types:lookup_doc_type_person_role.document_type_id",
        "person-roles:lookup_doc_type_person_role.person_role_id",
      ].sort(),
    );
    // Everything with a UNIQUE constraint over the moved column is in that
    // set — otherwise `moveRef` would eventually hit a 23505 it no longer
    // guards against.
    for (const list of LISTS) {
      for (const ref of LIST_DEPENDENCIES[list].refs) {
        if (ref.uniqueWith) expect(ref.configuration).toBe(true);
      }
    }
  });

  /**
   * ⚠️ **This test used to say the OPPOSITE, and the inversion is the slice.**
   *                                                            (Slice #34.03)
   * It read "matches on the id everywhere except tarla, which has no foreign
   * key", and asserted `def.source.name === "indicativ"` and
   * `refs[0].column.name === "tarla_sola"` for that one list. migration_078
   * made `property.tarla_id` a real FK, so `source` is deleted from
   * `ListDependencies` entirely — a hook whose only possible value had become
   * `idColumn` — and `matchesByValue`, `siblingsSharingValue` and the
   * `ambiguous-value` refusal went with it.
   *
   * Kept rather than deleted, pointing the other way: this is the test that
   * fails the day somebody reintroduces a value-matched list, which is what a
   * second `tarla` would be.
   */
  it("matches on the id, on every list, with no exception left", () => {
    for (const list of LISTS) {
      for (const ref of LIST_DEPENDENCIES[list].refs) {
        // Not a proof that the column IS an FK — the schema is where that
        // lives — but every dependent column in this map is now an id column,
        // and a text one would stand out here.
        expect(ref.column.name).toMatch(/_id$/);
      }
    }
    expect(LIST_DEPENDENCIES.tarla.refs[0].column.name).toBe("tarla_id");
  });

  it("has no `source` field left to disagree with `idColumn`", () => {
    for (const list of LISTS) {
      expect(
        (LIST_DEPENDENCIES[list] as Record<string, unknown>).source,
      ).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// 2. document-types — the one the database refuses on its own
// ---------------------------------------------------------------------------

describe("document-types", () => {
  const def = LIST_DEPENDENCIES["document-types"];

  it("counts documents, and records that Postgres blocks that edge", () => {
    const docs = def.refs.find((r) => r.labelKey === "documents");
    expect(docs).toBeDefined();
    expect(getTableName(docs!.table)).toBe("document");
    expect(docs!.column.name).toBe("document_type_id");
    expect(docs!.enforcement).toBe("blocks");
    // Documents are objects, not configuration: they block, and the move is
    // offered for them.
    expect(docs!.configuration).toBeUndefined();
  });

  it("and the schema really still blocks it", () => {
    // The claim above is only true while the FK carries NO onDelete clause.
    // An `onDelete: "set null"` added here would compile and would untype
    // every document of the deleted type; `"cascade"` would delete them.
    const block = schemaBlock("document");
    expect(block).toMatch(/\.references\(\(\)\s*=>\s*lookupDocumentType\.id\)/);
    expect(block).not.toMatch(/lookupDocumentType\.id,\s*\{\s*onDelete/);
  });

  it("also counts the Document Persons whitelist, which would cascade away", () => {
    const wl = def.refs.find((r) => r.labelKey === "docTypePersonRoleWhitelist");
    expect(wl).toBeDefined();
    expect(getTableName(wl!.table)).toBe("lookup_doc_type_person_role");
    expect(wl!.enforcement).toBe("cascades");
    expect(wl!.configuration).toBe(true);
    // Unique on (document_type_id, person_role_id): a re-point onto a type
    // that already whitelists the same role is a 23505 unless the collider is
    // deleted first.
    expect(wl!.uniqueWith?.map((c) => c.name)).toEqual(["person_role_id"]);
  });
});

// ---------------------------------------------------------------------------
// 3. person-roles — four edges, one of them cascades
// ---------------------------------------------------------------------------

describe("person-roles", () => {
  const def = LIST_DEPENDENCIES["person-roles"];

  it("lists all four inbound edges", () => {
    // ⚠️ **Six until Slice #34.04.** `lookup_property_person_role` and
    // `lookup_person_person_role` were each a UNIQUE NOT NULL FK to
    // `lookup_person_role` and a `created_at` — one bit per role — and
    // migration_079 made them booleans ON that row. A column on the row being
    // deleted is not an inbound edge and cannot be counted, which is the one
    // fact the collapse cost the delete dialog. See `configuration` in
    // dependents.ts.
    expect(def.refs.map((r) => getTableName(r.table)).sort()).toEqual(
      [
        "lookup_doc_type_person_role",
        "person_document",
        "person_person",
        "property_person",
      ].sort(),
    );
  });

  it("marks the one that would cascade and the three that would be blanked", () => {
    const byTable = Object.fromEntries(
      def.refs.map((r) => [getTableName(r.table), r]),
    );
    for (const t of [
      "lookup_doc_type_person_role",
    ]) {
      expect(byTable[t].enforcement).toBe("cascades");
      // ⚠️ **Configuration, so it is disclosed and never blocks.** The first
      // draft counted these as dependents, which made a role ticked in one
      // panel and used by nothing undeletable — and offered, as the only
      // remedy, a "move" that would have handed another role that panel's
      // eligibility. See `configuration` in dependents.ts.
      expect(byTable[t].configuration).toBe(true);
      // Every whitelist is UNIQUE over the role column (alone, or with one
      // other) — the mechanical half of why a move is not available.
      expect(byTable[t].uniqueWith).toBeDefined();
    }
    for (const t of ["property_person", "person_document", "person_person"]) {
      expect(byTable[t].enforcement).toBe("clears");
      expect(byTable[t].configuration).toBeUndefined();
      expect(byTable[t].uniqueWith).toBeUndefined();
    }
  });

  it("and the schema declares exactly those four behaviours", () => {
    const cases: Array<[string, "cascade" | "set null"]> = [
      ["lookupDocTypePersonRole",  "cascade"],
      ["propertyPerson",           "set null"],
      ["personDocument",           "set null"],
      ["personPerson",             "set null"],
    ];
    for (const [constName, onDelete] of cases) {
      const block = schemaBlock(constName);
      expect(block).toMatch(
        new RegExp(
          `references\\(\\(\\)\\s*=>\\s*lookupPersonRole\\.id,\\s*\\{\\s*onDelete:\\s*"${onDelete}"`,
        ),
      );
    }
  });

  it("has no version-history note, because no snapshot carries a role", () => {
    // Person, property and document snapshots hold own fields and addresses;
    // role tags live on the junction rows, which ARE counted above. Claiming
    // an uncounted class here would be as wrong as omitting a real one.
    expect(def.snapshot).toBeUndefined();
    expect(dependentNotes("person-roles")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. The notes say exactly what the count cannot see
// ---------------------------------------------------------------------------

describe("what the count does not cover", () => {
  it.each(LISTS.filter((l) => LIST_DEPENDENCIES[l].snapshot !== undefined))(
    "%s — the snapshot really carries the value, so the note is printed",
    (list) => {
      const snap = LIST_DEPENDENCIES[list].snapshot!;
      // Derived, not asserted, in the source: `dependentNotes` looks the field
      // up in the registry array at runtime. This is the other direction — the
      // field IS there today — so the day a snapshot stops carrying it, this
      // test fails rather than the sentence quietly disappearing.
      expect(snap.keys).toContain(snap.field);
      expect(dependentNotes(list)).toContain("versionSnapshots");
    },
  );

  it("tarla says what every other list says, and nothing extra", () => {
    // Slice #34.03: this asserted `["tarlaFreeText", "versionSnapshots"]`.
    // `tarlaFreeText` told the administrator that "properties do not hold a
    // link to the tarla code, they hold its text" — true until migration_078
    // and false after it, so the note and both locales' sentence for it are
    // deleted. What is left is the derived one, which every list with a
    // snapshot gets.
    expect(dependentNotes("tarla")).toEqual(["versionSnapshots"]);
  });

  /**
   * ⚠️ **THE NOTE ONCE TOLD THE ADMINISTRATOR THE OPPOSITE OF WHAT THE CODE
   * DOES, IN BOTH LOCALES, FOR FIVE SLICES.**                (Slice #34.01)
   *
   * `versionSnapshots` ended "…and moving does not create a new version" /
   * "…iar mutarea nu creează o versiune nouă". Since Slice #29.14 a move DOES
   * write one version row per object it changes — `reassignDependents` calls
   * `recordMoveHistory` inside the move's own transaction, and
   * ../lib/admin/value-lists/move-history.ts says it in as many words: "ONE
   * VERSION ROW PER OBJECT … Moving forty properties writes forty version
   * rows."
   *
   * The behaviour is the one #29.14 chose on purpose, so #34.01 corrected the
   * sentence rather than the code. This guard pins the clause that was false
   * OUT rather than pinning a new wording in: it survives any later rewrite of
   * the note, and it fails the day somebody reverts to the old sentence or
   * writes the same claim afresh.
   */
  it.each([
    ["en-GB", "moving does not create a new version"],
    ["ro-RO", "mutarea nu creează o versiune nouă"],
  ] as const)(
    "%s: the note does not claim a move leaves history alone (Slice #29.14 made that false)",
    (locale, falseClause) => {
      const note = String(
        at(messages(locale), "valueList.dependents.notes.versionSnapshots"),
      );
      expect(`${locale}: ${note.includes(falseClause)}`).toBe(`${locale}: false`);
    },
  );
});

// ---------------------------------------------------------------------------
// 5. Every key the dialog asks for exists — in Romanian first
// ---------------------------------------------------------------------------

describe("the confirmation has words for everything it can say", () => {
  const ro = messages("ro-RO");
  const en = messages("en-GB");

  const labelKeys = [
    ...new Set(LISTS.flatMap((l) => LIST_DEPENDENCIES[l].refs.map((r) => r.labelKey))),
  ];
  const noteKeys = [...new Set(LISTS.flatMap((l) => dependentNotes(l)))];

  it.each(labelKeys)("dependents.classes.%s", (labelKey) => {
    for (const [locale, m] of [["ro-RO", ro], ["en-GB", en]] as const) {
      const value = at(m, `valueList.dependents.classes.${labelKey}`);
      expect(`${locale}: ${typeof value}`).toBe(`${locale}: string`);
      // Every class label is rendered with a count, so every one of them has
      // to be a plural message — a bare noun would print "documente" beside no
      // number at all.
      expect(String(value)).toContain("{count, plural,");
    }
  });

  it.each(noteKeys)("dependents.notes.%s", (noteKey) => {
    expect(typeof at(ro, `valueList.dependents.notes.${noteKey}`)).toBe("string");
    expect(typeof at(en, `valueList.dependents.notes.${noteKey}`)).toBe("string");
  });

  it.each([
    "title",
    "checking",
    "checkFailed",
    "deleteBody",
    "inUse",
    "moveTo",
    "selectTarget",
    "move",
    "moving",
    "moved",
    "noTarget",
    "removedWithRow",
    "roleWhitelistGranted",
    "delete",
    "deleting",
    "cancel",
  ])("confirm.%s", (key) => {
    expect(typeof at(ro, `valueList.confirm.${key}`)).toBe("string");
    expect(typeof at(en, `valueList.confirm.${key}`)).toBe("string");
  });

  it.each(FAILURE_CODES)("confirm.errors.%s", (codeKey) => {
    // ⚠️ **Iterated from the exported ARRAY, not from a hand-written copy.**
    // A seventh `FailureCode` added without a message ships the raw key path
    // to `tErr(...)` on a Romanian-only screen — the exact failure the four
    // screens that read `failures.ts` exist to prevent. A list written out
    // here would not have contained it.                         (Slice #29.13)
    expect(typeof at(ro, `valueList.confirm.errors.${codeKey}`)).toBe("string");
    expect(typeof at(en, `valueList.confirm.errors.${codeKey}`)).toBe("string");
  });

  it("no longer carries the note only the query could add", () => {
    // ⚠️ **This test is INVERTED, not deleted.**              (Slice #34.03)
    // It pinned `duplicateValue`, which `buildReport` appended when a second
    // row of the same list carried the same value — a thing only the database
    // could know, so the loop above could never reach it. That branch went
    // with `siblingsSharingValue`, and a sentence in both locales that nothing
    // can print is exactly the dead i18n this file exists to catch. Asserting
    // its ABSENCE is what stops it being re-added by a merge.
    expect(at(ro, "valueList.dependents.notes.duplicateValue")).toBeUndefined();
    expect(at(en, "valueList.dependents.notes.duplicateValue")).toBeUndefined();
    expect(at(ro, "valueList.dependents.notes.tarlaFreeText")).toBeUndefined();
    expect(at(en, "valueList.dependents.notes.tarlaFreeText")).toBeUndefined();
    const q = read("lib", "admin", "value-lists", "queries.ts");
    expect(q).not.toContain('notes.push("duplicateValue")');
    expect(q).not.toContain("siblingsSharingValue(");
  });

  it("no longer promises to blank the properties of a deleted type", () => {
    // `confirm.deletePropertyTypeUsed` said "La ștergere, tipul acestora va fi
    // eliminat. Continuați?" — true while the delete was allowed to SET NULL
    // the properties, and false the moment the delete is refused instead. A
    // string that describes the old behaviour is worse than a missing one.
    expect(at(ro, "valueList.confirm.deletePropertyTypeUsed")).toBeUndefined();
    expect(at(en, "valueList.confirm.deletePropertyTypeUsed")).toBeUndefined();
    expect(read("app", "admin", "value-lists", "_components", "value-list-modal.tsx"))
      .not.toContain("deletePropertyTypeUsed");
  });
});

// ---------------------------------------------------------------------------
// 6. A refusal a client can branch on
// ---------------------------------------------------------------------------

describe("the 409 body", () => {
  const good: InUseBody = {
    error: "Reference data value is in use",
    code: "IN_USE",
    total: 3,
    dependents: [{ labelKey: "documents", count: 3 }],
    removedWithRow: [{ labelKey: "docTypePersonRoleWhitelist", count: 1 }],
    notes: ["versionSnapshots"],
  };

  it("is recognised", () => {
    expect(isInUseBody(good)).toBe(true);
    expect(isInUseBody({ ...good, dependents: [], removedWithRow: [], notes: [] })).toBe(true);
  });

  it.each([
    ["null", null],
    ["a string", "IN_USE"],
    ["an empty object", {}],
    ["another error", { error: "Not found" }],
    ["a missing total", { ...good, total: undefined }],
    ["a malformed dependent", { ...good, dependents: [{ labelKey: "documents" }] }],
    ["a missing removedWithRow", { ...good, removedWithRow: undefined }],
    ["notes that are not strings", { ...good, notes: [{}] }],
  ])("rejects %s", (_label, value) => {
    // The dialog reads `.dependents.map` off this. A guard that merely checked
    // the status code would blank the screen on a proxy's HTML error page.
    expect(isInUseBody(value)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. The refusal is where the code says it is
// ---------------------------------------------------------------------------

describe("the delete path", () => {
  it("counts and deletes inside one transaction, under a row lock", () => {
    const source = read("lib", "admin", "value-lists", "queries.ts");
    const body = functionBody(source, "deleteValue");
    // Scoped to `deleteValue`: asserted against the whole file, this passed
    // while `countDependents` alone opened a transaction — which is the
    // regression the sentence describes, kept green by a sibling.
    expect(body).toContain("db.transaction");
    // The `true` is the lock. FOR UPDATE conflicts with the FOR KEY SHARE that
    // Postgres' own referential-integrity check takes before allowing an
    // insert that references the row, which is what stops a document being
    // created for this type between the count and the DELETE.
    // Slice #34.03 renamed the helper: `sourceValue` returned "the value a
    // dependent would be carrying", which on `tarla` was the indicativ TEXT.
    // Every list is keyed on its id now, so it is `lookupRowId`.
    expect(body).toMatch(/lookupRowId\(tx, def, id, true\)/);
    // …and the lock itself, which lives in that helper. Not scoped, because
    // `lookupRowId` is not exported; nothing else in the file takes one.
    expect(source).toContain('.for("update")');
  });

  it("answers a refusal with the same body whether it came from the check or from Postgres", () => {
    const route = read("app", "api", "admin", "value-lists", "[list]", "[id]", "route.ts");
    expect(route).toContain("inUseResponse(");
    // 23503 is the race the pre-check is written to make unreachable. If it
    // ever happens, the user gets the refusal, not a constraint name.
    expect(route).toContain('pgErrorCode(err) === "23503"');
    // 23503 is the race the pre-check is written to make unreachable. If it
    // ever happens the delete is RE-RUN — not recounted and guessed at, which
    // is how an earlier version could answer 409 with a total of zero, i.e. an
    // error path ending in an enabled delete button.
    expect(route).toContain("deleteValue(list, id).catch");
  });

  it("answers a non-uuid id with 404 rather than a 500", () => {
    // `eq(idColumn, "abc")` reaches Postgres as `id = 'abc'` and comes back as
    // 22P02, which `dbErrorToResponse` does not know — so before this guard
    // every mistyped path segment was an Internal Server Error.
    for (const parts of [
      ["app", "api", "admin", "value-lists", "[list]", "[id]", "route.ts"],
      ["app", "api", "admin", "value-lists", "[list]", "[id]", "dependents", "route.ts"],
      ["app", "api", "admin", "value-lists", "[list]", "[id]", "reassign", "route.ts"],
    ]) {
      expect(read(...parts)).toContain("isUuid(id)");
    }
  });
});

// ---------------------------------------------------------------------------
// 8. The two lists #29.05 could not reach                       (Slice #29.13)
// ---------------------------------------------------------------------------

describe("the relationship-role lists", () => {
  /** list key, schema const, table name, dependent-class label, lookup const. */
  const RELATIONSHIP_LISTS: Array<[ListKey, string, string, string, string]> = [
    ["property-property-roles", "propertyProperty", "property_property",
     "propertyProperties", "lookupPropertyPropertyRole"],
    ["document-document-roles", "documentDocument", "document_document",
     "documentDocuments", "lookupDocumentDocumentRole"],
  ];

  it("are ordinary members of the list, not a second mechanism", () => {
    // The whole point of the decision this slice records: they inherit the
    // refusal, the count and the offer by BEING in `VALID_LIST_KEYS`, so a
    // guard written for the nine cannot be true of nine and false of these.
    for (const [list] of RELATIONSHIP_LISTS) {
      expect([list, LISTS.includes(list)]).toEqual([list, true]);
      expect([list, list in LIST_DEPENDENCIES]).toEqual([list, true]);
    }
  });

  it.each(RELATIONSHIP_LISTS)(
    "%s — counts the associations that carry the role",
    (list, _const, tableName, labelKey) => {
      const def = LIST_DEPENDENCIES[list];
      expect(def.refs).toHaveLength(1);
      const ref = def.refs[0];
      expect(getTableName(ref.table)).toBe(tableName);
      expect(ref.column.name).toBe("relationship_role_id");
      expect(ref.labelKey).toBe(labelKey);
      // SET NULL: the association keeps its row and loses its label. Nothing
      // in the database refuses, which is why the refusal is written in code.
      expect(ref.enforcement).toBe("clears");
      // These are associations between real objects, not the row's own
      // configuration: they block, and the move is offered for them.
      expect(ref.configuration).toBeUndefined();
      expect(ref.uniqueWith).toBeUndefined();
    },
  );

  it.each(RELATIONSHIP_LISTS)(
    "%s — and the schema really still clears rather than cascades",
    (_list, constName, _tableName, _labelKey, lookupConst) => {
      // An `onDelete: "cascade"` here would DELETE the associations instead of
      // blanking their tag — a worse failure than the one this slice fixes,
      // and one line away.
      const block = schemaBlock(constName);
      expect(block).toMatch(
        new RegExp(
          `references\\(\\(\\)\\s*=>\\s*${lookupConst}\\.id,\\s*\\{\\s*onDelete:\\s*"set null"`,
        ),
      );
    },
  );

  it("have no version-history note, because no snapshot carries a relationship", () => {
    // A relationship role lives on the JUNCTION row, exactly as a person role
    // does; the property and document snapshots hold own fields and addresses.
    // Claiming an uncounted class would be as wrong as omitting a real one.
    for (const [list] of RELATIONSHIP_LISTS) {
      expect([list, LIST_DEPENDENCIES[list].snapshot]).toEqual([list, undefined]);
      expect([list, dependentNotes(list)]).toEqual([list, []]);
    }
  });

  it("have exactly one write door, and it is the guarded one", () => {
    // ⚠️ **The bug this slice fixes was a SECOND door, not a missing guard.**
    // Their own modal deleted through /api/admin/<list>/[id], which never
    // counted anything — so the refusal built in #29.05 sat one modal away
    // from a route that would blank forty relationship tags and answer 204.
    // Both `[id]` routes are gone; what is left is read-only.
    for (const dir of ["property-property-roles", "document-document-roles"]) {
      expect(fs.existsSync(path.join(SRC, "app", "api", "admin", dir, "[id]"))).toBe(false);
      const route = read("app", "api", "admin", dir, "route.ts");
      // Every write verb, not just the two that were on the collection: what
      // was actually deleted was a PATCH and a DELETE, and re-adding either to
      // the collection route would be the second door back.
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        expect([`${dir}:${method}`, new RegExp(`export async function ${method}\\b`).test(route)])
          .toEqual([`${dir}:${method}`, false]);
      }
      // …and the reader stays, because the association screen's dropdown is
      // its consumer.
      expect([dir, /export async function GET/.test(route)]).toEqual([dir, true]);
    }
  });

  it("open the generic modal from the hub, and their own modals are gone", () => {
    const hub = read("app", "admin", "value-lists", "_components", "value-list-hub.tsx");
    expect(hub).toContain('open("property-property-roles")');
    expect(hub).toContain('open("document-document-roles")');
    for (const f of ["property-property-modal.tsx", "document-document-modal.tsx"]) {
      expect([f, fs.existsSync(path.join(SRC, "app", "admin", "value-lists", "_components", f))])
        .toEqual([f, false]);
    }
    // The dead namespaces went with them: a key that names a screen nobody can
    // open is the same class of lie as a note that outlived its fact.
    for (const m of [messages("ro-RO"), messages("en-GB")]) {
      expect(at(m, "valueList.propertyPropertyRoles")).toBeUndefined();
      expect(at(m, "valueList.documentDocumentRoles")).toBeUndefined();
    }
  });

  it("and the modal has words for their titles and their dependents", () => {
    // `LIST_META[...].titleKey` is rendered as `lists.<titleKey>`; a missing
    // one prints the raw key path as the dialog heading in the shipping
    // locale.
    for (const [list, , , labelKey] of RELATIONSHIP_LISTS) {
      const meta = LIST_META[list];
      for (const [locale, m] of [["ro-RO", messages("ro-RO")], ["en-GB", messages("en-GB")]] as const) {
        expect(`${locale}:${typeof at(m, `valueList.lists.${meta.titleKey}`)}`).toBe(`${locale}:string`);
        expect(`${locale}:${typeof at(m, `valueList.dependents.classes.${labelKey}`)}`).toBe(`${locale}:string`);
      }
      // Every editable field the generic form will render needs a label —
      // asserted, not asserted-in-a-comment: the form prints
      // `t(\`fields.${labelKey}\`)` for each one.
      expect(meta.fields.map((f) => f.key)).toEqual(["name", "description"]);
      for (const f of meta.fields) {
        for (const [locale, m] of [["ro-RO", messages("ro-RO")], ["en-GB", messages("en-GB")]] as const) {
          expect(`${locale}:${f.key}:${typeof at(m, `valueList.fields.${f.labelKey}`)}`)
            .toBe(`${locale}:${f.key}:string`);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 9. The move is whitelist-aware, and the note that stood in for it is gone
// ---------------------------------------------------------------------------

describe("moving person-role associations", () => {
  it("is the only list that grants anything, and it declares it", () => {
    // Declared on the entry rather than branched on inside the mover: a second
    // whitelisted list would be a field here, not a second `if (list === …)`.
    const granting = LISTS.filter((l) => LIST_DEPENDENCIES[l].grantWhitelists !== undefined);
    expect(granting).toEqual(["person-roles"]);
  });

  it("grants BEFORE the rows move, or it cannot tell which rows moved", () => {
    // `grantPersonRoleWhitelists` decides what to grant by asking whether any
    // rows still carry the SOURCE value. After `moveRef` they carry the
    // target's, mixed in with rows that were already there, and the question
    // stops being answerable — so the order is the guarantee, exactly as it is
    // for reading page file paths before deleting a document.
    const body = functionBody(
      read("lib", "admin", "value-lists", "queries.ts"),
      "reassignDependents",
    );
    const grantAt = body.indexOf("grantWhitelists(tx");
    const moveAt  = body.indexOf("moveRef(tx");
    expect(grantAt).toBeGreaterThan(-1);
    expect(moveAt).toBeGreaterThan(-1);
    expect(grantAt).toBeLessThan(moveAt);
  });

  it("never grants a tick for a bare tick — only where real rows carry the role", () => {
    // ⚠️ **The distinction #29.05's `configuration` flag exists to hold.** An
    // adversarial round killed the version of this that MOVED whitelist rows,
    // because a role ticked in one panel and used by no association at all
    // would have handed the target an eligibility nobody asked for. This
    // module answers a different question: are real ASSOCIATIONS about to land
    // on the target? So the gate is always an association table…
    const grant = code(read("lib", "admin", "value-lists", "role-whitelists.ts"));
    // ⚠️ **The COMPARISON, not the identifier.** An adversarial round pointed
    // out that `grant.includes("propertyPerson")` is satisfied by the import
    // block: every gate could be deleted and the guard would stay green.
    for (const gate of [
      "propertyPerson.personRoleId",
      "personPerson.relationshipRoleId",
      "personDocument.personRoleId",
    ]) {
      expect([gate, new RegExp(`eq\\(\\s*${gate.replace(".", "\\.")},\\s*fromRoleId`).test(grant)])
        .toEqual([gate, true]);
    }
    // …and the SOURCE role's own ticks are never read. This is the assertion
    // that fails if someone "improves" the module into mirroring the ticks the
    // deleted role happened to have. Slice #34.04: two of the three whitelists
    // are columns on `lookup_person_role` now, so the shape to forbid is any
    // comparison of one of ITS columns against `fromRoleId`.
    expect(/lookupDocTypePersonRole\.personRoleId,\s*fromRoleId/.test(grant)).toBe(false);
    expect(/lookupPersonRole\.\w+,\s*fromRoleId/.test(grant)).toBe(false);
    // Idempotent: the target may already be ticked, and a 23505 there would
    // roll back a move the user asked for. One insert left — the two grants
    // that were inserts are conditional UPDATEs now, asserted below.
    expect((grant.match(/onConflictDoNothing\(\)/g) ?? [])).toHaveLength(1);
  });

  it("counts a tick as granted only when it really flipped", () => {
    // ⚠️ **The flag test in each WHERE is what `onConflictDoNothing()` used to
    // buy, and `granted` is a lie without it.** (Slice #34.04) The
    // insert version returned NO ROW when the target was already ticked, so
    // that panel contributed nothing to the list the dialog prints — "nothing
    // changed there", said by saying nothing. A bare
    // `.set({ validForProperty: true })` matches the target row every time and
    // would report a grant the move did not make.
    const grant = code(read("lib", "admin", "value-lists", "role-whitelists.ts"));
    for (const col of ["validForProperty", "validForPerson"]) {
      expect([col, new RegExp(`\\.set\\(\\{ ${col}: true \\}\\)`).test(grant)])
        .toEqual([col, true]);
      // ⚠️ **`IS NOT TRUE`, and `= false` must NOT come back.** An adversarial
      // round pointed out that a nullable copy of the column is reachable —
      // `supabase_repair_missing_tables.sql` says so itself — and against NULL
      // `= false` is UNKNOWN, so the UPDATE matches nothing, `granted` stays
      // empty, no warning fires, and the moved rows land on a role no screen
      // will offer. Both halves are asserted: the right predicate present, the
      // wrong one absent.
      expect([col, new RegExp(`\\$\\{lookupPersonRole\\.${col}\\} IS NOT TRUE`).test(grant)])
        .toEqual([col, true]);
      expect([col, new RegExp(`eq\\(lookupPersonRole\\.${col}, false\\)`).test(grant)])
        .toEqual([col, false]);
    }
    // Both are scoped to the TARGET row, or the move would tick every role.
    expect((grant.match(/eq\(lookupPersonRole\.id, toRoleId\)/g) ?? [])).toHaveLength(2);
  });

  it("tops up a whitelist that exists and never creates one", () => {
    // ⚠️ **AN ADVERSARIAL ROUND FOUND THE FIRST VERSION TAKING ELIGIBILITY
    // AWAY, WHICH IS THE OPPOSITE OF WHAT IT WAS FOR.**
    // `listPersonRolesForDocument` USED TO fall back to every role ticked for
    // SOME type when the document's own type had NO rows in
    // `lookup_doc_type_person_role`. Insert one row for such a type and the
    // fallback stopped running: the picker collapsed from that whole set to the
    // single role the move granted.
    //
    // ⚠️ **SLICE #34.16 REMOVED THAT FALLBACK (D-16(b)), SO THE COLLAPSE
    // ARGUMENT ABOVE NO LONGER APPLIES — AND THE FILTER IS STILL RIGHT, FOR A
    // BIGGER REASON.** `lookup_doc_type_person_role` is EMPTY: 48 document
    // types, 48 with no ticks, measured the day #34.16 shipped. So there is no
    // whitelist here to top up, and a filter removed on that data would make an
    // administrator RENAMING a role the thing that first configures a document
    // type. These assertions are not a description waiting to be deleted; they
    // pin the module header's promise — a top-up, never a creation — which is
    // the promise that keeps value-list edits out of the configuration
    // business.
    const grant = code(read("lib", "admin", "value-lists", "role-whitelists.ts"));
    expect(grant).toContain("inArray(");
    expect(grant).toMatch(
      /selectDistinct\(\{\s*documentTypeId:\s*lookupDocTypePersonRole\.documentTypeId/,
    );
    // ⚠️ **The FILTER is the line that does the work**, and an adversarial
    // round removed it and watched the three assertions above stay green.
    expect(grant).toMatch(/\.filter\(\(t\) => needed\.has\(t\.documentTypeId\)\)/);
    // `.values([])` is a syntax error rather than an empty write, and the
    // filter above can empty the array.
    expect(grant).toMatch(/values\.length > 0/);
  });

  it("and the fallback that made the top-up rule necessary is gone, on purpose", () => {
    // ⚠️ **THIS TEST GOT THE ANSWER IT ASKED FOR, AND IT IS WORTH SAYING SO
    // RATHER THAN JUST FLIPPING IT.** Until Slice #34.16 this asserted that
    // `listPersonRolesForDocument` really still fell back — "derived rather
    // than asserted, in the direction that can rot: the day it stops falling
    // back, the rule above becomes unnecessary caution instead of a fix, and
    // this test is where that gets noticed". Decision D-16(b) is that day. The
    // assertion is inverted rather than deleted so the claim keeps living in
    // ONE place: a suite that asserted the fallback exists and a suite that
    // asserted it does not would be the #34.08 failure — two suites disagreeing
    // about one fact, each green on its own.
    const body = functionBody(read("lib", "documents", "queries.ts"), "listPersonRolesForDocument");
    expect(body).not.toMatch(/rows\.length/);
    expect(body).not.toContain("selectDistinct");
    expect(body).toContain("return listPersonRolesForDocumentType(doc.documentTypeId);");

    // ⚠️ **THE CONSEQUENCE FOR THE MODULE ABOVE IS NOT ASSERTED HERE, AND THAT
    // IS DELIBERATE.** With one answer everywhere, an unconfigured type offers
    // nothing, so a row inserted for it can no longer collapse an offer. That
    // is not a licence to remove the filter: on an archive whose junction table
    // is empty — which this one is — removing it would let a role rename write
    // a document type's first configuration. `role-whitelists.ts` argues both
    // halves in its own header; a `toContain` on that prose would be a guard
    // that reads comments, which this file's own `code()` helper exists to
    // prevent.
  });

  it("scopes the Document Persons tick to the types that actually moved", () => {
    // `lookup_doc_type_person_role` is unique over (document_type_id,
    // person_role_id) and the document-side dropdown filters by the DOCUMENT'S
    // type. A tick for one arbitrary type would satisfy the person-side
    // distinct-roles list and still leave the role unselectable on the
    // document itself.
    const grant = code(read("lib", "admin", "value-lists", "role-whitelists.ts"));
    expect(grant).toContain("selectDistinct");
    expect(grant).toMatch(/innerJoin\(\s*document,/);
    // ⚠️ **One row per moved type.** The two assertions above are satisfied by
    // an implementation that runs the same query and then inserts a single row
    // for `types[0]` — which is the "one arbitrary type" the comment rejects.
    expect(grant).toMatch(
      /\.map\(\(t\) => \(\{\s*documentTypeId: t\.documentTypeId,\s*personRoleId: toRoleId\s*\}\)\)/,
    );
  });

  it("reports what it granted, all the way to the screen", () => {
    // Configuration the user did not ask for by name. #29.05's rule for the
    // cascade — "always said out loud, because it disappears without anyone
    // requesting it" — is the same rule in the other direction.
    expect(read("app", "api", "admin", "value-lists", "[list]", "[id]", "reassign", "route.ts"))
      .toContain("granted:  outcome.granted");
    const modal = read("app", "admin", "value-lists", "_components", "value-list-modal.tsx");
    expect(modal).toContain("confirm.roleWhitelistGranted");
    expect(modal).toContain("setGranted(res.granted ?? [])");
  });

  it("says so when it CANNOT grant the tick, instead of leaving it unsaid", () => {
    // ⚠️ **The case the top-up rule cannot repair, and an adversarial round is
    // why it is reported rather than assumed away.** Every document type the
    // filter above SKIPS is one on which the moved rows now carry a role no
    // picker offers. Silence there would have been the old
    // `roleWhitelistNote`'s failure with the note deleted.
    //
    // ⚠️ **THE THIRD PLACE THIS CLAIM LIVED, AND SLICE #34.16 ALMOST LEFT IT
    // BEHIND.** This comment used to open „the fallback in
    // `listPersonRolesForDocument` is not 'every role' — it is every role
    // ticked for SOME type — so when every moved type is unconfigured AND the
    // target is ticked nowhere…". Present tense, about a fallback D-16(b)
    // deleted, and describing an `anyTick` condition the same slice replaced
    // with `skipped.length > 0`. The two tests above were rewritten for exactly
    // the #34.08 reason — one fact, one place — and an adversarial round found
    // this one thirty lines below them, in the same file.
    const grantRaw = read("lib", "admin", "value-lists", "role-whitelists.ts");
    const grant    = code(grantRaw);
    // The key itself has to be read from the RAW source — `code` blanks string
    // bodies — so the pattern is the whole call, which no comment contains.
    expect(grantRaw).toContain('warnings.push("roleWhitelistPending")');

    // ⚠️ **IT ASKS „WAS A TYPE LEFT OUT", NOT „IS THE TARGET TICKED
    // ANYWHERE" — Slice #34.16.** The old test was `anyTick.length === 0`, a
    // second SELECT. It is gone, and not merely as an optimisation: it could
    // not fire. Inside this branch `skipped.length === 0` means every moved
    // type is in `needed`, so the insert runs, so a row exists for each moved
    // type afterwards. Keeping it as a disjunct would have been a condition
    // that reads like two cases and has one — which is how the pre-#34.16
    // version came to report a clean success over stranded rows.
    expect(grant).toMatch(/const skipped = types\.filter\(\(t\) => !needed\.has\(t\.documentTypeId\)\)/);
    expect(grant).toMatch(/if \(skipped\.length > 0\) warnings\.push\(/);
    expect(grant).not.toContain("anyTick");

    // Still decided after the insert has had its chance, so the two halves of
    // the outcome are read from the same moment. The ORDER is read from the
    // stripped source, where a comment cannot supply it.
    const insertAt = grant.indexOf("onConflictDoNothing");
    const askAt    = grant.indexOf("warnings.push(");
    expect(insertAt).toBeGreaterThan(-1);
    expect(askAt).toBeGreaterThan(insertAt);

    // …and it reaches the screen, through the same door `granted` uses.
    expect(read("app", "api", "admin", "value-lists", "[list]", "[id]", "reassign", "route.ts"))
      .toContain("warnings: outcome.warnings");
    const modal = read("app", "admin", "value-lists", "_components", "value-list-modal.tsx");
    expect(modal).toContain("setWarnings(res.warnings ?? [])");
    // ⚠️ **And BOTH are cleared when the target changes.** Both sentences are
    // written about "rolul ales" — the role in the dropdown — so a `granted`
    // list left over from a move onto B tells the administrator, after they
    // pick C, that C was ticked automatically. A third adversarial round found
    // it. (`movedTotal` survives on purpose: it names no role.)
    expect(modal).toMatch(/setGranted\(\[\]\);\s*setWarnings\(\[\]\);/);
    expect(modal).toMatch(/t\(`confirm\.\$\{w\}`/);
  });

  it("no longer asks the user to go and tick it themselves", () => {
    // `confirm.roleWhitelistNote` was a sentence standing in for a filter: it
    // told the administrator the ticks do not travel, and asked them to repair
    // up to three other panels by hand afterwards. The repair is automatic
    // now, so the sentence is not merely redundant — it is false.
    for (const m of [messages("ro-RO"), messages("en-GB")]) {
      expect(at(m, "valueList.confirm.roleWhitelistNote")).toBeUndefined();
    }
    expect(read("app", "admin", "value-lists", "_components", "value-list-modal.tsx"))
      .not.toContain('t("confirm.roleWhitelistNote")');
  });
});

// ---------------------------------------------------------------------------
// 10. Nothing on this screen fails silently or in English    (Slice #29.13)
// ---------------------------------------------------------------------------

describe("the sibling panels say their failures in Romanian", () => {
  // ⚠️ **One panel since Slice #34.04, and the two that went were one
  // component written twice.** `property-persons-modal.tsx` and
  // `person-person-modal.tsx` differed, after normalising the two identifier
  // families, in whitespace, brace style, the endpoint and the i18n namespace —
  // same fetchers, same add form, same delete confirmation, same focus-restore
  // effects, same Escape handler, same 409 handling. They are deleted rather
  // than merged because the tables behind them are two booleans now.
  // „Persoană → Document" keeps its panel: `lookup_doc_type_person_role` is
  // unique over the PAIR and does not collapse.
  const PANELS = [
    "document-persons-modal.tsx",
  ] as const;

  it.each(PANELS)("%s — has an onError on its delete, and never renders err.message", (file) => {
    const source = read("app", "admin", "value-lists", "_components", file);
    const body = code(source);
    // The state #29.05's own comment describes as fixed, one modal over: a
    // failed delete left the dialog open with its button re-enabled and
    // nothing said anywhere.
    // ⚠️ **`setDeleteError(tErr(` — the onError, not merely the state.** An
    // adversarial round deleted the whole `onError` and watched a
    // `/setDeleteError\(/` guard stay green on the three CLEARING calls that
    // remain (open, cancel, success). Only the failure handler translates.
    expect([file, /setDeleteError\(tErr\(/.test(body)]).toEqual([file, true]);
    // ⚠️ **`err.message` is the SERVER'S ENGLISH** — "Delete failed (404)",
    // "Invalid input", "This role is already in the list" — on a screen
    // CLAUDE.md's first rule says must never show any.
    expect([file, /err\.message/.test(body)]).toEqual([file, false]);
    // One sentence, translated once: the shared namespace rather than a fourth
    // copy of the same keys under this panel's own.
    expect([file, source.includes('useTranslations("valueList.confirm.errors")')])
      .toEqual([file, true]);
  });


  it("the SAVE's bare-key invalidations, their branches and their consumers all agree", () => {
    // ⚠️ **A branch that names a key nothing fetches is not harmless — it is a
    // CLAIM ABOUT A CONSUMER, and it was wrong for the whole life of the
    // branch.** Until Slice #33.05 `invalidateListCaches` invalidated
    // `["property-types"]` and its header named the Property form's type
    // dropdown as the reason; that dropdown fetches
    // `["value-list", "property-types"]`, which the unconditional first line
    // already covers, so the branch matched nothing for years while reading as
    // though it were load-bearing. The opposite half was live at the same time
    // and cost the user something: `["institutions"]`, the five person-role
    // keys and `["doc-type-person-roles"]` on a document-type rename ARE
    // fetched bare and had no branch, so a rename stayed invisible for the
    // length of the staleTime.
    //
    // This supersedes the narrower #29.13 guard that stood here. That one
    // checked two keys with a one-space `includes` and an unguarded
    // end-of-function slice; its two file-level consumer assertions are kept —
    // see CONSUMERS — because an adversarial round pointed out that dropping
    // them was the only real loss in the replacement.
    //
    // FOUR assertions, and every one of them exists because a round of review
    // walked through the previous version:
    //   (i)   the body invalidates exactly the table's keys, as a multiset;
    //   (ii)  each key sits inside the braces of ITS list's branch — round two
    //         deleted every `if` guard and the earlier version still passed;
    //   (iii) each key is really FETCHED somewhere, judged structurally;
    //   (iv)  the files the header names really are those consumers, so the
    //         comment cannot drift — three separate rounds caught it naming a
    //         screen that does not fetch the key.
    const BARE_KEYS: Partial<Record<ListKey, string[]>> = {
      "document-types":          ["document-types", "doc-type-person-roles"],
      "institutions":            ["institutions"],
      "property-property-roles": ["property-property-roles"],
      "document-document-roles": ["document-document-roles"],
      // ⚠️ **FIVE keys until Slice #34.04, and both halves of the shrink are
      // the same lesson.** `property-person-roles-whitelist`,
      // `property-person-roles` and `person-person-roles` named two endpoints
      // that are gone — the whitelists are booleans on `lookup_person_role`, so
      // the four association screens read `["value-list", "person-roles"]`,
      // which the FIRST, unconditional line of `invalidateListCaches` already
      // covers and which therefore must never appear in this table (see (i)).
      // The same slice had added `citizenships` and `person-types` here and
      // removed them again for exactly that reason.
      "person-roles":            ["doc-distinct-roles", "doc-type-person-roles"],
    };

    // The header's own consumer table, as data. If a line of that comment is
    // wrong, this fails.
    const CONSUMERS: Array<[string[], string]> = [
      [["app", "documents", "list-view.tsx"], "document-types"],
      [["app", "documents", "_components", "document-form.tsx"], "document-types"],
      [["app", "documents", "_components", "document-form.tsx"], "institutions"],
      [["app", "properties", "[id]", "associate-reference", "associate-reference-view.tsx"],
        "property-property-roles"],
      [["app", "documents", "[id]", "associate-reference", "associate-reference-view.tsx"],
        "document-document-roles"],
      [["app", "natural-persons", "[id]", "associate-document", "associate-document-view.tsx"],
        "doc-distinct-roles"],
      [["app", "judicial-persons", "[id]", "associate-document", "associate-document-view.tsx"],
        "doc-distinct-roles"],
      [["app", "admin", "value-lists", "_components", "document-persons-modal.tsx"],
        "doc-type-person-roles"],
    ];

    /**
     * Two same-length views of a source file, so indices line up between them:
     * `text` has comments blanked and string bodies intact (the keys are string
     * bodies, so `code()` — which blanks both — is the wrong helper here), and
     * `shape` has the string bodies blanked too, which makes it safe to walk
     * for brackets.
     *
     * ⚠️ **A scanner, not two `replace` calls.** The obvious
     * `src.replace(/\/\*[\s\S]*?\*\//g, " ")` reads the `/*` inside
     * `accept="image/*,.pdf,…"` as a comment opener and swallows everything to
     * the next `*​/`: measured, that is 207 lines of `pages-panel.tsx` made
     * invisible. Known limit, stated rather than hidden: a regex literal
     * containing an unpaired quote would desynchronise this, and nothing in
     * `src/` has one today.
     */
    const scan = (src: string): { text: string; shape: string } => {
      const text: string[] = [];
      const shape: string[] = [];
      const push = (ch: string, inString: boolean): void => {
        text.push(ch);
        shape.push(inString ? " " : ch);
      };
      let i = 0;
      while (i < src.length) {
        const ch = src[i];
        const next = src[i + 1];
        if (ch === "/" && next === "/") {
          while (i < src.length && src[i] !== "\n") { text.push(" "); shape.push(" "); i += 1; }
          continue;
        }
        if (ch === "/" && next === "*") {
          const close = src.indexOf("*/", i + 2);
          const stop = close === -1 ? src.length : close + 2;
          for (; i < stop; i += 1) {
            const blank = src[i] === "\n" ? "\n" : " ";
            text.push(blank);
            shape.push(blank);
          }
          continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") {
          push(ch, false);
          i += 1;
          while (i < src.length) {
            const c = src[i];
            if (c === "\\") {
              push(c, true);
              if (i + 1 < src.length) push(src[i + 1], true);
              i += 2;
              continue;
            }
            if (c === ch) { push(c, false); i += 1; break; }
            push(c, c !== "\n");
            i += 1;
          }
          continue;
        }
        push(ch, false);
        i += 1;
      }
      return { text: text.join(""), shape: shape.join("") };
    };

    /**
     * The name of the call whose argument list encloses `at` — `useQuery`,
     * `invalidateQueries`, or "" when the position is not inside a call.
     *
     * ⚠️ **Structural, because every distance-based version was defeated.** A
     * lookbehind of N characters is beaten by an `invalidateQueries` with four
     * options ahead of its `queryKey`, and by a `predicate` arrow whose body
     * holds a semicolon — both of which would make an invalidation vouch for a
     * branch that nothing fetches, which is the original defect wearing the
     * guard as a disguise. Walking out to the enclosing `(` cannot be fooled
     * that way. The `;` stop is what keeps a detached
     * `const opts = { queryKey: … }` from borrowing the call above it.
     */
    const enclosingCall = (shape: string, at: number): string => {
      let depth = 0;
      for (let i = at - 1; i >= 0; i -= 1) {
        const c = shape[i];
        if (c === ")" || c === "]" || c === "}") { depth += 1; continue; }
        if (c === "(" || c === "[" || c === "{") {
          if (depth > 0) { depth -= 1; continue; }
          if (c !== "(") continue;                     // an options object — keep walking out
          const before = shape.slice(Math.max(0, i - 120), i);
          // The optional `<…>` is the generic on `useQuery<Row[]>({ … })`,
          // without which ten of this tree's twenty-five fetches read as "".
          const name = before.match(/([A-Za-z_$][\w$]*)\s*(?:<[^<>()]*>)?\s*$/);
          return name ? name[1] : "";
        }
        if (c === ";" && depth === 0) return "";
      }
      return "";
    };

    const KEY_SITE = /queryKey:\s*\["([^"\]]+)"\]/g;
    const keyProbe = (key: string): RegExp =>
      new RegExp(`queryKey:\\s*\\["${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\]`);

    const modalPath = path.join(
      SRC, "app", "admin", "value-lists", "_components", "value-list-modal.tsx",
    );
    const modal = scan(fs.readFileSync(modalPath, "utf8"));
    const from  = modal.text.indexOf("function invalidateListCaches(");
    expect(from).toBeGreaterThan(-1);
    const stop = modal.shape.indexOf("\n}", from);
    // Guarded: `slice(from, -1)` is the whole rest of the file minus one
    // character, which would silently widen this from one function to
    // everything after it.
    expect(stop).toBeGreaterThan(from);
    const body  = modal.text.slice(from, stop);
    const frame = modal.shape.slice(from, stop);

    // (i) the body invalidates exactly the table's keys — no more, no fewer.
    // Single-segment keys only: `["value-list", listKey]` is not one, and must
    // not be, because that line covers every list and needs no branch.
    KEY_SITE.lastIndex = 0;
    const declared = [...body.matchAll(KEY_SITE)].map((m) => m[1]);
    const expected = Object.values(BARE_KEYS).flat();
    expect([...declared].sort()).toEqual([...expected].sort());

    // (ii) …and each one sits inside the BRACES of its own list's branch.
    // ⚠️ Brace-matched, not `indexOf("\n  }")`: a braceless `if` has no closing
    // brace of its own, so the naive marker ran on into the NEXT branch and the
    // two blocks overlapped — a key moved to the wrong branch passed. There are
    // 1400+ braceless `if`s in `src/` and no `curly` lint rule, so this is one
    // tidy-up away rather than hypothetical. Requiring the brace is deliberate:
    // a braceless branch here fails loudly instead of silently widening.
    for (const [listKey, keys] of Object.entries(BARE_KEYS)) {
      // The guard is found in `body`, not `frame`: `frame` has string bodies
      // blanked, so `listKey === "institutions"` cannot match there. The two
      // are the same slice of the same file, so the index is valid in both,
      // and the brace walk below stays on `frame` where a `{` inside a string
      // cannot mislead it.
      const guardAt = body.indexOf(`listKey === "${listKey}"`);
      expect([listKey, guardAt]).not.toEqual([listKey, -1]);
      const open = frame.indexOf("{", guardAt);
      expect([listKey, open]).not.toEqual([listKey, -1]);
      // Nothing but the guard's own `)` may stand between the condition and the
      // brace — that is what makes a braceless branch fail here.
      expect([listKey, frame.slice(guardAt + `listKey === "${listKey}"`.length, open).trim()])
        .toEqual([listKey, ")"]);
      let depth = 0;
      let close = -1;
      for (let i = open; i < frame.length; i += 1) {
        if (frame[i] === "{") depth += 1;
        else if (frame[i] === "}") { depth -= 1; if (depth === 0) { close = i; break; } }
      }
      expect([listKey, close]).not.toEqual([listKey, -1]);
      const block = body.slice(open, close);
      for (const key of keys) {
        expect([listKey, key, keyProbe(key).test(block)]).toEqual([listKey, key, true]);
      }
    }

    // (iii) …and something under src/ really FETCHES each of them. Every
    // .ts/.tsx except this modal and the tests — a key quoted in another test
    // is not a consumer. Re-measured on this tree at the end of Slice #34.04:
    // 19 fetch sites, 53 invalidation sites, nothing unclassified — against 25
    // and 53 before it. ⚠️ **The fetch count FELL by six and the invalidation
    // count did not move, and both are the point.** This scan matches
    // single-segment keys only, so the eight consumers the slice moved onto
    // `["value-list", …]` stopped being counted here — which is exactly what
    // "needs no branch" means. The invalidation total is measured OUTSIDE this
    // modal, and the five keys the slice deleted were all inside it; the two
    // deleted panels' own invalidations were unkeyed `qc.invalidateQueries()`,
    // which carry no `queryKey` and were never in this number.
    const files: string[] = [];
    (function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "__tests__") walk(full);
        } else if (/\.tsx?$/.test(entry.name) && full !== modalPath) {
          files.push(full);
        }
      }
    })(SRC);

    const FETCH_HOOK = /^(useQuery|useQueries|useSuspenseQuery|useInfiniteQuery)$/;
    const fetched = new Set<string>();
    for (const file of files) {
      const seen = scan(fs.readFileSync(file, "utf8"));
      KEY_SITE.lastIndex = 0;
      for (const m of seen.text.matchAll(KEY_SITE)) {
        if (FETCH_HOOK.test(enclosingCall(seen.shape, m.index ?? 0))) fetched.add(m[1]);
      }
    }
    for (const key of expected) {
      expect([key, fetched.has(key)]).toEqual([key, true]);
    }

    // (iv) …and the consumer table in the header names the right files.
    for (const [parts, key] of CONSUMERS) {
      const seen = scan(read(...parts));
      KEY_SITE.lastIndex = 0;
      const here = [...seen.text.matchAll(KEY_SITE)]
        .filter((m) => FETCH_HOOK.test(enclosingCall(seen.shape, m.index ?? 0)))
        .map((m) => m[1]);
      expect([parts.join("/"), key, here.includes(key)]).toEqual([parts.join("/"), key, true]);
    }
  });

  it.each(PANELS)("%s — invalidates the caches the association screens use", (file) => {
    // These rows ARE the role dropdowns on the associate screens, and those
    // cache them under keys of their own (`document-valid-roles`,
    // `doc-distinct-roles`). With the global 30 s staleTime a narrow
    // invalidation left an un-ticked role still on offer.
    // Both of them — the add form's and the delete's. Asserted as a COUNT
    // because a file-wide `includes` stays green when either one is narrowed
    // back to a keyed invalidation.
    const body = code(read("app", "admin", "value-lists", "_components", file));
    expect([file, (body.match(/qc\.invalidateQueries\(\)/g) ?? []).length]).toEqual([file, 2]);
  });

  it.each(PANELS)("%s — its confirmation cannot be re-targeted through the backdrop", (file) => {
    // ⚠️ **The finding value-list-modal.tsx records for the list beside these
    // three, still live here until #29.13.** The backdrop hid the list and did
    // not disable it, and `confirmDelete` names no row — so Tab reached
    // ANOTHER row's Șterge, Enter re-keyed the dialog onto it with nothing on
    // screen changing, and the next press deleted a row nobody chose.
    const source = read("app", "admin", "value-lists", "_components", file);
    const body = code(source);
    expect([file, /inert=\{!!confirmDeleteId\}/.test(body)]).toEqual([file, true]);
    // An `alertdialog` nobody focuses announces nothing, and `aria-modal` on a
    // panel the user's focus is not inside is a lie told to assistive tech.
    expect([file, /confirmPanelRef\.current\?\.focus\(\)/.test(body)]).toEqual([file, true]);
    expect([file, source.includes("aria-labelledby={confirmTitleId}")]).toEqual([file, true]);
  });

  it.each(PANELS)("%s — cannot be closed out from under an in-flight delete", (file) => {
    // ⚠️ **The mutation completes regardless — TanStack keeps `onError` on the
    // mutation, not on the observer — so closing mid-delete unmounts the only
    // place the refusal is ever reported, and a delete that FAILED reads as
    // one the user cancelled. That is "fails silently" reached through the
    // Cancel button.** value-list-modal.tsx:1240 guards its Escape for exactly
    // this; these three did not, until an adversarial round asked.
    const body = code(read("app", "admin", "value-lists", "_components", file));
    expect([file, /if \(deleteMutation\.isPending\) return;/.test(body)]).toEqual([file, true]);
    expect([file, /onClick=\{closeConfirm\}[\s\S]{0,400}?disabled=\{deleteMutation\.isPending\}/.test(body)])
      .toEqual([file, true]);
  });

  it.each(PANELS)("%s — restores focus in an EFFECT, not inside the handler", (file) => {
    // ⚠️ **`focus()` on an element inside an `inert` subtree is a
    // spec-mandated no-op.** The first version of the a11y fix called
    // `opener.focus()` synchronously after `setConfirmDeleteId(null)`, so the
    // list panel was still inert and focus landed on `<body>` — the state the
    // whole rework exists to prevent, with a comment claiming the opposite.
    // Effects run after React has removed the attribute, on every lane.
    const body = code(read("app", "admin", "value-lists", "_components", file));
    const effect = /useEffect\(\(\) => \{([\s\S]*?)\}, \[confirmDeleteId\]\);/.exec(body);
    expect([file, effect !== null]).toEqual([file, true]);
    expect([file, /wasOpenRef\.current = false;/.test(effect?.[1] ?? "")]).toEqual([file, true]);
    expect([file, /opener\?\.isConnected/.test(effect?.[1] ?? "")]).toEqual([file, true]);
    // ⚠️ **The `else` is unconditional.** A restore keyed on "was it a delete"
    // fires neither branch when the row simply left the list under an open
    // confirmation, and focus is left on `<body>`. Whatever made the opener
    // unreachable, the list panel is where focus belongs — and it can only be
    // announced there because it now has a name, asserted below.
    expect([file, /else listPanelRef\.current\?\.focus\(\);/.test(effect?.[1] ?? "")])
      .toEqual([file, true]);
    expect([file, read("app", "admin", "value-lists", "_components", file)
      .includes("aria-labelledby={listTitleId}")]).toEqual([file, true]);
    // …and the close handler must NOT do it itself any more.
    const close = /const closeConfirm = useCallback\(\(\) => \{([\s\S]*?)\}, \[\]\);/.exec(body);
    expect([file, close !== null]).toEqual([file, true]);
    expect([file, /focus\(\)/.test(close?.[1] ?? "")]).toEqual([file, false]);
  });
});

// ---------------------------------------------------------------------------
// 11. The duplicate a panel can now name is one the server really produces
// ---------------------------------------------------------------------------

describe("the 409 the whitelist panels can say in Romanian", () => {
  // Slice #34.04: one route, for the one whitelist that is still a table.
  it.each([
    "doc-type-person-roles",
  ])("%s answers a duplicate with a code, decided by SQLSTATE", (dir) => {
    // ⚠️ **Two halves, and both were broken before this slice made them
    // load-bearing.** The panels choose their sentence from a CODE — a bare
    // 409 is also what the value-lists DELETE answers with when a row is in
    // use — so the body has to carry one. And the branch that produces it used
    // to test for a constraint NAME:
    // `lookup_person_person_role_person_role_id_unique` is a name Postgres
    // never generates (migration_055 declares the column UNIQUE inline, which
    // Postgres names `..._key`), so that branch had never once fired and the
    // user got `errors.generic` for a duplicate this slice wrote a sentence
    // for. 23505 is the same fact with nothing to spell wrong.
    const route = read("app", "api", "admin", dir, "route.ts");
    expect([dir, route.includes('code: "DUPLICATE"')]).toEqual([dir, true]);
    expect([dir, route.includes('pgErrorCode(err) === "23505"')]).toEqual([dir, true]);
    // The constraint-name test is gone, not merely bypassed.
    expect([dir, /message\.includes\("lookup_/.test(route)]).toEqual([dir, false]);
  });

  it("and the client turns that code into the Romanian sentence", () => {
    const failures = read("lib", "admin", "value-lists", "failures.ts");
    expect(failures).toContain('if (code === "DUPLICATE") return "duplicate";');
    expect(FAILURE_CODES).toContain("duplicate");
  });
});
