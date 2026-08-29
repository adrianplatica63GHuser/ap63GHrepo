/**
 * The two guards on the door the form editor writes through.   (Slice #27.03)
 *
 * Reference Data → Document Types → Formular saves a type's whole field list
 * through `PUT /api/admin/value-lists/document-types/[id]`, which is a
 * FULL-ROW replace: `updateValue` does `.set(parsed.data)`, so whatever comes
 * out of the Zod parse is written. #26.11 gave two reasons for not using that
 * door, and this slice had to answer both before it could.
 *
 *   1. **It defaulted `sortOrder` to 0.** No admin edit form sends the column
 *      — `LIST_META` does not list it for any list — so every rename also wrote
 *      `sort_order = 0`. On Property Types, whose list is ordered by it, a
 *      rename jumped the entry to the top; on Document Types the ordering is by
 *      name, so the reset was invisible until something else read the column,
 *      and nothing in the UI could put it back.
 *
 *   2. **It had no sanitising choke point.** Everything else that writes
 *      `template_fields` goes through `mergeAcceptedFields`, which is what
 *      keeps a newline out of a label — `buildExtractSystemPrompt` renders each
 *      field as ONE `//` comment line inside the JSON shape it shows the model,
 *      so a label with a line break breaks that shape.
 *
 * Both are asserted on BEHAVIOUR — parse a payload, look at what comes out —
 * rather than by grepping for the guard's name, for the reason
 * `document-type-origin-single-source.test.ts` states about the guard it
 * replaced: a substring test stays green after a refactor that moves the call
 * out of the branch that needs it. The one file read here is `queries.ts`, and
 * only to pin that the CREATE path is wired up too; a behavioural version of
 * that would need a database, and the update half is already pinned, as the
 * exact composed expression, in `document-type-origin-single-source.test.ts`.
 *
 * **The editor's own row logic is not here** — it lives in
 * `template-editor-rows.test.ts`, against the pure module a review round moved
 * it into. This file is the DOOR; that one is the keyboard.
 */

import fs from "fs";
import path from "path";
import {
  LIST_SCHEMAS,
  LIST_UPDATE_SCHEMAS,
  documentTypeSchema,
  documentTypeUpdateSchema,
  sanitizeDocumentTypeTemplateFields,
} from "@/lib/admin/value-lists/validation";
import { VALID_LIST_KEYS } from "@/lib/admin/value-lists/config";
import { MAX_TEMPLATE_FIELDS } from "@/lib/documents/discover-to-template";
import type { DocumentTemplateField } from "@/lib/documents/template-fields";

/**
 * A payload that satisfies every list's create schema at once. Zod objects
 * strip unknown keys, so the extra one is harmless where it is not needed —
 * `tarla` requires `indicativ`, everything else requires `name`.
 */
const MINIMAL = { name: "Contract", indicativ: "T12" };

function field(over: Partial<DocumentTemplateField> = {}): DocumentTemplateField {
  return {
    key: "pretTotal",
    labelRo: "Preț total",
    labelEn: "Total price",
    type: "text",
    order: 0,
    aiHint: null,
    groupRo: null,
    groupEn: null,
    ...over,
  };
}

describe("a rename cannot reset a sort order", () => {
  it("defaults sortOrder to 0 on a create, for every list", () => {
    for (const key of VALID_LIST_KEYS) {
      const parsed = LIST_SCHEMAS[key].parse(MINIMAL);
      expect([key, parsed.sortOrder]).toEqual([key, 0]);
    }
  });

  // The fix, stated as the thing that actually matters: NO NUMBER COMES OUT.
  // Measured against the repo's zod 4.3.6, an omitted key stays omitted from
  // the parsed object entirely; the null case below is the one where the key
  // survives carrying `undefined`. Both are fine, and asserting on the VALUE
  // rather than on key presence is what makes this one test cover both — what
  // `.default(0)` produced, and the only thing Drizzle's `mapUpdateSet` looks
  // at, is a real 0 versus no value at all.
  it("leaves sortOrder out of an update that does not mention it, for every list", () => {
    for (const key of VALID_LIST_KEYS) {
      const parsed = LIST_UPDATE_SCHEMAS[key].parse(MINIMAL);
      expect([key, parsed.sortOrder]).toEqual([key, undefined]);
    }
  });

  it("still writes a sort order that IS sent", () => {
    for (const key of VALID_LIST_KEYS) {
      const parsed = LIST_UPDATE_SCHEMAS[key].parse({ ...MINIMAL, sortOrder: 7 });
      expect([key, parsed.sortOrder]).toEqual([key, 7]);
    }
  });

  /**
   * ⚠️ **The trap `z.coerce` sets, and the reason `.optional()` alone was not
   * the fix.** `Number(null)` is 0, so a bare `z.coerce.number().optional()`
   * happily parses `sortOrder: null` into a real zero and writes it — the exact
   * reset this field exists to prevent, arriving by the one route `.optional()`
   * does not cover. A `null` must therefore behave like an absent key: parse,
   * but produce no number, so Drizzle's `mapUpdateSet` drops it and the column
   * keeps what it had.
   *
   * Asserted as `=== undefined` rather than "the key is absent": the preprocess
   * runs on a key that WAS in the input, so the key survives into the output
   * object carrying undefined. That is the shape Drizzle filters on, and it is
   * the shape that matters.
   */
  it("treats an explicit null sort order as no sort order, not as zero", () => {
    for (const key of VALID_LIST_KEYS) {
      const parsed = LIST_UPDATE_SCHEMAS[key].safeParse({ ...MINIMAL, sortOrder: null });
      expect([key, parsed.success]).toEqual([key, true]);
      expect([key, parsed.data?.sortOrder]).toEqual([key, undefined]);
    }
  });

  it("still rejects a sort order that is neither absent nor a valid number", () => {
    for (const key of VALID_LIST_KEYS) {
      expect([key, LIST_UPDATE_SCHEMAS[key].safeParse({ ...MINIMAL, sortOrder: -1 }).success])
        .toEqual([key, false]);
      expect([key, LIST_UPDATE_SCHEMAS[key].safeParse({ ...MINIMAL, sortOrder: "abc" }).success])
        .toEqual([key, false]);
    }
  });

  // The coercion the create side has always done is not lost on the update
  // side: a form value arrives as a string and still becomes a number.
  it("still coerces a numeric string", () => {
    for (const key of VALID_LIST_KEYS) {
      const parsed = LIST_UPDATE_SCHEMAS[key].parse({ ...MINIMAL, sortOrder: "7" });
      expect([key, parsed.sortOrder]).toEqual([key, 7]);
    }
  });

  it("is wired into the schema the PUT route actually uses", () => {
    expect(LIST_UPDATE_SCHEMAS["document-types"]).toBe(documentTypeUpdateSchema);
  });
});

describe("template fields go through the one sanitiser", () => {
  it("collapses a label typed with a line break", () => {
    const { templateFields } = sanitizeDocumentTypeTemplateFields({
      name: "Contract",
      templateFields: [field({ labelRo: "Preț\ntotal", labelEn: "Total\t price" })],
    }) as { templateFields: DocumentTemplateField[] };

    expect(templateFields[0].labelRo).toBe("Preț total");
    expect(templateFields[0].labelEn).toBe("Total price");
  });

  it("collapses an AI hint and a free-text group name too", () => {
    const { templateFields } = sanitizeDocumentTypeTemplateFields({
      name: "Contract",
      templateFields: [field({ aiHint: "look\nhere", groupRo: "Alt\npanou", groupEn: "Alt\npanou" })],
    }) as { templateFields: DocumentTemplateField[] };

    expect(templateFields[0].aiHint).toBe("look here");
    expect(templateFields[0].groupRo).toBe("Alt panou");
    expect(templateFields[0].groupEn).toBe("Alt panou");
  });

  // The rule the whole slice is built on. `pretTotal` is camelCase and would
  // slug to `prettotal`; every document of the type already holds its value
  // under the camelCase spelling.
  it("returns a key byte-for-byte, whatever happened to the label", () => {
    const { templateFields } = sanitizeDocumentTypeTemplateFields({
      name: "Contract",
      templateFields: [field({ key: "pretTotal", labelRo: "Valoare contract" })],
    }) as { templateFields: DocumentTemplateField[] };

    expect(templateFields[0].key).toBe("pretTotal");
  });

  // Reordering in the editor is moving a row; the number is the server's job.
  it("renumbers order from array position, ignoring what the caller sent", () => {
    const { templateFields } = sanitizeDocumentTypeTemplateFields({
      name: "Contract",
      templateFields: [
        field({ key: "b", order: 99 }),
        field({ key: "a", order: 99 }),
        field({ key: "c", order: 4 }),
      ],
    }) as { templateFields: DocumentTemplateField[] };

    expect(templateFields.map((f) => [f.key, f.order])).toEqual([
      ["b", 0],
      ["a", 1],
      ["c", 2],
    ]);
  });

  it("collapses two rows that would share one custom_fields key", () => {
    const { templateFields } = sanitizeDocumentTypeTemplateFields({
      name: "Contract",
      templateFields: [field({ key: "pretTotal" }), field({ key: "pretTotal" })],
    }) as { templateFields: DocumentTemplateField[] };

    expect(templateFields).toHaveLength(1);
  });

  // A plain rename, and an explicit clear. Neither is a field list, and each
  // has to survive untouched — the first so a rename cannot disturb the form,
  // the second so clearing one still reaches the column.
  it("passes an absent or null templateFields straight through", () => {
    expect(sanitizeDocumentTypeTemplateFields({ name: "Contract" }))
      .toEqual({ name: "Contract" });
    expect(sanitizeDocumentTypeTemplateFields({ name: "Contract", templateFields: null }))
      .toEqual({ name: "Contract", templateFields: null });
  });

  // Removal is what the editor's confirmation promises is reversible: the field
  // leaves the list, and nothing about the remaining keys changes — which is
  // what makes "add a field with the same key and the values reappear" true.
  it("drops a removed field without disturbing the keys that stay", () => {
    const { templateFields } = sanitizeDocumentTypeTemplateFields({
      name: "Contract",
      templateFields: [field({ key: "pretTotal" }), field({ key: "dataPlata" })],
    }) as { templateFields: DocumentTemplateField[] };
    expect(templateFields.map((f) => f.key)).toEqual(["pretTotal", "dataPlata"]);

    const after = sanitizeDocumentTypeTemplateFields({
      name: "Contract",
      templateFields: [field({ key: "dataPlata" })],
    }) as { templateFields: DocumentTemplateField[] };
    expect(after.templateFields.map((f) => f.key)).toEqual(["dataPlata"]);
  });

  // The update half of this is pinned in
  // `document-type-origin-single-source.test.ts`, where the composed
  // `.set(sanitize(strip(data)))` expression is the thing under test. Only the
  // create path is asserted here, so the two files do not both fail for one
  // reason and teach the next reader that one of them is noise.
  it("is applied on the create path too, not only the update", () => {
    const queries = fs.readFileSync(
      path.join(process.cwd(), "src/lib/admin/value-lists/queries.ts"),
      "utf8",
    );
    // ⚠️ **Slice #32.07 hoisted the sanitiser into a local** so its
    // identity-card guard could read the sanitised template before the insert.
    // Both halves are pinned, for the reason the sibling file states: either
    // one alone would stay green with the column written from something else.
    // Comment-stripped, for the reason the sibling file records: a literal that
    // also occurs in a comment is a pin a comment can satisfy.
    const code = queries
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).toContain("const values = sanitizeDocumentTypeTemplateFields(data);");
    expect(code).toContain(".values({ ...values, key, origin })");
  });
});

describe("the ceiling holds on this door too", () => {
  it("accepts a template exactly at the limit", () => {
    const fields = Array.from({ length: MAX_TEMPLATE_FIELDS }, (_, i) =>
      field({ key: `k${i}` }),
    );
    expect(documentTypeUpdateSchema.safeParse({ name: "Contract", templateFields: fields }).success)
      .toBe(true);
  });

  it("rejects one field past it, on create and on update alike", () => {
    const fields = Array.from({ length: MAX_TEMPLATE_FIELDS + 1 }, (_, i) =>
      field({ key: `k${i}` }),
    );
    expect(documentTypeSchema.safeParse({ name: "Contract", templateFields: fields }).success)
      .toBe(false);
    expect(documentTypeUpdateSchema.safeParse({ name: "Contract", templateFields: fields }).success)
      .toBe(false);
  });
});
