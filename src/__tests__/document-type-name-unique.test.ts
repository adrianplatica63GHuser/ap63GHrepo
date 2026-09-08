/**
 * Two document types may not share one display name, and the key is the
 * author's.                                                      (Slice #34.09)
 *
 * WHAT THIS SUITE IS FOR
 * ----------------------
 * Three claims, none of which any other suite makes:
 *
 *   1. Two names that differ only by diacritics, case or punctuation are ONE
 *      name to this codebase, and the create and rename doors refuse the
 *      second — while a punctuation-only name stays allowed, because
 *      `sameDocumentTypeName` deliberately refuses to call two empty normalised
 *      forms equal.
 *   2. `migration_080_document_type_name_unique.sql` encodes exactly that rule,
 *      including the exception, and encodes it in the SAME TEXT that measured
 *      the archive.
 *   3. A key typed on the create form is the key stored — folded and
 *      uppercased, never invented, never silently suffixed — and a key can
 *      still not reach the UPDATE path.
 *
 * ⚠️ **THE SQL HALF IS TESTED BY READING THE FILE, WHICH IS THE ONLY WAY IT CAN
 * BE.** `id-card-type-single-source.test.ts` established the pattern for
 * migration_073: a migration cannot call TypeScript, so the rule is restated in
 * SQL and a test binds the two texts. Here the binding is stronger than "looks
 * equivalent" — the index expression must be the character-for-character inline
 * expansion of `pg_temp.ga40_norm_name` in `scripts/decision-checks.sql`,
 * because that script is the evidence the archive is clean, and an index over a
 * DIFFERENT fold would be an index nobody has measured.
 *
 * ⚠️ **WHAT THIS SUITE CANNOT DO IS RUN THE INDEX.** There is no database in
 * Jest. `scripts/verify-rebuild.ts` builds real databases and diffs them; that
 * is where the CREATE actually happens, and `.\scripts\Verify-Rebuild.ps1` is in
 * the slice's handover for that reason.
 */

import fs from "fs";
import path from "path";

import {
  DOCUMENT_TYPE_KEY_INVALID_CODE,
  DOCUMENT_TYPE_KEY_RESERVED_CODE,
  DOCUMENT_TYPE_KEY_TAKEN_CODE,
  DOCUMENT_TYPE_NAME_TAKEN_CODE,
  DOCUMENT_TYPE_NAME_UNIQUE_INDEX,
  DocumentTypeKeyRefusedError,
  DocumentTypeNameTakenError,
  MAX_DOCUMENT_TYPE_KEY_LENGTH,
  asDocumentTypeKeyRefused,
  asDocumentTypeNameTaken,
  documentTypeKeyRefusal,
  documentTypeKeyRefusalCode,
  documentTypeNameTakenBy,
} from "@/lib/documents/document-type-name-guard";
import { normaliseDocumentTypeName } from "@/lib/documents/document-type-match";
import { requestedDocumentTypeKey, slugifyLookupKey } from "@/lib/admin/value-lists/keys";
import { LIST_META, VALID_LIST_KEYS } from "@/lib/admin/value-lists/config";
import {
  documentTypeSchema,
  documentTypeUpdateSchema,
} from "@/lib/admin/value-lists/validation";
import { FAILURE_CODES } from "@/lib/admin/value-lists/failures";

const ROOT = process.cwd();

function readRoot(...parts: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...parts), "utf8");
}

const MIGRATION = readRoot("src", "db", "migration_080_document_type_name_unique.sql");
const DECISION_CHECKS = readRoot("scripts", "decision-checks.sql");
const SCHEMA = readRoot("src", "db", "schema", "index.ts");

/** Whitespace is not information in SQL; everything else in these texts is. */
function squash(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

const ROWS = [
  { id: "id-cv", key: "CONTRACT_VANZARE", name: "Contract de Vânzare" },
  { id: "id-un", key: "UNCLASSIFIED",     name: "NECLASIFICAT" },
  { id: "id-dash", key: "ZZZ_DASH",       name: "—" },
];

// ---------------------------------------------------------------------------
// 1. One name, however it is spelled
// ---------------------------------------------------------------------------

describe("documentTypeNameTakenBy", () => {
  it.each([
    ["the same name",            "Contract de Vânzare"],
    ["different diacritics",     "Contract de Vanzare"],
    ["different case",           "CONTRACT DE VANZARE"],
    ["different punctuation",    "Contract-de-Vânzare!"],
    ["different spacing",        "  Contract  de  Vânzare  "],
    // NFD: "a" + U+0302 COMBINING CIRCUMFLEX, which is what a good deal of
    // scanned OCR and older Windows keyboards produce. `normaliseDocumentTypeName`
    // decomposes rather than mapping characters precisely so this costs nothing.
    ["a decomposed spelling",    "Contract de Va\u0302nzare"],
  ])("refuses a second type whose name differs only by %s", (_why, name) => {
    const taken = documentTypeNameTakenBy(name, ROWS);
    expect(taken?.key).toBe("CONTRACT_VANZARE");
  });

  it("allows a name that is genuinely different", () => {
    expect(documentTypeNameTakenBy("Contract de Arendă", ROWS)).toBeNull();
  });

  /**
   * ⚠️ **THE EXCEPTION, AND IT IS THE HALF THAT IS EASY TO GET WRONG.**
   * `sameDocumentTypeName` answers false for two empty normalised forms
   * deliberately: a name of „—" or of a single space normalises to nothing, and
   * treating those as equal would let ONE punctuation-only type absorb every
   * other one. This suite pins the consequence rather than the mechanism, so a
   * "tidy-up" of the guard that dropped the empty test would fail here.
   */
  it("⚠️ still allows a punctuation-only name, even beside another one", () => {
    expect(documentTypeNameTakenBy("—", ROWS)).toBeNull();
    expect(documentTypeNameTakenBy("   ", ROWS)).toBeNull();
    expect(documentTypeNameTakenBy("...", ROWS)).toBeNull();
  });

  /**
   * ⚠️ **Without `exceptId` every rename refuses itself.** The row being
   * renamed is among the rows being searched, and „Contract de Vânzare" →
   * „Contract de Vanzare" is the same normalised name — which is exactly the
   * edit a rename is FOR: correcting a spelling is not creating a duplicate.
   */
  it("⚠️ does not let a row collide with itself on a rename", () => {
    expect(documentTypeNameTakenBy("Contract de Vanzare", ROWS, "id-cv")).toBeNull();
    // …and still sees everyone else.
    expect(documentTypeNameTakenBy("neclasificat", ROWS, "id-cv")?.key).toBe("UNCLASSIFIED");
  });

  it("ignores rows whose name is not a string, and a name that is not one", () => {
    expect(documentTypeNameTakenBy("Contract de Vânzare", [{ id: "x", name: null }])).toBeNull();
    expect(documentTypeNameTakenBy(undefined, ROWS)).toBeNull();
    expect(documentTypeNameTakenBy(42, ROWS)).toBeNull();
  });
});

describe("the refusal itself", () => {
  it("carries the colliding row's name and is recognised by its own helper", () => {
    const err = new DocumentTypeNameTakenError("Contract de Vânzare");
    expect(asDocumentTypeNameTaken(err)?.takenBy).toBe("Contract de Vânzare");
    expect(asDocumentTypeNameTaken(new Error("something else"))).toBeNull();
    expect(asDocumentTypeNameTaken(null)).toBeNull();
  });

  /**
   * ⚠️ **A `FailureCode` with no message renders as the raw key path on a
   * Romanian-only screen** — `failures.ts`'s whole reason for existing.
   * `value-list-dependents.test.ts` iterates `FAILURE_CODES` against both
   * locales already; this asserts the two members #34.09 adds are actually in
   * that array, so the wire code and the sentence cannot part company.
   */
  it("⚠️ both new codes are members of FAILURE_CODES", () => {
    expect(FAILURE_CODES).toContain("documentTypeNameTaken");
    expect(FAILURE_CODES).toContain("documentTypeKeyTaken");
  });

  it("the wire codes are snake_case, matching the guards they travel beside", () => {
    expect(DOCUMENT_TYPE_NAME_TAKEN_CODE).toBe("document_type_name_taken");
    expect(DOCUMENT_TYPE_KEY_TAKEN_CODE).toBe("document_type_key_taken");
    expect(DOCUMENT_TYPE_KEY_INVALID_CODE).toBe("document_type_key_invalid");
    expect(DOCUMENT_TYPE_KEY_RESERVED_CODE).toBe("document_type_key_reserved");
  });

  it("⚠️ every one of the four codes is a member of FAILURE_CODES", () => {
    for (const c of [
      "documentTypeNameTaken", "documentTypeKeyTaken",
      "documentTypeKeyInvalid", "documentTypeKeyReserved",
    ]) {
      expect(FAILURE_CODES).toContain(c);
    }
  });
});

// ---------------------------------------------------------------------------
// 1b. A key a person may not have
// ---------------------------------------------------------------------------

/**
 * ⚠️ **THIS WHOLE BLOCK IS A HOLE THE SLICE OPENED AND AN ADVERSARIAL ROUND
 * FOUND.** Before #34.09 a document type's key was ALWAYS the slug of its name,
 * so a row could only end up keyed `NECLASIFICAT` or `CARTE_IDENTITATE` by
 * being NAMED something that slugs to one of those — and those names are
 * recognised by the same guards that recognise the keys. `requestedDocumentTypeKey`
 * severed key from name, and nothing else noticed: the two create-time guards
 * beside it both return `null` on their first line when the write carries no
 * form, and the Reference Data create form never sends one.
 */
describe("documentTypeKeyRefusal", () => {
  it("says nothing about a key nobody asked for", () => {
    expect(documentTypeKeyRefusal(undefined, "Act Adițional")).toBeNull();
    expect(documentTypeKeyRefusal(null, "Act Adițional")).toBeNull();
    expect(documentTypeKeyRefusal("", "Act Adițional")).toBeNull();
    expect(documentTypeKeyRefusal("   ", "Act Adițional")).toBeNull();
  });

  it("allows an ordinary key", () => {
    expect(documentTypeKeyRefusal("ACT_ADITIONAL", "Act Adițional")).toBeNull();
    expect(documentTypeKeyRefusal("act aditional", "Act Adițional")).toBeNull();
  });

  it("refuses a key with nothing in it to become a key", () => {
    expect(documentTypeKeyRefusal("—", "Act Adițional")).toBe("invalid");
    expect(documentTypeKeyRefusal("!!!", "Act Adițional")).toBe("invalid");
    expect(documentTypeKeyRefusal("___", "Act Adițional")).toBe("invalid");
  });

  it("refuses a slug longer than the archive allows, measured on the SLUG", () => {
    const long = "A".repeat(MAX_DOCUMENT_TYPE_KEY_LENGTH + 1);
    expect(documentTypeKeyRefusal(long, "x")).toBe("invalid");
    expect(documentTypeKeyRefusal("A".repeat(MAX_DOCUMENT_TYPE_KEY_LENGTH), "x")).toBeNull();
    // ⚠️ Uppercasing LENGTHENS: „ß" becomes „SS". A ceiling on the typed text
    // would not be a ceiling on the column, which is why this is measured after
    // the slug.
    expect("ß".toUpperCase()).toBe("SS");
  });

  /**
   * ⚠️ **THE MEASURED SEQUENCE.** `NECLASIFICAT` is the catch-all's NAME; its
   * KEY is `UNCLASSIFIED`. So no stored row holds the key `NECLASIFICAT`,
   * `PREFERRED_KEY_TAKEN` does not fire, and before this guard the row was
   * created — after which `documentTypeIsCatchAll` answered true for it and the
   * form editor refused a form on a row named „Contract de Vânzare", in
   * Romanian, about the unclassified catch-all.
   */
  it.each([
    ["NECLASIFICAT",     "Contract de Vânzare"],
    ["UNCLASSIFIED",     "Contract de Vânzare"],
    ["CARTE_IDENTITATE", "Contract de Vânzare"],
    ["neclasificat",     "Act Adițional"],
  ])("⚠️ refuses the reserved key %s under the unrelated name %s", (key, name) => {
    expect(documentTypeKeyRefusal(key, name)).toBe("reserved");
  });

  /**
   * ⚠️ **"UNLESS THE NAME AGREES" RATHER THAN A FLAT BAN**, because the archive
   * legitimately needs those rows — migration_072 seeds the catch-all, and
   * #29.07 exists so an identity-card type can be minted under its canonical
   * key. What must never exist is a row whose KEY says one thing and whose NAME
   * says another.
   */
  it.each([
    ["UNCLASSIFIED",     "NECLASIFICAT"],
    ["NECLASIFICAT",     "Neclasificat"],
    ["CARTE_IDENTITATE", "Carte de Identitate"],
  ])("⚠️ allows the reserved key %s when the name says the same thing (%s)", (key, name) => {
    expect(documentTypeKeyRefusal(key, name)).toBeNull();
  });

  it("carries its refusal, and is recognised by its own helper", () => {
    const err = new DocumentTypeKeyRefusedError("reserved");
    expect(asDocumentTypeKeyRefused(err)?.refusal).toBe("reserved");
    expect(asDocumentTypeKeyRefused(new Error("nope"))).toBeNull();
    expect(documentTypeKeyRefusalCode("reserved")).toBe(DOCUMENT_TYPE_KEY_RESERVED_CODE);
    expect(documentTypeKeyRefusalCode("invalid")).toBe(DOCUMENT_TYPE_KEY_INVALID_CODE);
  });
});

// ---------------------------------------------------------------------------
// 2. The migration says the same thing, in the same words
// ---------------------------------------------------------------------------

/**
 * The body of `pg_temp.ga40_norm_name` from `scripts/decision-checks.sql`, with
 * its `$1` replaced by a column reference — i.e. what the index expression has
 * to be if it is to index the text the archive was measured over.
 */
const FOLD_FROM_DECISION_CHECKS = (() => {
  const m = DECISION_CHECKS.match(
    /CREATE OR REPLACE FUNCTION pg_temp\.ga40_fold\(txt text\) RETURNS text AS \$\$([\s\S]*?)\$\$/,
  );
  if (!m) throw new Error("scripts/decision-checks.sql: pg_temp.ga40_fold not found");
  return squash(m[1]).replace(/^SELECT /, "");
})();

describe("migration_080 encodes the code's own normalisation", () => {
  it("⚠️ carries the fold from scripts/decision-checks.sql, character for character", () => {
    // `$1` in the function body is the argument; in the index it is the column.
    const expected = squash(FOLD_FROM_DECISION_CHECKS.replace(/\$1/g, "name"));
    expect(squash(MIGRATION)).toContain(expected);
  });

  it("⚠️ creates the index the code names, under the name the code holds", () => {
    expect(MIGRATION).toContain(
      `CREATE UNIQUE INDEX IF NOT EXISTS ${DOCUMENT_TYPE_NAME_UNIQUE_INDEX}`,
    );
    expect(MIGRATION).toContain("ON lookup_document_type (");
  });

  /**
   * ⚠️ **PARTIAL, and the predicate is what makes the punctuation-only name
   * legal in the DATABASE as well as in the guard.** A total unique index would
   * give the first such row the empty slot and refuse every other one — the
   * opposite of `sameDocumentTypeName`'s rule, encoded one layer down where
   * nobody would look for it.
   */
  it("⚠️ excludes the empty normalised form", () => {
    expect(squash(MIGRATION)).toContain("'[^a-z0-9]', '', 'g') <> ''");
  });

  it("⚠️ indexes and filters on the SAME expression", () => {
    // Postgres compares the two structurally when it decides whether a query
    // may use a partial index; two folds that differed would still create,
    // still enforce uniqueness, and cover a different set of rows than they
    // appear to. Both occurrences are the decision-checks fold, so counting
    // them is the check.
    const expected = squash(FOLD_FROM_DECISION_CHECKS.replace(/\$1/g, "name"));
    const body = squash(MIGRATION.slice(MIGRATION.indexOf("CREATE UNIQUE INDEX")));
    expect(body.split(expected).length - 1).toBeGreaterThanOrEqual(2);
  });

  it("is wrapped in a transaction and is idempotent by name", () => {
    expect(MIGRATION).toContain("BEGIN;");
    expect(MIGRATION.trimEnd().endsWith("COMMIT;")).toBe(true);
    expect(MIGRATION).toContain("CREATE UNIQUE INDEX IF NOT EXISTS");
  });

  /**
   * ⚠️ **The refusal is what makes the migration readable on a database nobody
   * measured.** A bare `CREATE UNIQUE INDEX` on a colliding table fails with
   * `Key (...)=(...) is duplicated`, naming the NORMALISED form and neither of
   * the two rows. Section 1 names both, their keys and their document counts.
   */
  it("⚠️ refuses, rather than merges, when the archive already collides", () => {
    expect(MIGRATION).toContain("migration_080 REFUSED");
    expect(MIGRATION).toContain("RAISE EXCEPTION");
  });

  it("⚠️ src/db/schema/index.ts declares the same index under the same name", () => {
    expect(SCHEMA).toContain(`uniqueIndex("${DOCUMENT_TYPE_NAME_UNIQUE_INDEX}")`);
  });
});

// ---------------------------------------------------------------------------
// 3. The key a person typed is the key stored
// ---------------------------------------------------------------------------

describe("requestedDocumentTypeKey", () => {
  it.each([
    ["CONTRACT_VANZARE", "CONTRACT_VANZARE"],
    ["contract_vanzare", "CONTRACT_VANZARE"],
    ["Contract Vânzare",  "CONTRACT_VANZARE"],
    ["  act aditional  ", "ACT_ADITIONAL"],
    ["act-de-alipire",    "ACT_DE_ALIPIRE"],
    ["Act de Dezmembrare", "ACT_DE_DEZMEMBRARE"],
  ])("%s is stored as %s", (typed, stored) => {
    expect(requestedDocumentTypeKey(typed)).toBe(stored);
  });

  it("⚠️ answers null for did-not-ask, in every spelling the form can produce", () => {
    // `startAdd` seeds every text field to "" and the POST body is that object
    // verbatim, so a blank key arrives as an empty string rather than as an
    // absent one.
    expect(requestedDocumentTypeKey("")).toBeNull();
    expect(requestedDocumentTypeKey("   ")).toBeNull();
    expect(requestedDocumentTypeKey(undefined)).toBeNull();
    expect(requestedDocumentTypeKey(null)).toBeNull();
  });

  /**
   * ⚠️ **`DOCTYPE` is the fallback for a NAME that slugs to nothing, and it must
   * never become the answer for a KEY.** `lookup_document_type.key` is NOT NULL,
   * so slugging a name has to produce something; slugging a key a person typed
   * has no such obligation, and minting a permanent immutable key out of a typo
   * is the exact shape D-03 exists to remove.
   */
  it("⚠️ never mints the DOCTYPE fallback out of a key that slugs to nothing", () => {
    expect(slugifyLookupKey("—")).toBe("DOCTYPE");
    expect(requestedDocumentTypeKey("—")).toBeNull();
    expect(requestedDocumentTypeKey("!!!")).toBeNull();
  });
});

describe("the create form's key field", () => {
  it("⚠️ is on document-types and on no other list", () => {
    for (const list of VALID_LIST_KEYS) {
      const hasKeyField = LIST_META[list].fields.some((f) => f.key === "key");
      expect(`${list}: ${hasKeyField}`).toBe(`${list}: ${list === "document-types"}`);
    }
  });

  /**
   * ⚠️ **THE EXACT FIELD LIST, because `LIST_META` alone is caught by nothing.**
   * `person-role-flags.test.ts` learned this the expensive way: an adversarial
   * round added a fourth entry to that list and every suite stayed green — the
   * form rendered an input the server drops, under a label that exists in
   * neither locale, printing the raw key path in the shipping language.
   * `document-types` had no such pin at all before this slice.
   */
  it("⚠️ is the whole field list, in order", () => {
    expect(LIST_META["document-types"].fields.map((f) => f.key)).toEqual(["name", "key"]);
  });

  it("⚠️ is createOnly, and is the only field on any list that is", () => {
    const createOnly = VALID_LIST_KEYS.flatMap((list) =>
      LIST_META[list].fields.filter((f) => f.createOnly).map((f) => `${list}.${f.key}`),
    );
    expect(createOnly).toEqual(["document-types.key"]);
  });

  /**
   * ⚠️ **`required: false` is load-bearing twice over.** An absent key still
   * gets the slug of the name, so the field offers a choice rather than
   * imposing one — and `value-list-ordering.test.ts` asserts every list has
   * EXACTLY ONE required field, because that is the field its `ORDER BY` has to
   * end on. Pinned here so the reason survives beside the field.
   */
  it("⚠️ leaves `name` as the list's single required field", () => {
    expect(LIST_META["document-types"].fields.filter((f) => f.required).map((f) => f.key))
      .toEqual(["name"]);
  });

  it.each(["ro-RO", "en-GB"] as const)("%s has a label for it", (locale) => {
    const m = JSON.parse(
      fs.readFileSync(path.join(ROOT, "messages", `${locale}.json`), "utf8"),
    ) as { valueList: { fields: Record<string, unknown> } };
    for (const f of LIST_META["document-types"].fields) {
      expect(`${locale}:${f.key}:${typeof m.valueList.fields[f.labelKey]}`)
        .toBe(`${locale}:${f.key}:string`);
    }
  });
});

describe("the schemas", () => {
  it("⚠️ a key entered on the create form survives validation unchanged", () => {
    const parsed = documentTypeSchema.parse({ name: "Act adițional", key: "ACT_ADITIONAL" });
    expect(parsed.key).toBe("ACT_ADITIONAL");
  });

  it("⚠️ a blank key parses to absent, not to an empty string", () => {
    expect(documentTypeSchema.parse({ name: "Act adițional", key: "" }).key).toBeUndefined();
    expect(documentTypeSchema.parse({ name: "Act adițional", key: null }).key).toBeUndefined();
    expect(documentTypeSchema.parse({ name: "Act adițional" }).key).toBeUndefined();
  });

  /**
   * ⚠️ **ZOD IS NOT WHERE A BAD KEY IS REFUSED, AND AN ADVERSARIAL ROUND MOVED
   * IT.** A zod issue carries no `code`, so a zod-refused key answers a bare
   * 400 and `throwRequestFailed(res, true)` renders „a required field is
   * missing or wrong" — pointing an administrator at `name`, which is filled in
   * correctly. Every rule about a key is `documentTypeKeyRefusal`'s, thrown
   * from the query layer with a `code` and said in Romanian. What zod still
   * does is the type and the transport bound.
   */
  it("⚠️ passes a bad key THROUGH, so the refusal that carries a code can say it", () => {
    expect(documentTypeSchema.safeParse({ name: "x", key: "—" }).success).toBe(true);
    expect(documentTypeSchema.safeParse({ name: "x", key: "___" }).success).toBe(true);
    // …and the guard is what refuses them.
    expect(documentTypeKeyRefusal("—", "x")).toBe("invalid");
    expect(documentTypeKeyRefusal("___", "x")).toBe("invalid");
  });

  /**
   * ⚠️ **RE-KEYING IS WORSE THAN RE-ORIGINATING, WHICH IS WHY `key` JOINS
   * `origin` IN THE OMIT.** A wrong `origin` is a wrong label on a screen; a
   * changed `key` silently detaches a type from `KNOWN_DOCUMENT_TYPES`,
   * `ID_CARD_TYPE_KEYS`, `type-config.ts`, `catchAllType` and `listValues`'
   * UNCLASSIFIED pin — all of which match the literal key — while every document
   * already filed under it stays where it is.
   */
  it("⚠️ neither key nor origin can reach the UPDATE path", () => {
    const parsed = documentTypeUpdateSchema.parse({
      name:   "Act adițional",
      key:    "SOMETHING_ELSE",
      origin: "IMPORT",
    }) as Record<string, unknown>;
    expect("key" in parsed).toBe(false);
    expect("origin" in parsed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. The two halves agree about what "the same name" is
// ---------------------------------------------------------------------------

describe("⚠️ the guard and the index cannot disagree", () => {
  it("the guard is built on normaliseDocumentTypeName, not on a second fold", () => {
    // If these ever diverge, the application refuses one set of pairs and the
    // database refuses another, and the difference surfaces as a 500 on a name
    // the form said was fine.
    const a = "Contract de Vânzare";
    const b = "contract-de-vanzare";
    expect(normaliseDocumentTypeName(a)).toBe(normaliseDocumentTypeName(b));
    expect(documentTypeNameTakenBy(b, ROWS)?.name).toBe(a);
  });

  it("the empty normalised form is the one place they both stand down", () => {
    expect(normaliseDocumentTypeName("—")).toBe("");
    expect(documentTypeNameTakenBy("—", ROWS)).toBeNull();
    expect(squash(MIGRATION)).toContain("'[^a-z0-9]', '', 'g') <> ''");
  });
});
