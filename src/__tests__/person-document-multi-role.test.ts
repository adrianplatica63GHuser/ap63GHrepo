/**
 * @jest-environment node
 */

/**
 * Slice #36.02 — a person may hold several roles on one document, and every
 * path in and out of those rows must name ONE of them.
 *
 * WHY THIS FILE IS SOURCE GUARDS AND NOT A DATABASE TEST
 *   The four behaviours the slice description asks to pin — two roles make two
 *   rows, the same role twice makes one row and a told-you sentence, a
 *   role-less attachment twice is refused by the index, and a deed with no
 *   shares saves clean — are all statements about a UNIQUE INDEX and about
 *   SQL. There is no database in this suite and there is no fixture that could
 *   stand in for one: a mock would be asserting what the mock was written to
 *   do. `scripts/Verify-Rebuild.ps1` is what exercises the real index, on a
 *   real Postgres 16, and it is in the handover.
 *
 *   What IS checkable here, and is what actually regresses, is the half that
 *   lives in TypeScript: that the index is declared the way the migration
 *   writes it, that nothing addresses a row by the person any more, that the
 *   writers report what they did, and that every sentence exists in both
 *   locales. Each of those is a thing a later slice can undo by accident.
 *
 * ⚠️ **THE UI CHECKS ARE BEHAVIOUR GUARDS AND READ ONLY CODE.** Every file
 * below explains `linkId` in its own header, in prose, using the words the
 * guard looks for — so a guard that read the comments would pass on a component
 * that had gone back to keying on the person.
 */

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

function read(...parts: string[]): string {
  return fs.readFileSync(path.join(SRC, ...parts), "utf8");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function messages(locale: "ro-RO" | "en-GB"): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, "messages", `${locale}.json`), "utf8"),
  ) as Record<string, unknown>;
}

function at(obj: unknown, keyPath: string): unknown {
  return keyPath.split(".").reduce<unknown>(
    (acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined),
    obj,
  );
}

const LOCALES = ["ro-RO", "en-GB"] as const;

// ---------------------------------------------------------------------------
// 1. The migration, and the schema declaration that has to agree with it
// ---------------------------------------------------------------------------

/**
 * ⚠️ **READ THE SQL WITHOUT ITS COMMENTS, AND A FAILING FIRST DRAFT IS WHY.**
 * migration_084's header ARGUES about the rules it declines — it says in as
 * many words that `0 < cota_parte <= 100` „reads like free integrity and is the
 * wrong rule for this table". A guard for the absence of that constraint,
 * written against the raw file, matched the sentence explaining the absence and
 * reported the constraint present. The same trap in the other direction is
 * worse: a `contains("NULLS NOT DISTINCT")` against the raw file would pass on
 * a migration that had lost the clause and kept the paragraph about it. Every
 * structural assertion below reads `code`; only the last one reads the header,
 * and says so.
 */
function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

describe("migration_084 widens the index and adds the three columns", () => {
  const migration = fs.readFileSync(
    path.join(SRC, "db", "migration_084_person_document_cota_parte.sql"),
    "utf8",
  );
  const code = stripSqlComments(migration);

  it("recreates person_document_unique over three columns", () => {
    expect(code).toContain("DROP INDEX IF EXISTS person_document_unique");
    expect(code).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS person_document_unique\s+ON person_document \(person_id, document_id, person_role_id\)/,
    );
  });

  /**
   * ⚠️ **THE ONE LINE WHOSE ABSENCE IS A NEW DEFECT RATHER THAN A MISSING
   * FEATURE.** `person_role_id` is nullable and Postgres treats NULLs as
   * distinct in a unique index by default, so without this clause the same
   * person could be attached to the same document with NO role an unlimited
   * number of times — and the role-less attachment is the ordinary path from
   * the general Persons tab, so it is the common case that would break.
   */
  it("carries NULLS NOT DISTINCT", () => {
    expect(code).toContain("NULLS NOT DISTINCT");
  });

  it("adds the three nullable columns at the precisions the archive needs", () => {
    expect(code).toContain("cota_parte        numeric(7,4)");
    expect(code).toContain("cota_suprafata_mp numeric(12,2)");
    expect(code).toContain("cota_mod          text");
  });

  it("CHECKs cota_mod against exactly the four values", () => {
    expect(code).toContain(
      "cota_mod IN ('NUME_PROPRIU', 'DEVALMASIE', 'INDIVIZIUNE', 'PRIN_MANDATAR')",
    );
  });

  /**
   * migration_080's rule, reused: the chain runs on databases nobody measured,
   * and a bare CREATE UNIQUE INDEX on a colliding table fails with an error
   * naming the key and neither row.
   */
  it("counts before it creates, and refuses rather than failing unreadably", () => {
    expect(code).toContain("GROUP BY person_id, document_id, person_role_id");
    expect(code).toContain("HAVING count(*) > 1");
    expect(code).toContain("migration_084 REFUSED");
  });

  /**
   * ⚠️ **NO RANGE CHECK ON `cota_parte`, AND ITS ABSENCE IS A DECISION.** The
   * archive shows what the paper says rather than refusing the paper — the same
   * sentence that makes the per-role total a warning and not a block. A later
   * migration adding `cota_parte <= 100` would look like tidying up and would
   * make a deed that really does state 101% unrecordable.
   */
  it("does NOT constrain the value of cota_parte", () => {
    expect(code).not.toMatch(/cota_parte\s*(<=|>|>=|BETWEEN)/i);
    // And the header says the absence is a decision, so a later slice adding the
    // constraint has to read the argument first.
    expect(migration).toContain("NO RANGE CHECK ON `cota_parte`");
  });

  it("schema/index.ts declares the same three key columns and the CHECK", () => {
    const schema = read("db", "schema", "index.ts");
    expect(schema).toContain(
      'uniqueIndex("person_document_unique").on(t.personId, t.documentId, t.personRoleId)',
    );
    expect(schema).toContain('"person_document_cota_mod_check"');
    expect(schema).toContain('numeric("cota_parte",        { precision:  7, scale: 4 })');
    expect(schema).toContain('numeric("cota_suprafata_mp", { precision: 12, scale: 2 })');
  });

  /**
   * drizzle-orm 0.45.2's `uniqueIndex` builder has no `nullsNotDistinct()`, so
   * the declaration necessarily understates the index. That is tolerable only
   * while it is SAID — an unremarked approximation is how the two sides drift.
   */
  it("and says, where it declares it, that it understates the index", () => {
    const schema = read("db", "schema", "index.ts");
    const block = schema.slice(
      schema.indexOf('export const personDocument = pgTable('),
      schema.indexOf('export const personPerson = pgTable('),
    );
    expect(block).toContain("NULLS NOT DISTINCT");
    expect(block).toContain("migration_084");
  });
});

// ---------------------------------------------------------------------------
// 2. Nothing addresses a row by the person any more
// ---------------------------------------------------------------------------

describe("every delete names the ROW, not the (person, document) pair", () => {
  it.each([
    ["lib/documents/queries.ts", "dissociatePersonFromDocument"],
    ["lib/persons/queries.ts",   "dissociateDocumentFromPerson"],
  ])("%s: %s takes a linkId and puts it in the WHERE", (file, fn) => {
    const src = stripComments(read(...file.split("/")));
    const body = src.slice(src.indexOf(`export async function ${fn}(`));
    const decl = body.slice(0, body.indexOf(")"));
    expect(decl).toContain("linkId");
    // ⚠️ Not optional. An absent linkId meaning „all of this person's roles"
    // would keep the old behaviour reachable from any caller not yet updated,
    // which is the defect left in place behind a default.
    expect(decl).not.toMatch(/linkId\s*\?/);
    expect(body.slice(0, body.indexOf("return"))).toContain("eq(personDocument.id, linkId)");
  });

  it.each([
    "app/api/documents/[id]/persons/[personId]/route.ts",
    "app/api/people/[id]/documents/[documentId]/route.ts",
  ])("%s refuses without a linkId and offers PATCH", (file) => {
    const src = stripComments(read(...file.split("/")));
    expect(src).toContain('searchParams.get("linkId")');
    expect(src).toContain("status: 400");
    expect(src).toContain("export async function DELETE(");
    expect(src).toContain("export async function PATCH(");
  });

  /**
   * ⚠️ **THE ROLE IS NOT PATCHABLE, AND IT MUST STAY THAT WAY.**
   * `person_role_id` is half the row's identity under the widened index, so
   * changing it is an attach and a detach — and an UPDATE would slip past
   * `assertRoleMayBeAttached`, the one door deciding whether a role may be
   * attached to a document at all.
   */
  it.each([
    "app/api/documents/[id]/persons/[personId]/route.ts",
    "app/api/people/[id]/documents/[documentId]/route.ts",
  ])("%s does not let PATCH change the role", (file) => {
    const src = stripComments(read(...file.split("/")));
    const patch = src.slice(src.indexOf("const patchSchema"));
    expect(patch).not.toContain("personRoleId");
  });

  it.each([
    "app/documents/_components/document-persons-tab.tsx",
    "app/documents/_components/person-document-tab.tsx",
    "app/documents/_components/succession-parties-panel.tsx",
  ])("%s keys its rows on linkId and never on the person", (file) => {
    const src = stripComments(read(...file.split("/")));
    expect(src).toContain("key={item.linkId}");
    expect(src).not.toContain("key={item.id}");
    // The DELETE it sends must carry the row.
    expect(src).toContain("linkId=$");
  });
});

// ---------------------------------------------------------------------------
// 3. „Nothing was added" is an answer, and four screens give it
// ---------------------------------------------------------------------------

describe("a write that added nothing says so", () => {
  it.each([
    ["lib/documents/queries.ts", "associatePersonsToDocument"],
    ["lib/persons/queries.ts",   "associateDocumentsToPerson"],
  ])("%s: %s keeps onConflictDoNothing and reports what it skipped", (file, fn) => {
    const src = stripComments(read(...file.split("/")));
    const body = src.slice(src.indexOf(`export async function ${fn}(`));
    const upTo = body.slice(0, body.indexOf("\n}\n"));
    // The conflict handling STAYS: after the widening the only thing that
    // conflicts is a genuine duplicate, and ignoring it is right.
    expect(upTo).toContain(".onConflictDoNothing()");
    // What changed is that it is no longer silent.
    expect(upTo).toContain(".returning({ id: personDocument.id })");
    expect(upTo).toContain("inserted:");
    expect(upTo).toContain("skipped:");
  });

  it.each([
    "app/api/documents/[id]/persons/route.ts",
    "app/api/people/[id]/documents/route.ts",
  ])("%s answers with the counts rather than a bare 204", (file) => {
    const src = stripComments(read(...file.split("/")));
    const post = src.slice(src.indexOf("export async function POST("));
    expect(post).toContain("Response.json(result)");
    expect(post).not.toContain("status: 204");
  });

  it.each([
    "app/documents/[id]/associate-person/associate-person-view.tsx",
    "app/documents/[id]/associate-party/associate-party-view.tsx",
    "app/natural-persons/[id]/associate-document/associate-document-view.tsx",
    "app/judicial-persons/[id]/associate-document/associate-document-view.tsx",
    "app/documents/_components/ai-party-linker-dialog.tsx",
  ])("%s reads inserted and says „este deja atașat…”", (file) => {
    const src = stripComments(read(...file.split("/")));
    expect(src).toContain("inserted");
    expect(src).toContain('alreadyAttached');
  });
});

// ---------------------------------------------------------------------------
// 4. The role merge that would make duplicates
// ---------------------------------------------------------------------------

describe("merging two roles one person holds on one document is refused", () => {
  it("the person_document ref declares what it is unique with", () => {
    const src = read("lib", "admin", "value-lists", "dependents.ts");
    expect(src).toContain("uniqueWith: [personDocument.personId, personDocument.documentId]");
  });

  /**
   * ⚠️ **AND IT IS NOT MARKED `configuration` TO GET THERE.** That would make
   * the old `uniqueWith ⇒ configuration` assertion green again and would be a
   * lie with consequences: configuration refs never block a delete and
   * `reassignDependents` skips them, so deleting a role would silently blank
   * real association rows instead of refusing.
   */
  it("and is still an object ref, which is what makes a role deletion refuse", () => {
    const src = stripComments(read("lib", "admin", "value-lists", "dependents.ts"));
    const ref = src.slice(
      src.indexOf('labelKey: "personDocuments"'),
      src.indexOf('labelKey: "personPersons"'),
    );
    expect(ref).toContain('enforcement: "clears"');
    expect(ref).not.toContain("configuration");
  });

  it("the refusal exists in both locales, with its count", () => {
    for (const locale of LOCALES) {
      const text = at(messages(locale), "valueList.confirm.errors.roleMergeCollides");
      expect(typeof text).toBe("string");
      expect(String(text)).toContain("{collisions}");
    }
  });
});

// ---------------------------------------------------------------------------
// 5. The copy
// ---------------------------------------------------------------------------

const COTA_KEYS = [
  "colCota",
  "colCotaMp",
  "colCotaMod",
  "cotaPlaceholder",
  "cotaMpPlaceholder",
  "cotaModPlaceholder",
  "cotaMod.NUME_PROPRIU",
  "cotaMod.DEVALMASIE",
  "cotaMod.INDIVIZIUNE",
  "cotaMod.PRIN_MANDATAR",
  "cotaError.unreadable",
  "cotaError.zeroDenominator",
  "cotaError.notStorable",
  "cotaError.negative",
  "cotaTotal",
  "cotaTotalNoRole",
  "cotaTotalOff",
  "cotaTotalOffNoRole",
  "cotaSaving",
  "cotaSaveError",
  "alreadyAttached",
];

describe("every sentence this slice added exists in both locales", () => {
  it.each(LOCALES)("%s carries all of document.persons.cota*", (locale) => {
    const m = messages(locale);
    for (const key of COTA_KEYS) {
      const value = at(m, `document.persons.${key}`);
      // ⚠️ `DEFAULT_LOCALE` is ro-RO, so a missing key renders as a raw key
      // path in the SHIPPING locale — not as English.
      expect([key, typeof value]).toEqual([key, "string"]);
      expect([key, String(value).trim().length > 0]).toEqual([key, true]);
    }
  });

  it("the ICU parameters the totals carry are in both locales", () => {
    for (const locale of LOCALES) {
      const m = messages(locale);
      expect(String(at(m, "document.persons.cotaTotal"))).toContain("{roleName}");
      expect(String(at(m, "document.persons.cotaTotal"))).toContain("{total}");
      expect(String(at(m, "document.persons.cotaTotalOff"))).toContain("{roleName}");
      expect(String(at(m, "document.persons.cotaTotalOff"))).toContain("{total}");
      expect(String(at(m, "document.persons.cotaTotalNoRole"))).toContain("{total}");
      expect(String(at(m, "document.persons.cotaTotalOffNoRole"))).toContain("{total}");
    }
  });

  /**
   * The shipping locale is Romanian and these are Romanian legal terms; „cota
   * parte" without diacritics is the tell that a string was typed in a hurry
   * or copied from the English file.
   */
  it("ro-RO spells the Romanian with diacritics", () => {
    const m = messages("ro-RO");
    expect(at(m, "document.persons.colCota")).toBe("Cotă-parte");
    expect(at(m, "document.persons.colCotaMp")).toBe("Suprafață echivalentă (mp)");
    expect(at(m, "document.persons.colCotaMod")).toBe("Mod de deținere");
    expect(at(m, "document.persons.cotaMod.DEVALMASIE")).toBe("devălmășie");
    expect(at(m, "document.persons.cotaMod.NUME_PROPRIU")).toBe("în nume propriu");
    expect(at(m, "document.persons.cotaMod.PRIN_MANDATAR")).toBe("prin mandatar");
  });

  /**
   * `record-list-agreement.test.ts` found `shared.errorBoundary` sitting in
   * en-GB.json holding the Romanian copy word for word. The same guard, on the
   * keys this slice added.
   */
  it("en-GB is not carrying the Romanian copy", () => {
    const en = messages("en-GB");
    const ro = messages("ro-RO");
    for (const key of COTA_KEYS) {
      const e = String(at(en, `document.persons.${key}`));
      const r = String(at(ro, `document.persons.${key}`));
      expect([key, /[ăâîșțĂÂÎȘȚ]/.test(e)]).toEqual([key, false]);
      // `cotaTotal` is „Total {roleName}: {total}%" in both, legitimately.
      if (key !== "cotaTotal") expect([key, e === r]).toEqual([key, false]);
    }
  });
});
