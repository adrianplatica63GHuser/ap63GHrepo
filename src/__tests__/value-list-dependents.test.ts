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
 *   • **person-roles** is the worst case. Six inbound edges: three CASCADE
 *     ones that delete whitelist rows outright, and three SET NULL ones that
 *     blank the role tag on property_person, person_document and person_person.
 *     One unguarded click damages six tables, and none of the six is visible
 *     from the screen the click happens on.
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
 */

import fs from "fs";
import path from "path";
import { getTableName } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { VALID_LIST_KEYS, type ListKey } from "@/lib/admin/value-lists/config";
import {
  LIST_DEPENDENCIES,
  dependentNotes,
} from "@/lib/admin/value-lists/dependents";
import { isInUseBody, type InUseBody } from "@/lib/admin/value-lists/responses";

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
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
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
    expect(ownerTable(def.source)).toBe(getTableName(def.table));
    expect(def.refs.length).toBeGreaterThan(0);
    for (const ref of def.refs) {
      expect(ownerTable(ref.column)).toBe(getTableName(ref.table));
      for (const u of ref.uniqueWith ?? []) {
        expect(ownerTable(u)).toBe(getTableName(ref.table));
      }
    }
  });

  it("marks exactly the four whitelist edges as configuration", () => {
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
        "document-types:lookup_doc_type_person_role.document_type_id",
        "person-roles:lookup_doc_type_person_role.person_role_id",
        "person-roles:lookup_person_person_role.person_role_id",
        "person-roles:lookup_property_person_role.person_role_id",
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

  it("matches on the id everywhere except tarla, which has no foreign key", () => {
    for (const list of LISTS) {
      const def = LIST_DEPENDENCIES[list];
      if (list === "tarla") {
        // property.tarla_sola is free text, so the match is on the VALUE.
        expect(def.source.name).toBe("indicativ");
        expect(LIST_DEPENDENCIES.tarla.refs[0].column.name).toBe("tarla_sola");
      } else {
        expect(def.source.name).toBe("id");
      }
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
// 3. person-roles — six edges, three of them cascade
// ---------------------------------------------------------------------------

describe("person-roles", () => {
  const def = LIST_DEPENDENCIES["person-roles"];

  it("lists all six inbound edges", () => {
    expect(def.refs.map((r) => getTableName(r.table)).sort()).toEqual(
      [
        "lookup_doc_type_person_role",
        "lookup_person_person_role",
        "lookup_property_person_role",
        "person_document",
        "person_person",
        "property_person",
      ].sort(),
    );
  });

  it("marks the three that would cascade and the three that would be blanked", () => {
    const byTable = Object.fromEntries(
      def.refs.map((r) => [getTableName(r.table), r]),
    );
    for (const t of [
      "lookup_property_person_role",
      "lookup_doc_type_person_role",
      "lookup_person_person_role",
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

  it("and the schema declares exactly those six behaviours", () => {
    const cases: Array<[string, "cascade" | "set null"]> = [
      ["lookupPropertyPersonRole", "cascade"],
      ["lookupDocTypePersonRole",  "cascade"],
      ["lookupPersonPersonRole",   "cascade"],
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

  it("tarla says both things: history, and that the match is on text", () => {
    expect(dependentNotes("tarla").sort()).toEqual(
      ["tarlaFreeText", "versionSnapshots"].sort(),
    );
  });
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
    "roleWhitelistNote",
    "errors.sameValue",
    "errors.validation",
    "errors.ambiguousValue",
    "errors.notFound",
    "errors.generic",
    "delete",
    "deleting",
    "cancel",
  ])("confirm.%s", (key) => {
    expect(typeof at(ro, `valueList.confirm.${key}`)).toBe("string");
    expect(typeof at(en, `valueList.confirm.${key}`)).toBe("string");
  });

  it("has words for the note only the query can add", () => {
    // `duplicateValue` never comes out of `dependentNotes` — `buildReport`
    // appends it when a second row of the same list carries the same value,
    // which only the database can know. So the loop above cannot reach it and
    // it is pinned here instead.
    expect(typeof at(ro, "valueList.dependents.notes.duplicateValue")).toBe("string");
    expect(typeof at(en, "valueList.dependents.notes.duplicateValue")).toBe("string");
    expect(read("lib", "admin", "value-lists", "queries.ts")).toContain('notes.push("duplicateValue")');
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
    expect(body).toMatch(/sourceValue\(tx, def, id, true\)/);
    // …and the lock itself, which lives in that helper. Not scoped, because
    // `sourceValue` is not exported; nothing else in the file takes one.
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
