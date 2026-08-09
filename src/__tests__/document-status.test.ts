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

import {
  DOCUMENT_TYPE_ORIGINS,
  DOCUMENT_TYPE_STATUS_CLASS,
  documentStatus,
  documentTypeHasForm,
  documentTypeNameClass,
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

  it("is AI processed when an import read it into its type's form", () => {
    expect(documentStatus({
      aiInterpretedAt:    new Date("2026-08-09T10:00:00.000Z"),
      typeTemplateFields: [FIELD],
    })).toBe("aiProcessed");
    expect(documentStatus({
      aiInterpretedAt:    "2026-08-09T10:00:00.000Z",
      typeTemplateFields: [FIELD],
    })).toBe("aiProcessed");
  });

  it("is Imported when an import read it and the type had no form", () => {
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

  it("keeps the document label and the type label in agreement", () => {
    for (const origin of [...DOCUMENT_TYPE_ORIGINS, "AUTO", undefined]) {
      for (const [, templateFields] of FIELDS) {
        for (const [, aiInterpretedAt] of STAMPS) {
          const typeStatus = documentTypeStatus({ origin, templateFields });
          const docStatus  = documentStatus({ aiInterpretedAt, typeTemplateFields: templateFields });
          const stamped = aiInterpretedAt instanceof Date
            || (typeof aiInterpretedAt === "string" && aiInterpretedAt.trim().length > 0);

          expect(docStatus === "aiProcessed").toBe(stamped && typeStatus === "aiCompleted");
          expect(docStatus === "imported").toBe(stamped && typeStatus !== "aiCompleted");
          expect(docStatus === "new").toBe(!stamped);
        }
      }
    }
  });
});
