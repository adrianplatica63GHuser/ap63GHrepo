/**
 * The six labels, and the fact that none of them is stored.   (Slice #26.12)
 *
 * WHAT IS ACTUALLY AT RISK HERE
 * -----------------------------
 * The brief's instruction was "do not add a status column" — so the whole slice
 * is one derivation, and a derivation is exactly the kind of confident output
 * this codebase keeps getting wrong when it is never measured against a
 * realistic input. Four inputs would embarrass a naive version of it, and all
 * four are pinned below:
 *
 *   1. `template_fields = []`      — a form that was saved and then emptied.
 *   2. `template_fields = [{}]`    — a row whose entries have no usable `key`.
 *                                    `parseTemplateFields` drops them, so the
 *                                    document form renders NO extra inputs. A
 *                                    naive `Array.isArray(raw) && raw.length`
 *                                    calls that type AI completed and the
 *                                    document beside it AI processed, both
 *                                    about a form that does not exist.
 *   3. `aiInterpretedAt = ""`      — a JSON round-trip or a form value. `"" !=
 *                                    null` is true, so an untouched document
 *                                    would read "Imported".
 *   4. an unrecognised `origin`    — a cached row from before migration_069.
 *
 * The last test is the brief's own sentence turned into a property: "AI
 * processed if its type has a status of AI completed". If those two ever
 * disagree the screens contradict each other, and no single-value assertion
 * would catch it.
 */

import { parseTemplateFields } from "@/lib/documents/template-fields";
import {
  DOCUMENT_TYPE_ORIGINS,
  DOCUMENT_TYPE_STATUS_CLASS,
  documentStatus,
  documentTypeHasForm,
  documentTypeNameClass,
  documentTypeNeedsFormHint,
  documentTypeOptionLabel,
  documentTypeOriginOf,
  documentTypeStatus,
  isDocumentTypeOrigin,
} from "@/lib/documents/status";

const FIELD = {
  key:     "pretTotal",
  labelRo: "Preț total",
  labelEn: "Total price",
  type:    "text" as const,
  order:   0,
};

// Every shape `template_fields` can hold, and whether it is a FORM.
const NO_FORM: [string, unknown][] = [
  ["null",                       null],
  ["undefined",                  undefined],
  ["an empty array",             []],
  ["an object, not an array",    { key: "x" }],
  ["a string",                   "pretTotal"],
  ["a number",                   3],
  ["an array of one empty object", [{}]],
  ["an array of entries with no key", [{ labelRo: "Preț" }, { labelEn: "Price" }]],
  ["an array whose key is empty",  [{ ...FIELD, key: "" }]],
  ["an array of nulls",          [null, null]],
];

const HAS_FORM: [string, unknown][] = [
  ["one field",                  [FIELD]],
  ["two fields",                 [FIELD, { ...FIELD, key: "tva", order: 1 }]],
  ["one usable field among junk", [{}, null, FIELD]],
];

describe("documentTypeHasForm — the AI-completed test", () => {
  it.each(NO_FORM)("is false for %s", (_label, raw) => {
    expect(documentTypeHasForm(raw)).toBe(false);
  });

  it.each(HAS_FORM)("is true for %s", (_label, raw) => {
    expect(documentTypeHasForm(raw)).toBe(true);
  });
});

describe("documentTypeOptionLabel — the picker marks the MINORITY", () => {
  // Stands in for the `t("typeForm.optionHasForm")` call the form passes.
  const mark = (name: string) => `${name} (are formular)`;

  it.each(NO_FORM)("returns a type with %s byte-for-byte unchanged", (_label, raw) => {
    expect(documentTypeOptionLabel("Contract", raw, mark)).toBe("Contract");
  });

  // ⚠️ A review round: thirteen cases all passing the same clean ASCII name
  // prove nothing about "byte-for-byte". `name.trim()`, `String(name)` and
  // `name.normalize("NFC")` all pass those and all change what a real row
  // renders — the value-lists editor accepts a trailing space, and the comma-
  // below/cedilla pair is a live hazard in this codebase's Romanian data.
  //
  // ⚠️ The DECOMPOSED row is the one that catches `.normalize("NFC")`. A second
  // review round pointed out that the two precomposed diacritic rows below it
  // (U+0163 cedilla, U+021B comma-below) are NFC no-ops and prove nothing the
  // ASCII name does not; they stay because the cedilla/comma-below pair is a
  // live hazard in this data, but the `t` + combining-cedilla row is what makes
  // the normalise claim testable.
  it.each([
    ["a trailing space",       "Contract vânzare-cumpărare  "],
    ["a leading space",        " Contract"],
    ["cedilla diacritics",     "Proces verbal de recepţie"],
    ["comma-below diacritics", "Proces verbal de recepție"],
    ["decomposed diacritics",  "Proces verbal de recept\u0327ie"],
    ["the empty string",       ""],
  ])("returns a formless type's name with %s exactly as given", (_label, name) => {
    expect(documentTypeOptionLabel(name, null, mark)).toBe(name);
    // …and the marked path does not launder it either.
    expect(documentTypeOptionLabel(name, [FIELD], (n) => n)).toBe(name);
  });

  it.each(HAS_FORM)("marks a type with %s", (_label, raw) => {
    expect(documentTypeOptionLabel("Contract", raw, mark)).toBe("Contract (are formular)");
  });

  // ⚠️ Not the same assertion as the one above. A marker that happened to
  // return its argument unchanged would satisfy "byte-for-byte" and still be
  // wrong — the day the wording gains a suffix, twenty-three of twenty-four
  // options grow one. This pins that the marker is not REACHED.
  it("never calls the marker for a formless type", () => {
    const calls: string[] = [];
    documentTypeOptionLabel("Contract", null, (n) => { calls.push(n); return n; });
    expect(calls).toEqual([]);
  });

  it("hands the marker the raw name and returns whatever it makes of it", () => {
    expect(documentTypeOptionLabel("Contract", [FIELD], (n) => `<<${n}>>`)).toBe("<<Contract>>");
  });

  // The whole reason this lives in status.ts: a type that reads "Are formular"
  // in bold green on the Reference Data list must be the same set of types the
  // dropdown marks. One function, so the two cannot part company.
  //
  // ⚠️ Both origins, and a review round is why. Pinned at MANUAL this loop is
  // `hasForm(raw) === hasForm(raw)` — it cannot fail. Varying the origin makes
  // it say something: the mark follows the FORM alone, so a `documentTypeStatus`
  // rewritten to test the origin first (returning aiScanned for an IMPORT type
  // that has a form) breaks here, which is #26.12's own named failure mode.
  it("marks exactly the types Reference Data calls AI completed", () => {
    let checked = 0;
    for (const origin of [...DOCUMENT_TYPE_ORIGINS, "AUTO", undefined]) {
      for (const [label, raw] of [...NO_FORM, ...HAS_FORM]) {
        const marked = documentTypeOptionLabel("Contract", raw, mark) !== "Contract";
        const completed = documentTypeStatus({ origin, templateFields: raw }) === "aiCompleted";
        expect([origin, label, marked]).toEqual([origin, label, completed]);
        checked++;
      }
    }
    expect(checked).toBe(4 * (NO_FORM.length + HAS_FORM.length));
  });
});

describe("documentTypeNeedsFormHint — a MISSING row is not a formless one", () => {
  it.each(NO_FORM)("is true for a row whose template_fields is %s", (_label, raw) => {
    expect(documentTypeNeedsFormHint({ templateFields: raw })).toBe(true);
  });

  it.each(HAS_FORM)("is false for a row whose template_fields is %s", (_label, raw) => {
    expect(documentTypeNeedsFormHint({ templateFields: raw })).toBe(false);
  });

  // ⚠️ The reason this is a function at all. `!documentTypeHasForm(row?.tf)`
  // answers TRUE here, and the hint then flashes under EVERY document — the
  // ones whose type has a form included — for as long as the react-query
  // `["document-types"]` fetch is in flight, and forever in create mode before
  // a type is picked.
  it.each([
    ["undefined — the list has not loaded", undefined],
    ["null",                                null],
  ])("is false for %s", (_label, row) => {
    expect(documentTypeNeedsFormHint(row)).toBe(false);
  });

  // A row that EXISTS but carries no template_fields reads as formless, on
  // purpose: `documentTypeHasForm` already says so everywhere else (the status
  // badge, the Reference Data colour), and a second rule here would be the
  // disagreement #26.12 exists to prevent. The way that shape actually reaches
  // the browser — a projected `fetchDocumentTypes` poisoning the shared query
  // cache — is headed off in `app/documents/list-view.tsx`, not here.
  it("treats a row with no template_fields property as formless", () => {
    expect(documentTypeNeedsFormHint({})).toBe(true);
  });
});

describe("documentTypeOriginOf — the one stored fact, read defensively", () => {
  it("passes through the two values the CHECK constraint allows", () => {
    expect(DOCUMENT_TYPE_ORIGINS).toEqual(["MANUAL", "IMPORT"]);
    expect(documentTypeOriginOf("MANUAL")).toBe("MANUAL");
    expect(documentTypeOriginOf("IMPORT")).toBe("IMPORT");
  });

  it.each([
    ["undefined",        undefined],
    ["null",             null],
    ["the empty string", ""],
    ["lower case",       "import"],
    ["a stray value",    "AUTO"],
    ["a number",         1],
    ["a boolean",        true],
  ])("falls back to MANUAL for %s — it never invents an import", (_l, raw) => {
    expect(documentTypeOriginOf(raw)).toBe("MANUAL");
    expect(isDocumentTypeOrigin(raw)).toBe(false);
  });
});

describe("documentTypeStatus — New / AI scanned / AI completed", () => {
  it("is New for a hand-added type with no form", () => {
    expect(documentTypeStatus({ origin: "MANUAL", templateFields: null })).toBe("new");
  });

  it("is AI scanned for an import-created type with no form", () => {
    expect(documentTypeStatus({ origin: "IMPORT", templateFields: null })).toBe("aiScanned");
  });

  it("is AI completed once a form exists, WHICHEVER origin", () => {
    // #26.11: "there is no second path. Both origins reach 'has a form' the
    // same way." A hand-added type given a form by AI Discovery is finished,
    // and an imported one that got a form is not still merely scanned.
    expect(documentTypeStatus({ origin: "MANUAL", templateFields: [FIELD] })).toBe("aiCompleted");
    expect(documentTypeStatus({ origin: "IMPORT", templateFields: [FIELD] })).toBe("aiCompleted");
  });

  it("is New for a row that predates the origin column", () => {
    expect(documentTypeStatus({})).toBe("new");
    expect(documentTypeStatus({ origin: undefined, templateFields: [] })).toBe("new");
  });

  it("does not call a type with an EMPTY form AI completed", () => {
    // The trap: the form was saved and later emptied, or the rows carry no key.
    expect(documentTypeStatus({ origin: "IMPORT", templateFields: [] })).toBe("aiScanned");
    expect(documentTypeStatus({ origin: "IMPORT", templateFields: [{}] })).toBe("aiScanned");
    expect(documentTypeStatus({ origin: "MANUAL", templateFields: [{}] })).toBe("new");
  });
});

describe("the colour cannot contradict the label", () => {
  // The brief asks for both a status word and a colour coding. They are one
  // decision here; this is the assertion that keeps them one.
  it.each([
    ["MANUAL", null,     "new"],
    ["IMPORT", null,     "aiScanned"],
    ["MANUAL", [FIELD],  "aiCompleted"],
    ["IMPORT", [FIELD],  "aiCompleted"],
  ] as const)("%s + %p renders the %s class", (origin, templateFields, expected) => {
    const row = { origin, templateFields };
    expect(documentTypeStatus(row)).toBe(expected);
    expect(documentTypeNameClass(row)).toBe(DOCUMENT_TYPE_STATUS_CLASS[expected]);
  });

  it("renders a hand-added type in the table's own body colour", () => {
    // "black" on a list where every other cell is already this colour means
    // "unchanged", not a literal #000.
    expect(DOCUMENT_TYPE_STATUS_CLASS.new).toBe("text-ink dark:text-zinc-300");
  });

  it("gives the three statuses three distinct classes", () => {
    const classes = Object.values(DOCUMENT_TYPE_STATUS_CLASS);
    expect(new Set(classes).size).toBe(classes.length);
  });
});

describe("documentStatus — New / Imported / AI processed", () => {
  it("is New while nothing has read the document", () => {
    expect(documentStatus({ aiInterpretedAt: null, typeTemplateFields: [FIELD] })).toBe("new");
    expect(documentStatus({})).toBe("new");
  });

  it.each([
    ["the empty string", ""],
    ["whitespace",       "   "],
  ])("is New when the stamp is %s, not a timestamp", (_l, stamp) => {
    expect(documentStatus({ aiInterpretedAt: stamp, typeTemplateFields: [FIELD] })).toBe("new");
  });

  it("is AI processed when the stamp is set and the type CURRENTLY has a form", () => {
    expect(documentStatus({
      aiInterpretedAt:    new Date("2026-08-09T10:00:00.000Z"),
      typeTemplateFields: [FIELD],
    })).toBe("aiProcessed");
    expect(documentStatus({
      aiInterpretedAt:    "2026-08-09T10:00:00.000Z",
      typeTemplateFields: [FIELD],
    })).toBe("aiProcessed");
  });

  it("is Imported when the stamp is set and the type has no form", () => {
    expect(documentStatus({
      aiInterpretedAt:    new Date("2026-08-09T10:00:00.000Z"),
      typeTemplateFields: null,
    })).toBe("imported");
    // …including the shapes that only LOOK like a form.
    expect(documentStatus({
      aiInterpretedAt:    "2026-08-09T10:00:00.000Z",
      typeTemplateFields: [{}],
    })).toBe("imported");
  });
});

describe("the consequence of reading the type's CURRENT form", () => {
  // ⚠️ **Named, not fixed, and an adversarial round is why it is written down.**
  // `documentStatus` never looks at `document.custom_fields`. So a document
  // imported in January against a type that had no template reads "Importat",
  // correctly — and the day an admin gives that type a form through #26.11's
  // review, the SAME document starts reading "Procesat cu AI" although no
  // extraction ever ran on it and its custom fields are empty.
  //
  // That is the brief's own rule ("AI processed if its type has a status of AI
  // completed"), so it ships as specified rather than being quietly narrowed.
  // It is pinned here so the behaviour is a decision on the record: if it turns
  // out to mislead, the fix is to require a populated custom field and this
  // test is the one to invert.
  it("relabels an already-imported document when its type later gains a form", () => {
    const before = documentStatus({
      aiInterpretedAt:    new Date("2026-01-15T09:00:00.000Z"),
      typeTemplateFields: null,
    });
    const after = documentStatus({
      aiInterpretedAt:    new Date("2026-01-15T09:00:00.000Z"),
      typeTemplateFields: [FIELD],
    });
    expect(before).toBe("imported");
    expect(after).toBe("aiProcessed");
  });
});

describe("the brief's own sentence, as a property", () => {
  // "AI processed if its type has a status of AI completed — … Imported if its
  // status is not AI completed." Every combination, both directions.
  const STAMPS: [string, Date | string | null][] = [
    ["unstamped",   null],
    ["blank",       ""],
    ["a Date",      new Date("2026-08-09T10:00:00.000Z")],
    ["an ISO string", "2026-08-09T10:00:00.000Z"],
  ];
  const FIELDS: [string, unknown][] = [...NO_FORM, ...HAS_FORM];

  // ⚠️ **The expectation is rebuilt from the RAW inputs, not read back out of
  // the module under test, and an adversarial round is why.** The first version
  // of this loop compared `documentStatus(...)` against
  // `documentTypeStatus(...)`, feeding both the same `templateFields` — which
  // reduces to `hasForm(tf) === hasForm(tf)`, a tautology. Inverting the entire
  // origin rule (IMPORT renders as New, MANUAL as AI scanned) passed all 208
  // iterations of it. Deriving `expectedType` here from `parseTemplateFields`
  // and `documentTypeOriginOf` is what makes the origin loop below load-bearing
  // instead of decoration.
  it("keeps both labels tied to the facts they are supposed to read", () => {
    let checked = 0;
    for (const origin of [...DOCUMENT_TYPE_ORIGINS, "AUTO", undefined]) {
      for (const [, templateFields] of FIELDS) {
        for (const [, aiInterpretedAt] of STAMPS) {
          const hasForm = parseTemplateFields(templateFields).length > 0;
          const stamped = aiInterpretedAt instanceof Date
            || (typeof aiInterpretedAt === "string" && aiInterpretedAt.trim().length > 0);

          const expectedType = hasForm
            ? "aiCompleted"
            : documentTypeOriginOf(origin) === "IMPORT" ? "aiScanned" : "new";
          const expectedDoc = !stamped
            ? "new"
            : hasForm ? "aiProcessed" : "imported";

          expect(documentTypeStatus({ origin, templateFields })).toBe(expectedType);
          expect(documentStatus({ aiInterpretedAt, typeTemplateFields: templateFields }))
            .toBe(expectedDoc);

          // …and the brief's sentence, which is the LINK between the two.
          expect(expectedDoc === "aiProcessed").toBe(stamped && expectedType === "aiCompleted");
          checked += 1;
        }
      }
    }
    // ⚠️ A LITERAL, and round two of the review is why. This was
    // `4 * FIELDS.length * STAMPS.length` — read from the very arrays it claims
    // to protect, so emptying STAMPS took `checked` and `expected` to 0
    // together and the guard passed on a loop that ran no iterations.
    // 4 origins × 13 template shapes × 4 stamps. Update it deliberately when a
    // row is added; that is the point of it being a number.
    expect(checked).toBe(208);
  });
});
