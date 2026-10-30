/**
 * Slice 41.07 — a document's baseline is a COPY of what was saved, never React Hook Form's live values.
 *
 * THE CAUSE (Adrian, 2026-10-29: „the Save button was disabled And when I try to cancel the change it went back to the
 * read only mode but the save was actually performed"). `doSave` returned `valuesForSave(values)`, which is `values`
 * itself when nothing is stripped — and `values` was `form.getValues()`, the object React Hook Form goes on writing
 * into. After a first save the baseline therefore WAS the form: `editDirty` (the form against the baseline) was false
 * for the rest of the visit, so „Salvează" stayed disabled, switching tiles never asked, and „Renunță"
 * (`form.reset(baseline.values)`) reset the form to itself. The change stayed, and the next save of any tile wrote it —
 * Adrian's contract nr. 3876 holds „Plătitor taxe locale" and „Obligație număr cadastral" in one version (v4).
 */
import fs from "node:fs";
import path from "node:path";

const FORM = fs.readFileSync(path.join(process.cwd(), "src", "app", "documents", "_components", "document-form.tsx"), "utf8");
const region = (from: string, to: string) => FORM.slice(FORM.indexOf(from), FORM.indexOf(to, FORM.indexOf(from)));

describe("the shape of the defect, in plain objects", () => {
  it("a baseline that IS the live object never differs from it — a copy does", () => {
    const live = { customFields: { taxeLocalePlatiteDe: "" } as Record<string, string> };
    const aliased = live;
    const copied = structuredClone(live);
    live.customFields.taxeLocalePlatiteDe = "VANZATOR";
    expect(JSON.stringify(aliased) === JSON.stringify(live)).toBe(true); // „not dirty": Salvează disabled
    expect(JSON.stringify(copied) === JSON.stringify(live)).toBe(false); // dirty: Salvează lit
  });
});

describe("doSave returns a copy, and every save path takes the saved values as loaded", () => {
  it("doSave: structuredClone(valuesToSave), never valuesToSave itself", () => {
    const save = region("const doSave = async", "const onSubmit = async");
    expect(save).toContain("return structuredClone(valuesToSave);");
    expect(save).not.toMatch(/return valuesToSave;/);
  });

  it("the whole save, „Fă curentă” and a tile's save each reset the form with what was saved", () => {
    expect(region("const onSubmit = async", "const handleMakeCurrent")).toMatch(/setBaseline\(\{ values: saved \}\);[\s\S]*form\.reset\(saved\);/);
    expect(region("const handleMakeCurrent = async", "useUnsavedChangesGuard(")).toMatch(/setBaseline\(\{ values: saved \}\);\s*form\.reset\(saved\);/);
    expect(region("const saveTile = async (tile: string)", "const editButton")).toMatch(/form\.reset\(saved\);/);
  });

  it("„Renunță” puts the form back to the baseline, and the baseline is what the dirty check reads", () => {
    expect(FORM).toMatch(/const discardEdits = useCallback\(\(\) => \{\s*form\.reset\(baselineRef\.current\.values\);/);
    expect(FORM).toMatch(/!formValuesEqual\(watchedValues, baseline\.values\)/);
  });
});
