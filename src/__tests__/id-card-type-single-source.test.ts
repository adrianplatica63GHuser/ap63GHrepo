/**
 * "Is this document type an identity card" has ONE answer, and every server
 * door that can write `template_fields` asks it.               (Slice #32.07)
 *
 * WHAT IS AT RISK
 * ---------------
 * A document type whose data is an identity card must never carry a form. Its
 * fields are `cnp`, `nume`, `domiciliu` — captured by the import's own
 * identity-card step as real Person records, where migration_025's trigger
 * makes the CNP immutable. A form on the same type is a SECOND, freely
 * editable copy of somebody's national identity number on every document of
 * that type. `discover-run.ts`, `status.ts` and `id-card.ts` all state that
 * argument; until this slice nothing on a write path enforced it.
 *
 * `lookup_document_type` held the proof: a row keyed
 * CARTE_DE_IDENTITATE_DOUA_EXEMPLARE, named „Carte de identitate (două
 * exemplare)", carrying a 24-field form — two complete identity records,
 * including two CNPs — while Distilare Tipizate was refusing, on screen, to
 * give that same row a form.
 *
 * WHY THIS FILE IS SHAPED LIKE `template-field-key-rules.test.ts`
 * --------------------------------------------------------------
 * That file keeps a WRITERS list of the three SCREENS that can put a row into
 * `template_fields` — the right shape on the wrong axis. A screen-side rule is
 * what produced the row above: five hand-copied client tests, all agreeing,
 * none of them on a write path. So this list is over the SERVER doors, and it
 * fails in both directions — if a sixth hand-copy of the key-and-name test
 * appears, and if a new write path appears without the check.
 *
 * Source scans read CODE, never comments — CLAUDE.md: a NAME guard may read
 * comments, a BEHAVIOUR guard must read only code. Every scan below is a
 * behaviour guard.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, sep } from "path";

import { documentTypeIsIdCard, ID_CARD_TYPE_KEYS } from "@/lib/import/id-card";
import {
  ID_CARD_FORM_CODE,
  ID_CARD_RENAME_CODE,
  idCardFormRefusal,
  idCardRefusalCode,
  IdCardFormRefusedError,
  asIdCardFormRefusal,
} from "@/lib/documents/id-card-form-guard";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

/**
 * The two banned needles, never spelled in one piece.
 *
 * `dev-tools-single-source.test.ts` learned why: a failure message that quotes
 * the pattern it bans, inside a template literal `stripComments` cannot
 * remove, reports the guard itself as an offender. Test files are excluded
 * from the scan below as well — building the needle from halves keeps this
 * self-clean even if someone later narrows that exclusion.
 */
const NAME_TEST = "isIdCard" + "TypeName";
const KEY_LIST = "ID_CARD" + "_TYPE_KEYS";

/** Strips block and line comments so a mention in prose is not a match. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function isTestFile(relPath: string): boolean {
  return (
    relPath.includes("__tests__") ||
    relPath.endsWith(".test.ts") ||
    relPath.endsWith(".test.tsx")
  );
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

const same = (rel: string, a: string) => rel === a || rel === a.split("/").join(sep);

// ---------------------------------------------------------------------------
// 1. The predicate itself
// ---------------------------------------------------------------------------

/**
 * The two name lists come from `id-card.test.ts`, which holds them as inline
 * literals and exports nothing — they are what two adversarial rounds produced
 * for `isIdCardTypeName`, and this function is defined in terms of it.
 *
 * ⚠️ **Copied, and NOTHING CHECKS THAT THE COPIES AGREE.** A round corrected an
 * earlier version of this very comment, which claimed a divergence "IS a
 * finding": nothing detects one, and the lists already differ deliberately —
 * the vehicle name lives in `VEHICLE_NAMES` here so the veto is asserted as its
 * own case. Stated rather than dressed up; deriving both from one exported
 * fixture is the real fix and is a change to that file, not this one.
 */
const CARD_NAMES = [
  "Carte de Identitate",
  "carte identitate",
  "Cartea de identitate",
  "Act de identitate",
  "Acte de identitate",
  "Cărți de identitate",
  "Carti de identitate",
  "Buletin de identitate",
  "BULETIN DE IDENTITATE",
  // ⚠️ The row this slice exists for. The parenthesised qualifier sits outside
  // the pattern and is harmless, which is precisely why Distilare Tipizate was
  // already refusing this row while the archive held its 24-field form.
  "Carte de identitate (două exemplare)",
];

const NOT_CARD_NAMES = [
  "Buletin de analiză",
  "Buletin de încercare",
  "Copie CI",
  "Fișa CI",
  "Buletin",
  "CI",
  "C.I.",
  "Contract de Vânzare",
  "Certificat de Moștenitor",
  "Act de Adjudecare",
  "Act de Donație",
  "Act Cadastru",
  "Certificat de Urbanism",
  "Extras din Carte Funciară",
  "Titlu de Proprietate",
  "Hotărâre Judecătorească",
  "Aviz de Instituție",
];

/** The vehicle veto, which is shared with `isIdCardLabel` and is not to go. */
const VEHICLE_NAMES = [
  "Carte de identitate a vehiculului",
  "Carte de identitate auto",
  "Carte de identitate automobil",
  "Carte de identitate autoturism",
  "Carte de identitate remorcă",
];

describe("documentTypeIsIdCard — one answer, over the row's own two columns", () => {
  it.each(CARD_NAMES)("accepts the NAME %s on an ordinary key", (name) => {
    expect(documentTypeIsIdCard({ key: "CONTRACT_VANZARE", name })).toBe(true);
  });

  it.each(NOT_CARD_NAMES)("refuses the NAME %s", (name) => {
    expect(documentTypeIsIdCard({ key: "CONTRACT_VANZARE", name })).toBe(false);
  });

  it.each(VEHICLE_NAMES)("refuses %s — a vehicle's registration document", (name) => {
    expect(documentTypeIsIdCard({ key: "CARTE_IDENTITATE_VEHICUL", name })).toBe(false);
  });

  it("accepts the seeded KEY whatever the name says", () => {
    // The key arm answers on its own: a row renamed by hand is still the
    // archive's identity-card type, and `getPersonIdCardLink` matches the key.
    expect(documentTypeIsIdCard({ key: "CARTE_IDENTITATE", name: "Contract de Vânzare" })).toBe(
      true,
    );
    expect(documentTypeIsIdCard({ key: "  CARTE_IDENTITATE  ", name: "" })).toBe(true);
  });

  it("is silent about nothing at all", () => {
    expect(documentTypeIsIdCard({})).toBe(false);
    expect(documentTypeIsIdCard({ key: "", name: "" })).toBe(false);
    expect(documentTypeIsIdCard({ key: "   ", name: "   " })).toBe(false);
    expect(documentTypeIsIdCard({ key: null, name: null })).toBe(false);
  });

  it("takes no scan signal — the three scan-aware variants stay separate", () => {
    // ⚠️ **A COMPILE-TIME assertion, and an adversarial round is why.** The
    // first version of this test asserted
    // `documentTypeIsIdCard({ key: "ALTUL", name: "Buletin" }) === false`,
    // which `NOT_CARD_NAMES` already covers and which says nothing at all about
    // the parameter: someone could widen it to take the scan's verdict and OR
    // that in — the exact change this function's header forbids — and the
    // assertion would stay green. Excess-property checking fails today and
    // stops failing the moment the parameter widens, which is the fact the
    // test is actually about.
    // @ts-expect-error — the parameter is the ROW's two columns and nothing else
    documentTypeIsIdCard({ key: "ALTUL", name: "Buletin", isIdCard: true });
  });
});

// ---------------------------------------------------------------------------
// 2. The refusal
// ---------------------------------------------------------------------------

const CARD = { key: "CARTE_IDENTITATE", name: "Carte de Identitate" };
const PLAIN = { key: "CONTRACT_VANZARE", name: "Contract de Vânzare" };

describe("idCardFormRefusal — what a write would leave behind", () => {
  it("allows a form on an ordinary type", () => {
    expect(
      idCardFormRefusal({ ...PLAIN, hasForm: false }, { ...PLAIN, hasForm: true }, true),
    ).toBeNull();
  });

  it("allows an identity-card type with NO form", () => {
    expect(
      idCardFormRefusal({ ...CARD, hasForm: false }, { ...CARD, hasForm: false }, true),
    ).toBeNull();
  });

  it("refuses a form being ADDED to an identity-card type", () => {
    expect(
      idCardFormRefusal({ ...CARD, hasForm: false }, { ...CARD, hasForm: true }, true),
    ).toBe("form");
  });

  it("refuses a write that re-writes a form the card type already wrongly carries", () => {
    // The template-fields PUT is additive and always writes the column, so a
    // `fields: []` against such a row would otherwise merge the stored fields
    // back and report 200 over a form that is still there.
    expect(
      idCardFormRefusal({ ...CARD, hasForm: true }, { ...CARD, hasForm: true }, true),
    ).toBe("form");
  });

  it("ALLOWS a write that touches neither half of an already-wrong row", () => {
    // ⚠️ The round that produced the third argument. Reference Data's edit form
    // for document-types sends `{ name }` and nothing else
    // (LIST_META["document-types"].fields is `[{ key: "name" }]`), so refusing
    // here told an administrator to "save it with no fields" on a form whose
    // only input is the name — a remedy that cannot be carried out on the
    // screen showing it. The row is repaired by migration_073 and by the form
    // editor, which stays open because clearing the form makes `hasForm` false.
    expect(
      idCardFormRefusal(
        { ...CARD, hasForm: true },
        { key: CARD.key, name: "Carte de identitate", hasForm: true },
        false,
      ),
    ).toBeNull();
  });

  it("does NOT excuse a key moved onto the canonical one, even with no fields", () => {
    // ⚠️ A later round found the carve-out above cancelling the `after.key`
    // fix made in the same round. `updateValue` is `.set(values)` over whatever
    // a direct caller hands it and `key` is a real column, so
    // `{ key: "CARTE_IDENTITATE" }` with no `templateFields`, against the row
    // this slice exists for, is "neither half changed" — and would have landed
    // its 24-field form on the key `getPersonIdCardLink` and every carve-out in
    // the codebase match.
    expect(
      idCardFormRefusal(
        { key: "CARTE_DE_IDENTITATE_DOUA_EXEMPLARE", name: "Carte de identitate (două exemplare)", hasForm: true },
        { key: "CARTE_IDENTITATE", name: "Carte de identitate (două exemplare)", hasForm: true },
        false,
      ),
    ).toBe("form");
  });

  it("still refuses a name-only write that makes an ORDINARY type a card", () => {
    // The carve-out above is about a row that was ALREADY wrong. This one is
    // the write that makes it wrong, and it carries no `templateFields` either.
    expect(
      idCardFormRefusal(
        { ...PLAIN, hasForm: true },
        { key: PLAIN.key, name: "Carte de identitate", hasForm: true },
        false,
      ),
    ).toBe("rename");
  });

  it("refuses a CREATE that is an identity card with a form, as `form`", () => {
    // No stored row, so there is no rename to undo — the fields are the change.
    expect(idCardFormRefusal(null, { ...CARD, hasForm: true }, true)).toBe("form");
    expect(
      idCardFormRefusal(null, { key: "X", name: "Buletin de identitate", hasForm: true }, true),
    ).toBe("form");
  });

  it("allows a CREATE of an identity-card type with no form", () => {
    // The archive NEEDS a CARTE_IDENTITATE row to file cards under; refusing to
    // mint one would break `getPersonIdCardLink` on every person.
    expect(idCardFormRefusal(null, { ...CARD, hasForm: false }, false)).toBeNull();
  });

  it("calls a rename that ADDS the form `form`, because the fields are the change", () => {
    expect(
      idCardFormRefusal(
        { ...PLAIN, hasForm: false },
        { key: PLAIN.key, name: "Carte de identitate", hasForm: true },
        true,
      ),
    ).toBe("form");
  });

  it("allows a rename INTO an identity card when the form is being cleared", () => {
    expect(
      idCardFormRefusal(
        { ...PLAIN, hasForm: true },
        { key: PLAIN.key, name: "Carte de identitate", hasForm: false },
        true,
      ),
    ).toBeNull();
  });

  it("judges the KEY the write would leave, not only the stored one", () => {
    // ⚠️ `updateValue` is `.set(values)` over whatever object it is handed and
    // `key` is a real column, so a direct caller can move a row onto the
    // canonical identity-card key. Judging `after` from the stored key alone
    // let that caller write the key and a form together.
    expect(
      idCardFormRefusal(
        { ...PLAIN, hasForm: false },
        { key: "CARTE_IDENTITATE", name: PLAIN.name, hasForm: true },
        true,
      ),
    ).toBe("form");
  });

  it("carries the two halves under distinct codes", () => {
    expect(idCardRefusalCode("form")).toBe(ID_CARD_FORM_CODE);
    expect(idCardRefusalCode("rename")).toBe(ID_CARD_RENAME_CODE);
    expect(ID_CARD_FORM_CODE).not.toBe(ID_CARD_RENAME_CODE);
  });

  it("recognises its own error by NAME, not by instanceof", () => {
    // Next bundles the routes and the queries separately; a duplicated module
    // identity would make `instanceof` answer false and turn a named 400 into
    // a 500, silently, on the one path this slice exists for.
    expect(asIdCardFormRefusal(new IdCardFormRefusedError("rename"))).toBe("rename");
    expect(asIdCardFormRefusal(new IdCardFormRefusedError("form"))).toBe("form");
    const impostor = new Error("x");
    impostor.name = "IdCardFormRefusedError";
    expect(asIdCardFormRefusal(impostor)).toBe("form");
    expect(asIdCardFormRefusal(new Error("something else"))).toBeNull();
    expect(asIdCardFormRefusal(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. The predicate has ONE definition, and no sixth copy of it exists
// ---------------------------------------------------------------------------

/**
 * Where the two building blocks may be spelled, and why each is allowed.
 *
 * ⚠️ **`persons/queries.ts` is on the KEY list and is not an exemption.** It
 * holds the ninth spelling this slice folded in: it compared
 * `lookupDocumentType.key` to a bare `"CARTE_IDENTITATE"` literal. It now asks
 * the array — which is a USE of the owner, not a copy of the rule, because the
 * NAME arm is not part of the question a SQL `WHERE` can ask.
 */
const KEY_LIST_ALLOWED = [
  "lib/import/id-card.ts",
  "lib/persons/queries.ts",
];

describe("the identity-card TYPE test has one definition", () => {
  const files = walk(SRC);

  it("finds source files to scan", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("exports the predicate exactly once", () => {
    const definitions = files.filter((file) =>
      /export\s+function\s+documentTypeIsIdCard\s*\(/.test(
        stripComments(readFileSync(file, "utf8")),
      ),
    );
    expect(definitions.map((f) => relative(SRC, f))).toEqual([
      join("lib", "import", "id-card.ts"),
    ]);
  });

  it("has no sixth hand-copy: the NAME test is spelled only where it is defined", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(SRC, file);
      if (isTestFile(rel)) continue;
      if (same(rel, "lib/import/id-card.ts")) continue;
      if (stripComments(readFileSync(file, "utf8")).includes(NAME_TEST)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("spells the KEY list only where it is defined and where it is USED as a set", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(SRC, file);
      if (isTestFile(rel)) continue;
      if (KEY_LIST_ALLOWED.some((a) => same(rel, a))) continue;
      if (stripComments(readFileSync(file, "utf8")).includes(KEY_LIST)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. Every server door that can write template_fields consults the predicate
// ---------------------------------------------------------------------------

const VL_QUERIES = "src/lib/admin/value-lists/queries.ts";
const DOC_QUERIES = "src/lib/documents/queries.ts";
const TEMPLATE_FIELDS_ROUTE = "src/app/api/document-types/[id]/template-fields/route.ts";
const VL_PUT_ROUTE = "src/app/api/admin/value-lists/[list]/[id]/route.ts";
const VL_POST_ROUTE = "src/app/api/admin/value-lists/[list]/route.ts";

/**
 * Every path that can put a row into `lookup_document_type.template_fields`,
 * and the file where its refusal lives.
 *
 * The two are the same file for the value-lists doors — the guard is thrown
 * from the query layer, so a direct caller of `updateValue`/`createValue` is
 * bound by it too (`ai-interpret` was exactly such a caller until #29.06). For
 * the template-fields PUT the writer is a query that takes `(id, fields)` and
 * the row identity is read by the ROUTE, so that is where the check sits.
 */
const WRITE_PATHS: Array<[string, string, string]> = [
  ["setDocumentTypeTemplateFields", DOC_QUERIES, TEMPLATE_FIELDS_ROUTE],
  ["updateValue", VL_QUERIES, VL_QUERIES],
  ["createDocumentTypeRow", VL_QUERIES, VL_QUERIES],
];

/**
 * One exported function's body, from its signature to the next top-level
 * `export`.
 *
 * ⚠️ **Per-FUNCTION, not per-file, and an adversarial round is why.** Two of
 * the three rows above name one file, so a whole-file `toContain` was one
 * assertion wearing three hats: drop the guard from `createDocumentTypeRow` and
 * `updateValue`'s copy keeps the file green while the POST door stands open.
 */
/**
 * ⚠️ **BRACE-MATCHED, NOT "up to the next `export`", AND A ROUND MEASURED WHY.**
 * The scan-for-the-next-`export` version gave `createDocumentTypeRow` a correct
 * 109-line slice and `updateValue` a 238-line one that ran 126 lines past the
 * end of the function, swallowing five private helpers — so the isolation this
 * helper exists for held only by the accident of declaration order, and a guard
 * needle appearing in any of those five would have satisfied the assertion.
 * `fnBodyOf`'s slice ran to end-of-file for the same reason.
 *
 * ⚠️ **AND THE SCAN STARTS AFTER THE PARAMETER LIST, not at the first `{`.**
 * A later round found that too: a signature holding a brace of its own — a
 * destructured parameter object, an inline object type, an object return type —
 * put the scan inside the signature, and the slice then ended at the signature's
 * own closing brace. Measured on a `updateValue({ key, id, data })` refactor:
 * a 54-line slice with no guard in it, i.e. a RED test over a change that broke
 * nothing.
 *
 * Counting braces is enough here and would not be in general: these are
 * ordinary function declarations, and the only braces a TS body carries that
 * this cannot see are inside a string or a comment containing an unbalanced one.
 * The callers pass `stripComments`ed source; an unbalanced `{` in a string
 * literal would give a slice that runs too LONG, which every assertion here is
 * `toContain` and therefore cannot see. That is a limit of the helper, stated
 * rather than papered over — what it does buy is that a guard in a NEIGHBOURING
 * exported function can no longer stand in for a missing one, which is the
 * failure it was written for.
 */
function sliceFunction(source: string, header: RegExp): string {
  const at = source.search(header);
  if (at < 0) return "";
  const params = source.indexOf("(", at);
  if (params < 0) return "";
  let parens = 0;
  let afterParams = -1;
  for (let i = params; i < source.length; i += 1) {
    if (source[i] === "(") parens += 1;
    else if (source[i] === ")") {
      parens -= 1;
      if (parens === 0) {
        afterParams = i;
        break;
      }
    }
  }
  if (afterParams < 0) return "";
  // ⚠️ **THE BODY'S BRACE IS THE FIRST ONE OUTSIDE A TYPE ARGUMENT LIST**, and
  // two rounds walked into the two wrong answers before this one. "The first
  // `{` after the parameters" lands inside an object RETURN type
  // (`): Promise<{ row: LookupRow | null }> {`); "the first `{` at end of line"
  // fixes that on one line and not on a wrapped one, and mis-handles a
  // single-line body entirely — it skips past to the NEXT function's brace, so
  // the slice swallows a neighbour, which is the leak this helper exists to
  // close. Counting `<`/`>` costs three lines and answers all three: between
  // `)` and the body there is nothing but type syntax.
  let angle = 0;
  let bodyAt = -1;
  for (let i = afterParams; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "<") angle += 1;
    // Clamped, so a `=>` in a function-typed return annotation cannot drive it
    // negative and swallow the body brace.
    else if (ch === ">") angle = Math.max(0, angle - 1);
    else if (ch === "{" && angle === 0) {
      bodyAt = i;
      break;
    }
  }
  if (bodyAt < 0) return "";
  let depth = 0;
  for (let i = bodyAt; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(at, i + 1);
    }
  }
  return "";
}

function fnBodyOf(source: string, name: string): string {
  return sliceFunction(source, new RegExp(`function\\s+${name}\\b`));
}

function bodyOf(source: string, name: string): string {
  return sliceFunction(source, new RegExp(`export\\s+(async\\s+)?function\\s+${name}\\b`));
}

describe("every server door that writes template_fields consults the predicate", () => {
  it("the set of files that WRITE lookup_document_type is exactly the known one", () => {
    // ⚠️ This is the half that fails when a NEW write path appears. A fourth
    // door added anywhere under src/ shows up here before anybody has to
    // remember this file exists.
    // ⚠️ **TWO NEEDLES, because this codebase writes lookup tables BOTH ways.**
    // The builder form is what the three known writers use; the raw-SQL form is
    // real too — `value-lists/queries.ts`'s reassign path is
    // ``db.execute(sql`UPDATE ${table} SET ...`)`` — so a fourth door written
    // that way would have slipped past a builder-only scan, and this test is
    // documented as the half that fails when a new write path appears.
    const WRITES = [
      /\.(update|insert)\(\s*lookupDocumentType\s*\)/,
      /(UPDATE|INSERT\s+INTO)\s+lookup_document_type\b/i,
    ];
    const writers = walk(SRC)
      .filter((file) => !isTestFile(relative(SRC, file)))
      .filter((file) => {
        const code = stripComments(readFileSync(file, "utf8"));
        return WRITES.some((re) => re.test(code));
      })
      .map((file) => join("src", relative(SRC, file)));
    expect(writers.sort()).toEqual(
      [DOC_QUERIES, VL_QUERIES].map((p) => p.split("/").join(sep)).sort(),
    );
  });

  it.each(WRITE_PATHS)("%s is guarded in %s", (name, _writer, guard) => {
    const code = stripComments(read(guard));
    expect(code).toContain("@/lib/documents/id-card-form-guard");
    if (guard === VL_QUERIES) {
      // The guard is IN the writer, so assert it inside that function's body.
      const body = bodyOf(code, name);
      expect(body).not.toBe("");
      expect(body).toContain("idCardFormRefusal(");
      expect(body).toContain("IdCardFormRefusedError");
    } else {
      // `setDocumentTypeTemplateFields` takes `(id, fields)` and never sees the
      // row's identity, so its refusal lives in the route that reads the row.
      expect(code).toContain("idCardFormRefusal(");
    }
  });

  it("the template-fields PUT refuses BEFORE it answers 409", () => {
    // ⚠️ **The order is the guard.** A stale `knownKeys` on an identity-card
    // type answered with "the form changed — check the list and press Save
    // again" is a loop the user cannot leave: the remedy the message names does
    // not address the reason for the refusal. That is #26.02's unfixable
    // message, rebuilt.
    const code = stripComments(read(TEMPLATE_FIELDS_ROUTE));
    const refusal = code.indexOf("idCardFormRefusal(");
    const conflict = code.indexOf("template_changed");
    expect(refusal).toBeGreaterThan(-1);
    expect(conflict).toBeGreaterThan(-1);
    expect(refusal).toBeLessThan(conflict);
  });

  it.each([
    ["value-lists PUT", VL_PUT_ROUTE],
    ["value-lists POST", VL_POST_ROUTE],
  ])("%s turns the refusal into a named 400", (_name, route) => {
    const code = stripComments(read(route));
    expect(code).toContain("asIdCardFormRefusal");
    expect(code).toContain("idCardRefusalCode");
    expect(code).toMatch(/status:\s*400/);
  });

  it("the value-lists PUT reads the STORED row, so a rename is judged too", () => {
    // Without the read the payload alone decides, and a plain rename carries no
    // `templateFields` at all — so the door that this row most likely came
    // through would be the one door still open.
    const code = stripComments(read(VL_QUERIES));
    expect(code).toMatch(/templateFields:\s*lookupDocumentType\.templateFields/);
    expect(code).toContain("IdCardFormRefusedError");
  });

  it("the resolver answers the same question one step earlier", () => {
    // POST /api/document-types/resolve MINTS a type mid-run; `docTypeIdCardRef`
    // is built once from the start-of-run list and has no entry for it, so the
    // wizard's test collapses to the scan's signal — the one signal that is
    // false on a card the scan mislabelled. The resolution carries the server's
    // verdict instead.
    const code = stripComments(read("src/lib/documents/resolve-document-type.ts"));
    expect(code).toContain("documentTypeIsIdCard");
    expect(code).toMatch(/isIdCard:/);
  });

  it("BOTH callers of the resolver pass the verdict on, not just the wizard's", () => {
    // ⚠️ **An adversarial round found the first version closing the blind spot
    // on the id the wizard does NOT use.** `resolveClassifiedDocumentType` has
    // two callers, and `finalTypeId = interpreted.documentTypeId ??
    // resolvedTypeId` prefers the ai-interpret one — which is also the path
    // that auto-creates type rows, so the type it MINTS is precisely the type
    // the map cannot know about.
    // ⚠️ A bare `toContain("documentTypeIsIdCard")` is VACUOUS on both files —
    // the route matches its own local variable and the run its own field name.
    // What each has to be pinned on is the value it puts THERE.
    const route = stripComments(read("src/app/api/documents/[id]/ai-interpret/route.ts"));
    expect(route).toMatch(/documentTypeIsIdCard\s*=\s*[\s\S]{0,80}resolved\.isIdCard/);
    expect(route).toMatch(/^\s*documentTypeIsIdCard,\s*$/m);
    const run = stripComments(read("src/lib/import/ai-interpret-run.ts"));
    // Gated on `retyped`, so it can only ever describe the type this call named.
    expect(run).toMatch(/documentTypeIsIdCard:\s*retyped\s*\?[\s\S]{0,80}:\s*null/);
  });

  it("the wizard only ever UPGRADES the map, never writes a false into it", () => {
    // An absent entry means "not known" and falls back to the scan; a stored
    // `false` erases a `true` the type list or `enrichDiscoverSteps` put there.
    // Either witness is enough and neither may cancel the other, which is what
    // the reader's `||` says.
    const wizard = stripComments(
      read("src/app/admin/import/_components/bulk-import-dialog.tsx"),
    );
    expect(wizard).toMatch(/resolvedType\.isIdCard === true/);
    expect(wizard).toMatch(/interpreted\.documentTypeIsIdCard === true/);
    const writes = [...wizard.matchAll(/docTypeIdCardRef\.current\.set\(([^)]*)\)/g)];
    expect(writes.length).toBeGreaterThan(0);
    for (const write of writes) {
      expect(write[1]).not.toMatch(/false|isIdCard\s*\)/);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. The three DELIBERATE scan-aware variants are left exactly as they are
// ---------------------------------------------------------------------------

describe("the scan-aware variants still add the scan's own signal", () => {
  /**
   * ⚠️ **THE BEHAVIOUR IS PINNED IN `import-type-form-gate.test.ts`, WITH REAL
   * ENTRIES, AND THAT IS THE STRONGER GUARD.** A round found the first version
   * of this block matching source text down to a trailing comma, so extracting
   * a condition to a named const, or renaming a local, turned it red over a
   * change that alters nothing. What is left here is what a behavioural test
   * cannot say: that these three sites still MENTION the scan at all, which is
   * the promise this slice made when it unified the TYPE spelling around them.
   * Matched inside each FUNCTION's body rather than over the file, so one site
   * losing its term cannot be covered by another keeping it.
   */
  const GATE = () => stripComments(read("src/lib/import/type-form-gate.ts"));

  it("the gate's stored-type arm asks the TYPE and the scan", () => {
    // A gate that disagrees with the executor is worse than no gate: the run
    // asks `docTypeIdCardRef.get(id) === true || isIdCardEntry(sr)`, so the
    // gate has to ask the scan too or it stops imports the run never flags.
    const body = bodyOf(GATE(), "existingTypeOf") || fnBodyOf(GATE(), "existingTypeOf");
    expect(body).toContain("documentTypeIsIdCard(");
    expect(body).toContain("entry.isIdCard");
  });

  it("the gate's NEW-type arm asks the scan and NOTHING else", () => {
    // For a type the run creates there is no row, so the NAME test on the
    // proposed label would excuse types the run would then flag.
    const body = fnBodyOf(GATE(), "newTypeOf");
    expect(body).toContain("entry.isIdCard");
    expect(body).not.toContain("documentTypeIsIdCard(");
  });

  it("the wizard's discover step still ORs the scan's signal", () => {
    const code = stripComments(
      read("src/app/admin/import/_components/bulk-import-dialog.tsx"),
    );
    expect(code).toContain("isIdCardEntry(sr)");
    expect(code).toMatch(/docTypeIdCardRef\.current\.get\([A-Za-z]+\) === true \|\|/);
  });
});

// ---------------------------------------------------------------------------
// 5b. The migration's SQL copy of the predicate is bound to the TypeScript one
// ---------------------------------------------------------------------------

/**
 * ⚠️ **THE ONE PLACE THE RULE IS LEGITIMATELY WRITTEN TWICE, SO IT IS THE ONE
 * PLACE THAT NEEDS A BIND.** `migration_073` has to clean rows that are already
 * stored, and a migration cannot call TypeScript — so it restates
 * `isIdCardTypeName` and `ID_CARD_TYPE_KEYS` in `pg_temp.ga40_is_id_card_type`.
 * Its own header stakes the whole file on that copy being faithful, and a
 * header is exactly the kind of claim this codebase keeps finding to be stale.
 *
 * The cost of a stale copy is not an obvious failure: the migration has ALREADY
 * been applied by then, so nobody re-reads it, and its report line "0
 * identity-card types still carry a form (expected 0)" is a live all-clear
 * measured by a predicate that no longer matches the code.
 *
 * Same shape as `document-type-catalogue-single-source.test.ts`, which reads
 * `migration_071_doctype_rekey.sql` and asserts it against TypeScript values.
 */
const MIGRATION = "src/db/migration_073_id_card_types_hold_no_form.sql";
const ID_CARD_SRC = read("src/lib/import/id-card.ts");

/** The regex literal `isIdCardTypeName` returns, as source text. */
function positivePatternSource(): string {
  const body = ID_CARD_SRC.slice(ID_CARD_SRC.indexOf("export function isIdCardTypeName"));
  const m = /return\s+\/([\s\S]*?)\/\.test\(/.exec(body);
  return m === null ? "" : m[1];
}

describe("migration_073's SQL predicate is the TypeScript one", () => {
  const sql = read(MIGRATION);

  it("carries every ID_CARD_TYPE_KEYS member, and no other key", () => {
    const m = /ARRAY\[([^\]]*)\]/.exec(sql);
    expect(m).not.toBeNull();
    const keys = (m as RegExpExecArray)[1]
      .split(",")
      .map((k) => k.trim().replace(/^'|'$/g, ""))
      .filter((k) => k !== "");
    expect(keys.sort()).toEqual([...ID_CARD_TYPE_KEYS].sort());
  });

  /**
   * One dollar-quoted function body, comments stripped and whitespace
   * collapsed.
   *
   * ⚠️ **THE BINDS BELOW ARE EQUALITIES OVER THE WHOLE BODY, and a fourth round
   * is why nothing weaker will do.** Two earlier versions read the body for
   * `~` / `!~` operands and compared those. SIX mutations of the SQL predicate
   * changed which types lose their form and left every assertion GREEN:
   *
   *   - `OR pg_temp.ga40_fold_ro($2) = 'buletin de analiza'` — an accepting arm
   *     written as an equality rather than a regex. Cleared „Buletin de
   *     analiză", the named false positive `isIdCardTypeName`'s header spends a
   *     paragraph refusing.
   *   - the same as an `IN (…)`, and the same against the RAW `$2`.
   *   - the regex moved into a second `pg_temp` function and called from here.
   *   - a SECOND `ARRAY[…]` of keys OR'd in (the operand reader took the first
   *     `ARRAY[` in the file and never looked further).
   *   - a fourth veto written `AND … <> 'buletin de identitate'`, which made
   *     the migration clear NOTHING while section 3 still printed
   *     "0 identity-card type(s) still carry a form (expected 0)", exit 0.
   *   - and, outside the predicate entirely, `lower(` dropped from
   *     `ga40_fold_ro`, with the same silent all-clear.
   *
   * An operand list cannot see any of those. The body text can, and it is
   * cheap: both functions are a dozen lines and neither is expected to change
   * again — if one does, this test is exactly the conversation that should
   * happen. The expected text for the predicate is BUILT from the TypeScript
   * values, so the two cannot drift; `ga40_fold_ro`'s has no TypeScript
   * counterpart beyond the `translate` pair, so it is pinned literally.
   */
  function bodyOfSqlFunction(tag: string): string {
    const m = new RegExp(`\\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$`).exec(sql);
    expect(m).not.toBeNull();
    return (m as RegExpExecArray)[1]
      // Postgres ignores block comments too, so stripping only `--` would make
      // this equality go red over a change that alters nothing.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((line) => line.replace(/--.*$/, ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  it("the predicate's body is the TypeScript rule, term for term", () => {
    const ts = positivePatternSource();
    expect(ts).not.toBe("");
    const block = /const VETO_PATTERNS: RegExp\[\] = \[([\s\S]*?)\];/.exec(ID_CARD_SRC);
    expect(block).not.toBeNull();
    const vetoes = [...(block as RegExpExecArray)[1].matchAll(/\/(.+?)\/,/g)].map((x) => x[1]);
    // A FOURTH veto added in TypeScript and not here would make the migration
    // clear a form the running code would have left alone; a fourth added HERE
    // and not there clears one nothing in the app would refuse.
    expect(vetoes).toHaveLength(3);

    // The TWO documented differences, and the only two:
    //   `\s`  → `[[:space:]]`, because POSIX ARE has no `\s`.
    //   `\b`  → `(^|[^a-z0-9])` / `([^a-z0-9]|$)`, which veto MORE (`_` is a
    //           word character to JavaScript and not to the class) and
    //           therefore clear FEWER forms — the safe direction.
    const toSql = (p: string) =>
      p.replace(/^\\b/, "(^|[^a-z0-9])").replace(/\\b$/, "([^a-z0-9]|$)");
    const expected = [
      "SELECT",
      `btrim(coalesce($1, '')) = ANY (ARRAY[${[...ID_CARD_TYPE_KEYS]
        .map((k) => `'${k}'`)
        .join(", ")}])`,
      "OR (",
      "pg_temp.ga40_fold_ro($2) <> ''",
      ...vetoes.map((v) => `AND pg_temp.ga40_fold_ro($2) !~ '${toSql(v)}'`),
      `AND pg_temp.ga40_fold_ro($2) ~ '${ts.split("\\s").join("[[:space:]]")}'`,
      ")",
    ].join(" ");

    expect(bodyOfSqlFunction("isid")).toBe(expected);
  });

  it("the fold's body is the one `foldRomanian` describes, character for character", () => {
    // ⚠️ Both encodings of ș/ț: comma-below (correct Romanian) and cedilla (the
    // legacy forms some OCR and fonts still emit). NFD decomposition handles
    // both in TypeScript; SQL has no `unaccent` guarantee, so `translate()`
    // names them — and `translate` fails SILENTLY on an unbalanced pair, by
    // DELETING the unmatched source characters (`translate('cărți','ăâîșşțţ',
    // 'aai')` is `'cari'`). Pinning the whole call is what makes that
    // impossible; pinning only the code points was not.
    expect(bodyOfSqlFunction("fold")).toBe(
      "SELECT btrim( regexp_replace( translate( lower(coalesce($1, '')), " +
        "U&'\\0103\\00E2\\00EE\\0219\\015F\\021B\\0163', 'aaisstt'), " +
        "'[[:space:]]+', ' ', 'g'))",
    );
  });

  it("defines the predicate ONCE — a second CREATE OR REPLACE silently wins", () => {
    // ⚠️ **`bodyOfSqlFunction` reads the FIRST dollar-quoted pair, so a SECOND
    // definition of the same function is invisible to both equalities above —
    // and in Postgres the second one is the one that runs.** Measured: append
    // a `CREATE OR REPLACE FUNCTION pg_temp.ga40_is_id_card_type … $isid2$
    // SELECT pg_temp.ga40_fold_ro($2) ~ 'identitate|analiz' $isid2$` after the
    // real one and every 5b assertion stays green while the migration destroys
    // the forms on „Buletin de analiză" and „Carte de identitate a
    // vehiculului", irreversibly, exit 0.
    expect(
      [...sql.matchAll(/CREATE OR REPLACE FUNCTION pg_temp\.ga40_is_id_card_type/g)],
    ).toHaveLength(1);
    expect([...sql.matchAll(/CREATE OR REPLACE FUNCTION pg_temp\.ga40_fold_ro/g)]).toHaveLength(1);
    // Two occurrences of each tag: the open and the close of ONE body. A third
    // is a second body under the same tag, which the non-greedy match skips.
    expect([...sql.matchAll(/\$isid\$/g)]).toHaveLength(2);
    expect([...sql.matchAll(/\$fold\$/g)]).toHaveLength(2);
  });

  it("every destructive statement asks the PREDICATE, not a rule of its own", () => {
    // ⚠️ **The bodies above are pinned; the WHERE clauses that USE them were
    // not, and a round measured the gap.** Broadening section 2's UPDATE to
    // `WHERE (pg_temp.ga40_is_id_card_type(key, name) OR name ~* 'analiz')`
    // left every assertion in this file green and, against a real Postgres,
    // destroyed the form on „Buletin de analiză" — the mirror image of the
    // under-clearing mutation the docblock above already documents. Section 3's
    // assert cannot catch it either: it only counts types that STILL carry a
    // form, so over-clearing passes it silently.
    //
    // Four call sites, and the count is the guard: section 2's `string_agg`,
    // its `stranded` counter, its `UPDATE`, and section 3's assert. A fifth
    // statement, or one of these four growing a rule of its own, is a term
    // nothing else in this file can see.
    // ⚠️ **THE WHOLE WHERE CLAUSE, NOT A COUNT — a later round beat the count
    // in BOTH directions and both mutations shipped green.**
    //
    //   - UNDER-clear: `AND key <> 'CARTE_IDENTITATE'` added to section 2's
    //     UPDATE *and* to section 3's assert. The counts do not move, `<>` is
    //     not `~` or `=`, and section 3 — mutated in step with it — reports
    //     "0 identity-card type(s) still carry a form". CARTE_IDENTITATE keeps
    //     its CNP form and the migration says the archive is clean.
    //   - OVER-clear: widen the ARGUMENT instead of the predicate —
    //     `ga40_is_id_card_type(key, name || ' carte identitate')` at all four
    //     sites. The bodies above pin the function, not its call, so every
    //     assertion stays green while the migration NULLs `template_fields` on
    //     every type in the table, irreversibly.
    //
    // Both are invisible to anything short of the clause itself, so that is
    // what is pinned. Normalised the same way the function bodies are, so
    // reindenting or rewrapping a comment cannot make it red.
    const clauses = [
      ...sql
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .map((line) => line.replace(/--.*$/, ""))
        .join("\n")
        .replace(/\s+/g, " ")
        .matchAll(/WHERE pg_temp\.ga40_is_id_card_type[\s\S]*?;/g),
    ].map((m) => m[0]);

    const ARRAY_QUAL = (col: string) =>
      `jsonb_typeof(${col}template_fields) = 'array' AND ${col}template_fields <> '[]'::jsonb`;
    // Section 2's aggregate, section 2's UPDATE and section 3's assert ask the
    // same question of the same three terms; the stranded counter adds the two
    // that are about the DOCUMENT.
    const PLAIN = `WHERE pg_temp.ga40_is_id_card_type(key, name) AND ${ARRAY_QUAL("")};`;
    expect(clauses).toEqual([
      PLAIN,
      `WHERE pg_temp.ga40_is_id_card_type(t.key, t.name) AND ${ARRAY_QUAL("t.")}` +
        " AND jsonb_typeof(d.custom_fields) = 'object' AND EXISTS ( SELECT 1 FROM" +
        " jsonb_array_elements(t.template_fields) e WHERE e ? 'key' AND d.custom_fields" +
        " ? (e ->> 'key'));",
      PLAIN,
      PLAIN,
    ]);
    // One definition plus those four uses, and no fifth anywhere.
    expect([...sql.matchAll(/pg_temp\.ga40_is_id_card_type\(/g)]).toHaveLength(5);
    // ⚠️ **AND THE DESTRUCTIVE STATEMENTS ARE COUNTED SEPARATELY, because the
    // clause equality above can only see a statement whose WHERE BEGINS with
    // the predicate.** A round measured the hole its title otherwise
    // over-claims: appending
    // ``UPDATE lookup_document_type SET template_fields = NULL WHERE
    // pg_temp.ga40_fold_ro(name) ~ 'buletin';`` to section 2 mentions the
    // predicate nowhere, so both assertions above stay green — and it strips
    // the forms off „Buletin de analiză" and „Buletin de încercare", the two
    // types this migration's own header names as ones that must be spared,
    // irreversibly, with the migration exiting 0. Section 3 cannot catch it
    // either: it counts types that STILL carry a form, so over-clearing passes.
    //
    // Three today: section 1's KEPT `UPDATE`, section 1's `DELETE`, section 2's
    // `UPDATE`. A fourth is a term this file can now see.
    expect(
      [...sql.matchAll(/\b(UPDATE|DELETE\s+FROM)\s+lookup_document_type\b/gi)],
    ).toHaveLength(3);
  });

  it("has exactly one ARRAY of keys, and one call into the fold's owner", () => {
    // A second `ARRAY[…]` OR'd in, or a third `pg_temp.` helper carrying half
    // the rule, is a term the equalities above would still not see if it lived
    // outside the two bodies they read.
    expect([...sql.matchAll(/ARRAY\[/g)]).toHaveLength(1);
    const helpers = new Set(
      [...sql.matchAll(/pg_temp\.(ga40_[a-z_0-9]+)/g)].map((x) => x[1]),
    );
    expect([...helpers].sort()).toEqual([
      "ga40_fold_ro",
      "ga40_is_id_card_type",
      "ga40_m073_report",
      "ga40_say",
    ]);
  });

  it("is the next migration in the chain and nothing re-seeds the row it deletes", () => {
    // A seed that put CARTE_DE_IDENTITATE_DOUA_EXEMPLARE back would make the
    // chain contradict itself on every rebuild.
    for (const seed of [
      "src/db/sync-reference-data.sql",
      "src/db/seed_dev_data.sql",
      "src/db/migration_072_seed_document_types.sql",
    ]) {
      expect(read(seed)).not.toContain("CARTE_DE_IDENTITATE_DOUA_EXEMPLARE");
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Every refusal a user can see has copy in BOTH locales
// ---------------------------------------------------------------------------

/**
 * The two `valueList.confirm.errors.*` members are bound by
 * `value-list-dependents.test.ts`, which iterates the exported `FAILURE_CODES`
 * array — a stronger guard than a list here, and the reason they are absent
 * from this one.
 */
const COPY_KEYS = [
  "docTypeEngine.save.idCardType",
  "document.discoverReview.errorIdCardType",
  "document.discoverReview.errorIdCardTypeCreated",
  "valueList.templateFields.errorIdCardType",
];

const ro = JSON.parse(read("messages/ro-RO.json")) as Record<string, unknown>;
const en = JSON.parse(read("messages/en-GB.json")) as Record<string, unknown>;

function at(tree: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined,
      tree,
    );
}

describe("the refusals a user can see are translated", () => {
  it.each(COPY_KEYS)("%s exists in both locales", (key) => {
    expect(typeof at(ro, key)).toBe("string");
    expect(typeof at(en, key)).toBe("string");
  });

  it.each(COPY_KEYS)("%s says CNP in Romanian, which is the argument", (key) => {
    // Not a style check: the sentence has to say WHY, or the refusal reads as a
    // bug. `discover-run.ts` and `status.ts` already carry this argument, so
    // the copy is a restatement rather than a new claim.
    expect(String(at(ro, key))).toMatch(/CNP|identitate/);
  });
});

// ---------------------------------------------------------------------------
// 7. The four screens branch on the shared codes, not on literals
// ---------------------------------------------------------------------------

const READERS = [
  ["doc-type-engine", "src/app/admin/doc-type-engine/_components/doc-type-engine.tsx"],
  ["discover-review-dialog", "src/app/documents/_components/discover-review-dialog.tsx"],
  [
    "document-type-form-editor",
    "src/app/admin/value-lists/_components/document-type-form-editor.tsx",
  ],
  ["failures.ts (value-list-modal's four readers)", "src/lib/admin/value-lists/failures.ts"],
];

describe("the screens read the refusal by its shared code", () => {
  it.each(READERS)("%s imports the constants rather than spelling them", (_name, file) => {
    const code = stripComments(read(file));
    expect(code).toContain("ID_CARD_FORM_CODE");
    expect(code).toContain("ID_CARD_RENAME_CODE");
    expect(code).toContain("@/lib/documents/id-card-form-guard");
    // The literals themselves, quoted ANY of the three ways, would be a second
    // definition of the wire protocol — the same failure one level down from
    // the predicate. A round caught the first version testing double quotes
    // only, which a screen spelling `'id_card_form'` sails past.
    for (const literal of [ID_CARD_FORM_CODE, ID_CARD_RENAME_CODE]) {
      for (const quote of ['"', "'", "`"]) {
        expect(code).not.toContain(`${quote}${literal}${quote}`);
      }
    }
  });
});
