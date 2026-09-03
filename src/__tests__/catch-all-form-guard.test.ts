/**
 * The catch-all document type may not be given a form.            (Slice #32.19)
 *
 * Finding S-02: DocTypeEngine refused to build a form for the unclassified
 * catch-all and Reference Data did not, so the Form button was drawn on the
 * NECLASIFICAT row and a form saved there was accepted. This suite pins the
 * guard that closes it — `src/lib/documents/catch-all-form-guard.ts` — and the
 * predicate underneath it.
 *
 * ⚠️ **THE GRANDFATHER CLAUSE IS THE HALF WORTH TESTING HARDEST.** A guard added
 * without one locks the owner out of their own row: no seed and no migration has
 * ever written `template_fields` onto the catch-all, so a form there can only
 * have been saved by hand through the door this guard closes, and the ONLY
 * screen in the application that can clear a form saves through that same door.
 * "Refuse everything" would have stranded exactly the archive the fix is for.
 * So: adding is refused, removing and clearing are not, and a name-only edit
 * goes through untouched.
 */

import { readFileSync } from "fs";
import { join } from "path";

import {
  CATCH_ALL_FORM_CODE,
  CATCH_ALL_RENAME_CODE,
  CatchAllFormRefusedError,
  asCatchAllFormRefusal,
  catchAllFormRefusal,
  catchAllRefusalCode,
} from "@/lib/documents/catch-all-form-guard";
import {
  CATCH_ALL_DOCUMENT_TYPE_KEYS,
  UNCLASSIFIED_DOCUMENT_TYPE_KEY,
  documentTypeIsCatchAll,
} from "@/lib/documents/document-type-match";

const CATCH_ALL = { key: UNCLASSIFIED_DOCUMENT_TYPE_KEY, name: "NECLASIFICAT" };
const ORDINARY = { key: "CONTRACT_VANZARE", name: "Contract de vânzare" };

// ---------------------------------------------------------------------------
// documentTypeIsCatchAll
// ---------------------------------------------------------------------------

describe("documentTypeIsCatchAll", () => {
  it("recognises the seeded row by its key", () => {
    expect(documentTypeIsCatchAll(CATCH_ALL)).toBe(true);
  });

  it("⚠️ recognises the SECOND row an archive can hold, keyed NECLASIFICAT", () => {
    // `meansUnclassified`'s own header records it: pre-#29.06 `ai-interpret`
    // name-matched byte-for-byte, so a Romanian "Neclasificat" missed the
    // uppercase row and was CREATED as a second type keyed NECLASIFICAT. That
    // header says in as many words that "the key guard does not cover it", and
    // `catchAllType` — which resolves the key alone, on purpose — cannot see it.
    // A guard about what may hold a FORM is exactly where that gap bites.
    expect(documentTypeIsCatchAll({ key: "NECLASIFICAT", name: "Neclasificat" })).toBe(true);
    expect(CATCH_ALL_DOCUMENT_TYPE_KEYS).toContain("NECLASIFICAT");
    expect(CATCH_ALL_DOCUMENT_TYPE_KEYS).toContain(UNCLASSIFIED_DOCUMENT_TYPE_KEY);
  });

  it("⚠️ recognises a row by NAME whatever its key, including the English one", () => {
    // A cloud project rebuilt before #29.07 calls the row `Unclassified`, and
    // `resolveClassifiedDocumentType` could mint one named `Neclasificat` under
    // a slugged key of its own. Both mean "I could not tell".
    for (const name of ["Neclasificat", "NECLASIFICAT", "Unclassified", "Document necunoscut"]) {
      expect([name, documentTypeIsCatchAll({ key: "ORICE_ALTCEVA", name })]).toEqual([name, true]);
    }
  });

  it("leaves an ordinary type alone, and is not fooled by an empty name", () => {
    expect(documentTypeIsCatchAll(ORDINARY)).toBe(false);
    expect(documentTypeIsCatchAll({ key: "", name: "" })).toBe(false);
    expect(documentTypeIsCatchAll({})).toBe(false);
    // "—" and a lone space normalise to "", and `sameDocumentTypeName` refuses
    // to call two empty normalisations equal. One punctuation-only type must not
    // absorb the catch-all's rule.
    expect(documentTypeIsCatchAll({ key: "X", name: "—" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// catchAllFormRefusal — the create path
// ---------------------------------------------------------------------------

describe("catchAllFormRefusal — creating", () => {
  it("refuses a CREATE that lands a form on the catch-all", () => {
    expect(catchAllFormRefusal(null, { ...CATCH_ALL, fieldCount: 3 }, true)).toBe("form");
  });

  it("allows a CREATE of the catch-all with no form — which is how it is seeded", () => {
    expect(catchAllFormRefusal(null, { ...CATCH_ALL, fieldCount: 0 }, true)).toBeNull();
    // And the shape `resolveClassifiedDocumentType` actually sends: no
    // `templateFields` at all. Minting a type mid-import is not refused here.
    expect(catchAllFormRefusal(null, { ...CATCH_ALL, fieldCount: 0 }, false)).toBeNull();
  });

  it("allows a CREATE of an ordinary type with a form", () => {
    expect(catchAllFormRefusal(null, { ...ORDINARY, fieldCount: 9 }, true)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// catchAllFormRefusal — the update path, and the grandfather clause
// ---------------------------------------------------------------------------

describe("catchAllFormRefusal — updating", () => {
  it("refuses a form being ADDED to a catch-all row that had none", () => {
    expect(
      catchAllFormRefusal(
        { ...CATCH_ALL, fieldCount: 0 },
        { ...CATCH_ALL, fieldCount: 1 },
        true,
      ),
    ).toBe("form");
  });

  it("⚠️ refuses a form being GROWN on a row that already wrongly carries one", () => {
    // The S-02 repro, on the archive that already has the row: open Form on
    // NECLASIFICAT, add a field, save.
    expect(
      catchAllFormRefusal(
        { ...CATCH_ALL, fieldCount: 4 },
        { ...CATCH_ALL, fieldCount: 5 },
        true,
      ),
    ).toBe("form");
  });

  it("⚠️ ALLOWS the same row to be shrunk, and cleared", () => {
    // The grandfather clause, and the reason the Form button is still drawn on a
    // catch-all row that has a form: this editor is the only screen that can
    // delete one. Refusing these two writes strands the row.
    expect(
      catchAllFormRefusal({ ...CATCH_ALL, fieldCount: 4 }, { ...CATCH_ALL, fieldCount: 3 }, true),
    ).toBeNull();
    expect(
      catchAllFormRefusal({ ...CATCH_ALL, fieldCount: 4 }, { ...CATCH_ALL, fieldCount: 0 }, true),
    ).toBeNull();
  });

  it("⚠️ REFUSES a re-save that swaps the fields without changing how many", () => {
    // The hole an adversarial round found in the first draft, which asked only
    // whether the form GREW. The form editor sends the whole set, so deleting
    // four fields and adding four different ones is `4 → 4` — and S-02's own
    // sentence, "a form can be saved on the catch-all document type from
    // Reference Data", would have stayed true with only its LENGTH frozen.
    expect(
      catchAllFormRefusal({ ...CATCH_ALL, fieldCount: 4 }, { ...CATCH_ALL, fieldCount: 4 }, true),
    ).toBe("form");
  });

  it("⚠️ …but a write that does not touch the column at all is still allowed", () => {
    // The distinction the term above turns on, and the one that keeps the
    // name-only edit form usable: `writesTheForm` false means the count on both
    // sides came from the stored row, so nothing about the form is being said.
    expect(
      catchAllFormRefusal({ ...CATCH_ALL, fieldCount: 4 }, { ...CATCH_ALL, fieldCount: 4 }, false),
    ).toBeNull();
  });

  it("⚠️ allows Reference Data's name-only edit on a grandfathered row", () => {
    // `LIST_META["document-types"].fields` is `[{ key: "name" }]`, so the list
    // form sends `{ name }` and nothing about the form: `writesTheForm` false,
    // and `fieldCount` on both sides comes from the stored row. Refusing it
    // would answer "save it with no fields" on a form whose only input is the
    // name — #26.02's unfixable message, rebuilt.
    expect(
      catchAllFormRefusal(
        { ...CATCH_ALL, fieldCount: 4 },
        { ...CATCH_ALL, name: "NECLASIFICAT (vechi)", fieldCount: 4 },
        false,
      ),
    ).toBeNull();
  });

  it("⚠️ refuses a type that already has a form being RENAMED into the catch-all", () => {
    // The window beside the locked door: the value-lists PUT carries `name` and
    // `templateFields` in one payload, so a guard on the fields alone misses it.
    // The half named is the one the user can undo.
    expect(
      catchAllFormRefusal(
        { ...ORDINARY, fieldCount: 6 },
        { key: ORDINARY.key, name: "Neclasificat", fieldCount: 6 },
        false,
      ),
    ).toBe("rename");
  });

  it("⚠️ refuses a row being moved ONTO a catch-all key with its form intact", () => {
    // `updateValue` is `.set(values)` over whatever object a direct caller hands
    // it and `key` is a real column. Without the keyUnchanged term this reads as
    // "neither half changed" and lands the form on the archive's catch-all key.
    expect(
      catchAllFormRefusal(
        { key: "NECLASIFICAT_2", name: "Neclasificat", fieldCount: 2 },
        { key: UNCLASSIFIED_DOCUMENT_TYPE_KEY, name: "Neclasificat", fieldCount: 2 },
        false,
      ),
    ).toBe("form");
  });

  it("⚠️ an ABSENT after.key is not a changed one", () => {
    // All the doors default it to the stored key today, so this is a landmine
    // rather than a live bug — but a fourth door describing a name-only write by
    // omitting `key` must not be refused with a remedy its screen cannot carry
    // out.
    expect(
      catchAllFormRefusal(
        { ...CATCH_ALL, fieldCount: 2 },
        { name: CATCH_ALL.name, fieldCount: 2 },
        false,
      ),
    ).toBeNull();
  });

  it("leaves every ordinary write alone", () => {
    expect(
      catchAllFormRefusal({ ...ORDINARY, fieldCount: 2 }, { ...ORDINARY, fieldCount: 7 }, true),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The wire
// ---------------------------------------------------------------------------

describe("the refusal on the wire", () => {
  it("carries one code per half, and the two are distinct", () => {
    expect(catchAllRefusalCode("form")).toBe(CATCH_ALL_FORM_CODE);
    expect(catchAllRefusalCode("rename")).toBe(CATCH_ALL_RENAME_CODE);
    expect(CATCH_ALL_FORM_CODE).not.toBe(CATCH_ALL_RENAME_CODE);
  });

  it("⚠️ is recognised by name rather than by instanceof", () => {
    // The routes and the queries are bundled separately by Next; a duplicated
    // module identity would make `instanceof` answer false and turn a named 400
    // into a 500, silently, on the one path this guard exists for.
    const impostor = Object.assign(new Error("x"), {
      name: "CatchAllFormRefusedError",
      refusal: "rename",
    });
    expect(asCatchAllFormRefusal(impostor)).toBe("rename");
    expect(asCatchAllFormRefusal(new CatchAllFormRefusedError("form"))).toBe("form");
    expect(asCatchAllFormRefusal(new CatchAllFormRefusedError("rename"))).toBe("rename");
    expect(asCatchAllFormRefusal(new Error("something else"))).toBeNull();
    expect(asCatchAllFormRefusal(null)).toBeNull();
  });

  it("⚠️ does not collide with the identity-card codes it sits beside", () => {
    // Both refusals reach the same two doors and the same `failureFromResponse`
    // switch. Two codes that were equal would make one screen say the other's
    // sentence — a remedy the user cannot carry out, on a screen that looks
    // right.
    expect([CATCH_ALL_FORM_CODE, CATCH_ALL_RENAME_CODE]).not.toContain("id_card_form");
    expect([CATCH_ALL_FORM_CODE, CATCH_ALL_RENAME_CODE]).not.toContain("id_card_rename");
  });
});

// ---------------------------------------------------------------------------
// Every server door that can write template_fields consults the predicate
// ---------------------------------------------------------------------------
//
// ⚠️ **THIS BLOCK EXISTS BECAUSE ITS ABSENCE LET A DOOR SHIP OPEN.** The slice
// first guarded only the two value-lists doors, on the belief that the
// template-fields PUT was refused upstream by `typeMayHoldAForm`. It is not:
// that function is consulted by the discovery run and by the DocTypeEngine
// screen, never by the route. `id-card-type-single-source.test.ts` has carried
// exactly this table since #32.07 — its own comment calls it "the half that
// fails when a NEW write path appears" — and an adversarial round pointed out
// that a copy of it here would have failed on the missing door before the
// handover was written rather than after. So here it is.

const VL_QUERIES = join("src", "lib", "admin", "value-lists", "queries.ts");
const TEMPLATE_FIELDS_ROUTE = join("src", "app", "api", "document-types", "[id]", "template-fields", "route.ts");
const VL_PUT_ROUTE = join("src", "app", "api", "admin", "value-lists", "[list]", "[id]", "route.ts");
const VL_POST_ROUTE = join("src", "app", "api", "admin", "value-lists", "[list]", "route.ts");
const DOC_TYPE_ENGINE = join("src", "app", "admin", "doc-type-engine", "_components", "doc-type-engine.tsx");
const LIST_MODAL = join("src", "app", "admin", "value-lists", "_components", "value-list-modal.tsx");

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

/** A BEHAVIOUR guard, so it reads only code — the rule this repo keeps. */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("every door that writes template_fields refuses the catch-all", () => {
  it("both value-lists doors throw the refusal from the query layer", () => {
    // In the WRITER rather than in the route, so a direct caller of
    // `createValue` / `updateValue` is bound by it too — `ai-interpret` was
    // exactly such a caller until #29.06.
    //
    // ⚠️ **PER FUNCTION, not per file, and a round asked for it.** Both doors
    // live in queries.ts, so a whole-file `toContain` is one assertion wearing
    // two hats: drop the guard from `createDocumentTypeRow` and `updateValue`'s
    // copy keeps the file green while the POST door stands open. The slice
    // scope is the same brace-matched one `id-card-type-single-source.test.ts`
    // reasons about at length; here it is enough to cut at the next top-level
    // `export`, because these two functions are adjacent and neither is last.
    const code = stripComments(read(VL_QUERIES));
    expect(code).toContain("@/lib/documents/catch-all-form-guard");
    expect(code).toContain("CatchAllFormRefusedError");
    const missing: string[] = [];
    for (const name of ["createDocumentTypeRow", "updateValue"]) {
      const at = code.search(new RegExp(`(export\\s+)?(async\\s+)?function\\s+${name}\\b`));
      if (at < 0) {
        missing.push(`${name} not found in ${VL_QUERIES}`);
        continue;
      }
      const next = code.indexOf("\nexport ", at + 1);
      const body = code.slice(at, next < 0 ? code.length : next);
      if (!body.includes("catchAllFormRefusal(")) {
        missing.push(`${name} does not call catchAllFormRefusal`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("⚠️ the template-fields PUT is guarded too — the door the first draft missed", () => {
    const code = stripComments(read(TEMPLATE_FIELDS_ROUTE));
    expect(code).toContain("@/lib/documents/catch-all-form-guard");
    expect(code).toContain("catchAllFormRefusal(");
    expect(code).toMatch(/status:\s*400/);
  });

  it("⚠️ …and it refuses BEFORE it answers 409, for the same reason the id-card guard does", () => {
    // A stale `knownKeys` answered with "the form changed — check the list and
    // press Save again", over a Save that can never succeed, is #26.02's
    // unfixable message. The identity of the type does not depend on how fresh
    // the caller's view of the fields is.
    const code = stripComments(read(TEMPLATE_FIELDS_ROUTE));
    const refusal = code.indexOf("catchAllFormRefusal(");
    const conflict = code.indexOf("template_changed");
    expect(refusal).toBeGreaterThan(-1);
    expect(conflict).toBeGreaterThan(-1);
    expect(refusal).toBeLessThan(conflict);
  });

  it("⚠️ the template-fields PUT shapes its question the only way that door can", () => {
    // The one piece of behaviour unique to that door, and nothing else covers
    // it. The route is ADDITIVE — it cannot clear a template — so `after` is the
    // stored count PLUS the accepted one, and `writesTheForm` is unconditional:
    // writing the column is the whole of what the route does. Together those
    // mean a no-op additive save against a grandfathered catch-all row is
    // refused rather than answered 200 over a form that is still there, which is
    // the same argument the identity-card guard makes six lines above it.
    const code = stripComments(read(TEMPLATE_FIELDS_ROUTE));
    const at = code.indexOf("catchAllFormRefusal(");
    expect(at).toBeGreaterThan(-1);
    const call = code.slice(at, code.indexOf(");", at));
    expect(call).toContain("current.fields.length");
    expect(call).toContain("parsed.data.fields.length");
    expect(call).toMatch(/true,\s*$/);
  });

  it.each([
    ["value-lists PUT", VL_PUT_ROUTE],
    ["value-lists POST", VL_POST_ROUTE],
  ])("%s turns the refusal into a named 400", (_name, route) => {
    const code = stripComments(read(route));
    expect(code).toContain("asCatchAllFormRefusal");
    expect(code).toContain("catchAllRefusalCode");
    expect(code).toMatch(/status:\s*400/);
  });

  it("⚠️ the screens that OFFER a form ask the same question the writers do", () => {
    // The other half of S-02: a button whose only outcome is a refusal teaches
    // the rule by failing, and DocTypeEngine's picker offering a row the route
    // will refuse is worse still — it spends twenty billed reads first.
    for (const file of [DOC_TYPE_ENGINE, LIST_MODAL]) {
      const code = stripComments(read(file));
      expect([file, code.includes("documentTypeIsCatchAll")]).toEqual([file, true]);
    }
  });

  it("⚠️ Reference Data's backlog filter agrees with its own Form button", () => {
    // The row that has no Form button must not be listed as "awaiting a form".
    // Leaving the two different left an item in the backlog that nothing on the
    // screen could clear, and made `backlogEmpty` — and the green sentence it
    // gates — permanently unreachable.
    const code = stripComments(read(LIST_MODAL));
    const awaits = code.indexOf("const awaitsFormRow");
    expect(awaits).toBeGreaterThan(-1);
    const body = code.slice(awaits, awaits + 400);
    expect(body).toContain("documentTypeIsCatchAll");
    expect(body).not.toContain("fallbackTypeId");
  });
});
