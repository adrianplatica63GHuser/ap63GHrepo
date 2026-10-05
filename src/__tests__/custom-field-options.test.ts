/**
 * Slice #37.73 — „Câmp specific" on the Documents list offers only fields with
 * a closed list of values, and shows each value by its Romanian label.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { customFieldOptionsOf, customFieldValueLabel } from "@/lib/documents/custom-field-options";

const ROOT = join(__dirname, "..", "..");
const FORMS = JSON.parse(readFileSync(join(ROOT, "src", "db", "document-type-forms.json"), "utf8")) as {
  forms: Record<string, unknown[]>;
};
const VIEW = readFileSync(join(ROOT, "src", "app", "documents", "list-view.tsx"), "utf8");

const TYPE = {
  id: "t1",
  templateFields: [
    { key: "stare", labelRo: "Stare plată", labelEn: "Payment", type: "select", order: 1, options: [
      { value: "ACHITAT_INTEGRAL", labelRo: "Achitat integral", labelEn: "Paid in full" },
      { value: "DE_ACHITAT", labelRo: "De achitat", labelEn: "Due" },
    ] },
    { key: "cnp", labelRo: "CNP 1", labelEn: "CNP 1", type: "text", order: 2 },
    { key: "suma", labelRo: "suma de", labelEn: "sum", type: "number", order: 3 },
    { key: "data", labelRo: "Data plății", labelEn: "Paid on", type: "date", order: 4 },
    { key: "note", labelRo: "Note", labelEn: "Notes", type: "textarea", order: 5 },
  ],
};

describe("„Câmp specific” offers only closed lists (Slice #37.73)", () => {
  it("a type with a select, a text, a number, a date and a textarea field offers the select only", () => {
    expect(customFieldOptionsOf([TYPE], undefined).map((o) => [o.key, o.label])).toEqual([["stare", "Stare plată"]]);
  });

  it("a value shows its option's label; a value the options no longer list shows as stored", () => {
    const [stare] = customFieldOptionsOf([TYPE], undefined);
    expect(customFieldValueLabel(stare, "ACHITAT_INTEGRAL")).toBe("Achitat integral");
    expect(customFieldValueLabel(stare, "VECHI_COD")).toBe("VECHI_COD");
    expect(customFieldValueLabel(undefined, "X")).toBe("X");
  });

  it("narrowed by the type filter, deduped by key, the first type's label and options winning", () => {
    const other = { id: "t2", templateFields: [{ key: "stare", labelRo: "Altă etichetă", type: "select", order: 1, options: [{ value: "ACHITAT_INTEGRAL", labelRo: "Alt text" }] }] };
    expect(customFieldOptionsOf([TYPE, other], undefined)).toHaveLength(1);
    expect(customFieldOptionsOf([TYPE, other], undefined)[0].labels.ACHITAT_INTEGRAL).toBe("Achitat integral");
    expect(customFieldOptionsOf([TYPE, other], ["t2"])[0].label).toBe("Altă etichetă");
    expect(customFieldOptionsOf([TYPE, other], [])).toEqual([]);
  });

  it("on the forms file: no Antecontract or Fișă field, the CVC's selects kept, its text fields dropped", () => {
    const types = Object.entries(FORMS.forms).map(([key, fields]) => ({ id: key, templateFields: fields }));
    const offered = customFieldOptionsOf(types, undefined);
    const keys = new Set(offered.map((o) => o.key));
    for (const gone of ["cnp_1", "cnp_2", "nr_cad", "nr_cadastral", "ci_seria_if_nr", "incheiere_de_autentificare_nr", "suma_de", "diferenta_de", "anul", "luna", "s_a_perceput_onorariul_de"]) {
      expect([gone, keys.has(gone)]).toEqual([gone, false]);
    }
    for (const f of FORMS.forms.FISA_CORPULUI_PROPRIETATE as { key: string }[]) expect([f.key, keys.has(f.key)]).toEqual([f.key, false]);
    for (const kept of ["monedaPret", "starePlata", "modalitatePlata"]) expect([kept, keys.has(kept)]).toEqual([kept, true]);
    expect(keys.has("temeiPret")).toBe(false);
    expect(offered.find((o) => o.key === "starePlata")!.labels.ACHITAT_INTEGRAL).toBe("Achitat integral");
  });

  it("the list draws the rule and the labels; the value sent stays the stored one", () => {
    // #38.07: through customFieldFilter (exactly one type), which calls customFieldOptionsOf.
    expect(VIEW).toMatch(/customFieldFilter\(typeOptions, initialDocumentTypeIds\)/);
    expect(readFileSync(join(ROOT, "src", "lib", "documents", "type-filter.ts"), "utf8")).toMatch(/customFieldOptionsOf\(types, checked\)/);
    expect(VIEW).toMatch(/value: customFieldValueLabel\(chosenCustomField, o\.value\)/);
    expect(VIEW).toMatch(/<option key=\{o\.value\} value=\{o\.value\}>/);
  });
});
