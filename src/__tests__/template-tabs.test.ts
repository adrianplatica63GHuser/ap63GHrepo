/**
 * The notebook, and the promise it makes to every type that has no notebook.
 *                                                              (Slice #36.01)
 *
 * WHAT IS WORTH ASSERTING HERE
 * ----------------------------
 * ⚠️ **THE TEST THAT MATTERS IS THE NO-TAB ONE.** Forty-odd document types
 * carry `template_fields` with no tab anywhere in them, and the whole of
 * #36.01's compatibility guarantee is that they keep rendering exactly as they
 * did — one column of panels, no notebook chrome. In `document-form.tsx` that
 * guarantee is one ternary on `tabs.length > 0`, so the thing to pin is that
 * `templateTabsOf` returns `[]` for every shape a pre-#36.01 template can
 * have. If that holds, the old branch is taken, and the old branch is the code
 * that was already there.
 *
 * The rest — a field with no tab landing on the first page, a panel following
 * its first field, the fees/Financiar pair staying together or coming apart —
 * are the rules the Form editor's help text states. They are asserted because
 * an administrator is told them in words, and a rule you are told and the
 * program does not follow is worse than no rule.
 *
 * Pure module, no React: `document-form.tsx` reads these functions and does
 * nothing else with tabs, so asserting them here asserts the layout without
 * mounting a form whose every other input is wired to react-hook-form,
 * react-query and next-intl.
 */

import {
  feesPairStaysTogether,
  tabIndexOfFeesPair,
  tabIndexOfField,
  tabIndexOfPanel,
  templateTabLabelOf,
  templateTabsOf,
} from "@/lib/documents/template-tabs";
import { parseTemplateFields, type DocumentTemplateField } from "@/lib/documents/template-fields";

function field(over: Partial<DocumentTemplateField> & { key: string }): DocumentTemplateField {
  return {
    labelRo: over.key,
    labelEn: over.key,
    type: "text",
    order: 0,
    aiHint: null,
    groupRo: null,
    groupEn: null,
    tabRo: null,
    tabEn: null,
    options: null,
    ...over,
  };
}

describe("a template with no tabs is the form as it was", () => {
  it("has no tabs when no field carries one", () => {
    const fields = [
      field({ key: "a", order: 0, groupRo: "Financiar", groupEn: "Financial" }),
      field({ key: "b", order: 1, groupRo: "Taxe și onorarii", groupEn: "Fees" }),
      field({ key: "c", order: 2 }),
    ];
    expect(templateTabsOf(fields)).toEqual([]);
  });

  it("has no tabs for a template parsed from a row written before this slice", () => {
    // Exactly the jsonb shape migration_066 documents — no `tabRo`, no
    // `tabEn`, no `options` key at all. `parseTemplateFields` fills them with
    // null, and null is not a tab.
    const stored = [
      { key: "pretTotal", labelRo: "Preț total", labelEn: "Total price", type: "number", order: 0 },
      { key: "nrCadastral", labelRo: "Nr. cadastral", labelEn: "Cadastral no.", type: "text", order: 1,
        groupRo: "Certificate și referințe", groupEn: "Certificates and references" },
    ];
    expect(templateTabsOf(parseTemplateFields(stored))).toEqual([]);
  });

  it("has no tabs when every field's tab is empty or whitespace-only after storage", () => {
    // `sanitizeTemplateField` collapses a tab to null when it is blank, but a
    // row written by hand could still carry "". Belt-and-braces: "" is falsy,
    // so it is not a tab here either.
    const fields = [field({ key: "a", tabRo: "", tabEn: "" }), field({ key: "b", tabRo: null, tabEn: "" })];
    expect(templateTabsOf(fields)).toEqual([]);
  });

  it("puts everything on page 0 when there are no tabs, so the single stack renders whole", () => {
    const fields = [field({ key: "a" }), field({ key: "b" })];
    const tabs = templateTabsOf(fields);
    expect(tabIndexOfField(fields[0], tabs)).toBe(0);
    expect(tabIndexOfPanel(fields, tabs)).toBe(0);
    expect(feesPairStaysTogether([fields[0]], [fields[1]], tabs)).toBe(true);
  });
});

describe("tabs, in field order", () => {
  it("lists each tab once, where its first field appears", () => {
    const fields = [
      field({ key: "a", order: 0, tabRo: "Instrument", tabEn: "Instrument" }),
      field({ key: "b", order: 1, tabRo: "Cadastru", tabEn: "Cadastre" }),
      field({ key: "c", order: 2, tabRo: "Instrument", tabEn: "Instrument" }),
      field({ key: "d", order: 3, tabRo: "Stare juridică", tabEn: "Legal status" }),
    ];
    expect(templateTabsOf(fields)).toEqual(["Instrument", "Cadastru", "Stare juridică"]);
  });

  it("buckets on the Romanian name, falling back to the English one", () => {
    // The same rule `document-form.tsx` applies to panels: `tabRo || tabEn`.
    expect(templateTabLabelOf({ tabRo: "Cadastru", tabEn: "Cadastre" })).toBe("Cadastru");
    expect(templateTabLabelOf({ tabRo: null, tabEn: "Cadastre" })).toBe("Cadastre");
    expect(templateTabLabelOf({ tabRo: null, tabEn: null })).toBe("");
  });

  it("treats two spellings of one name as two tabs, visibly", () => {
    // Exact text, no diacritic fold — `templateFieldGroupOf`'s decision, for
    // its reason: a tolerant match would report a layout the form does not
    // apply. Two tabs on screen is a mistake an administrator can SEE.
    const fields = [
      field({ key: "a", order: 0, tabRo: "Stare juridică" }),
      field({ key: "b", order: 1, tabRo: "Stare juridica" }),
    ];
    expect(templateTabsOf(fields)).toEqual(["Stare juridică", "Stare juridica"]);
  });
});

describe("what lands where", () => {
  const tabs = ["Instrument", "Cadastru", "Stare juridică"];

  it("puts a field with no tab on the first page", () => {
    expect(tabIndexOfField(field({ key: "x" }), tabs)).toBe(0);
  });

  it("puts a field naming a tab nobody else has on the first page rather than nowhere", () => {
    // Not reachable through the editor, which offers the type's own tabs — but
    // a hand-written row can say anything, and a field the notebook cannot
    // show is a captured value nobody can see.
    expect(tabIndexOfField(field({ key: "x", tabRo: "Inventat" }), tabs)).toBe(0);
  });

  it("puts a panel on its FIRST field's page and does not split it", () => {
    const panel = [
      field({ key: "a", order: 0, tabRo: "Cadastru" }),
      field({ key: "b", order: 1, tabRo: "Stare juridică" }),
    ];
    expect(tabIndexOfPanel(panel, tabs)).toBe(1);
  });

  it("puts an empty panel on the first page", () => {
    expect(tabIndexOfPanel([], tabs)).toBe(0);
  });
});

describe("the Taxe și onorarii / Financiar pair", () => {
  const tabs = ["Instrument", "Cadastru"];

  it("pairs when both groups' fields are on one page", () => {
    const fees = [field({ key: "f", order: 5, tabRo: "Instrument" })];
    const fin = [field({ key: "p", order: 0, tabRo: "Instrument" })];
    expect(feesPairStaysTogether(fees, fin, tabs)).toBe(true);
    expect(tabIndexOfFeesPair(fees, fin, tabs)).toBe(0);
  });

  it("comes apart when they are on different pages", () => {
    // Half a pair drawn on each page would be the same panel twice.
    const fees = [field({ key: "f", order: 5, tabRo: "Instrument" })];
    const fin = [field({ key: "p", order: 0, tabRo: "Cadastru" })];
    expect(feesPairStaysTogether(fees, fin, tabs)).toBe(false);
    expect(tabIndexOfPanel(fees, tabs)).toBe(0);
    expect(tabIndexOfPanel(fin, tabs)).toBe(1);
  });

  it("follows Financiar when the type gives the fees panel no fields of its own", () => {
    // The fees panel always renders — it carries Notariat / Nr. act autentic /
    // Data autentificării for every type — so with no fields of its own it
    // goes wherever its partner is rather than stranding those three on page 0.
    const fin = [field({ key: "p", order: 0, tabRo: "Cadastru" })];
    expect(feesPairStaysTogether([], fin, tabs)).toBe(true);
    expect(tabIndexOfFeesPair([], fin, tabs)).toBe(1);
  });

  it("puts the fees panel on the first page when neither group has a field", () => {
    expect(tabIndexOfFeesPair([], [], tabs)).toBe(0);
    expect(feesPairStaysTogether([], [], tabs)).toBe(false);
  });

  it("takes the pair's page from the earliest field by order, not by argument position", () => {
    const fees = [field({ key: "f", order: 9, tabRo: "Cadastru" })];
    const fin = [field({ key: "p", order: 1, tabRo: "Instrument" })];
    expect(tabIndexOfFeesPair(fees, fin, tabs)).toBe(0);
  });
});
