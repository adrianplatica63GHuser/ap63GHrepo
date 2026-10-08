/**
 * Slice #38.51 — document types: „Cu formular” and „Fără formular”. TC-VL-06 drives it.
 */
import fs from "node:fs";
import path from "node:path";
import { formFilterFrom, formFilterKeeps, formFilterNarrows } from "@/lib/admin/value-lists/form-filter";
import { documentTypeHasForm } from "@/lib/documents/status";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const code = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const FIELD = { key: "pret", type: "number", labelRo: "Preț", labelEn: "Price", order: 0 };
const TYPES = [
  { name: "Contract de Vânzare", templateFields: [FIELD] },
  { name: "Adeverință", templateFields: [] },
  { name: "Document necunoscut", templateFields: null }, // the catch-all
  { name: "Carte de identitate", templateFields: null }, // the identity card
];
const shown = (withForm: boolean, withoutForm: boolean) =>
  TYPES.filter((t) => formFilterKeeps({ withForm, withoutForm }, documentTypeHasForm(t.templateFields))).map((t) => t.name);

describe("the two predicates (#38.51)", () => {
  it("„Cu formular” alone: the types with at least one field", () => {
    expect(shown(true, false)).toEqual(["Contract de Vânzare"]);
  });

  it("„Fără formular” alone: every type whose form is empty — the catch-all and the identity card included (Ask first 1)", () => {
    expect(shown(false, true)).toEqual(["Adeverință", "Document necunoscut", "Carte de identitate"]);
  });

  it("both, or neither, is the whole list — two checkboxes, not a radio (Ask first 2); the two add up to it", () => {
    expect(shown(true, true)).toEqual(TYPES.map((t) => t.name));
    expect(shown(false, false)).toEqual(TYPES.map((t) => t.name));
    expect([...shown(true, false), ...shown(false, true)].sort()).toEqual(TYPES.map((t) => t.name).sort());
    expect(formFilterNarrows({ withForm: true, withoutForm: true })).toBe(false);
    expect(formFilterNarrows({ withForm: false, withoutForm: false })).toBe(false);
  });

  it("the address: `?form=without` ticks „Fără formular”, `?form=with` „Cu formular”, anything else nothing", () => {
    expect(formFilterFrom("without")).toEqual({ withForm: false, withoutForm: true });
    expect(formFilterFrom("with")).toEqual({ withForm: true, withoutForm: false });
    for (const p of [null, undefined, "", "WITHOUT", "x"]) expect(formFilterFrom(p)).toEqual({ withForm: false, withoutForm: false });
  });
});

describe("the screen and the import's link (#38.51)", () => {
  const modal = code(read("src", "app", "admin", "value-lists", "_components", "value-list-modal.tsx"));
  const ro = JSON.parse(read("messages", "ro-RO.json"));
  const en = JSON.parse(read("messages", "en-GB.json"));

  it("two checkboxes on the document types, the old one gone; the other review lists keep theirs", () => {
    expect(modal).toContain('{(["withForm", "withoutForm"] as const).map((k) => (');
    expect(modal).toContain("{!isDocumentTypes && review && offerReview && (");
    expect(ro.valueList.toolbar).toMatchObject({ withForm: "Cu formular", withoutForm: "Fără formular" });
    expect(en.valueList.toolbar).toMatchObject({ withForm: "With a form", withoutForm: "Without a form" });
    expect(ro.valueList.toolbar.onlyWithoutForm).toBeUndefined();
    expect(ro.valueList.toolbar.onlyAwaitingReview).toBeTruthy();
  });

  it("the retained rows and the backlog banner keep their guarantees under the new filter", () => {
    expect(modal).toMatch(/formFilterKeeps\(formFilter, documentTypeHasForm\(row\.templateFields\)\) \|\| touchedTypeIds\.has\(row\.id\)/);
    expect(modal).toContain("if (filterOn) {");
    expect(modal.replace(/\s+/g, "")).toContain("constbacklogEmpty=awaitingOn&&");
  });

  it("the import's stop screen opens the list with „Fără formular” ticked, and its report quotes that label", () => {
    expect(read("src", "app", "admin", "import", "_components", "import-types-blocked-stage.tsx")).toContain("?list=document-types&form=without");
    expect(read("src", "app", "admin", "value-lists", "page.tsx")).toContain("initialFormFilter={form}");
    expect(ro.adminImport.wizard.importDialog.typeNote.typesStillWithoutForm).toContain("„Fără formular”");
  });
});
