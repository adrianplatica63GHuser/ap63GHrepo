/**
 * Slice 41.06 — a document's tile saved with its first value hides the rest behind „Arată N câmpuri goale”.
 *
 * THE CAUSE (Adrian, 2026-10-29: „if I fill in even one single field it will display the entire list of fields after
 * saving"). 40.71's rule (`emptyFieldsToHide`) hides nothing in a tile that was empty AS LOADED — that tile is 40.64's
 * one-line tile instead — and „as loaded" is the form's `defaultValues`. The Natural Person and the Property reset the
 * form with the saved values after a tile's „Salvează"; the Document did not, so its loaded values stayed the empty
 * ones until a reload: the saved tile was „empty as loaded", hid nothing, and drew every field as „—".
 */
import fs from "node:fs";
import path from "node:path";
import { emptyFieldsToHide } from "@/lib/ui/empty-fields";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const FORM = read("src", "app", "documents", "_components", "document-form.tsx");
const region = (src: string, from: string, to: string) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));

const PATHS = ["customFields.a", "customFields.b", "customFields.c"];

describe("the rule, on the two shapes of „loaded”", () => {
  it("loaded empty — as before the reset: nothing hides, whatever is set now (the bug's shape)", () => {
    expect(emptyFieldsToHide({ paths: PATHS, always: [], loaded: { customFields: {} }, now: { customFields: { b: "X" } } })).toEqual([]);
  });

  it("loaded as saved — after the reset: the empty fields hide", () => {
    const saved = { customFields: { b: "X" } };
    expect(emptyFieldsToHide({ paths: PATHS, always: [], loaded: saved, now: saved })).toEqual(["customFields.a", "customFields.c"]);
  });
});

describe("the Document resets after a tile's save, as the Natural Person and the Property do", () => {
  it("saveTile: the baseline, then form.reset(saved)", () => {
    const save = region(FORM, "const saveTile = async (tile: string)", "const editButton");
    expect(save).toMatch(/setBaseline\(\{ values: saved \}\);[\s\S]*form\.reset\(saved\);/);
  });

  it("the persons' and the property's forms reset there too — the shape the Document now shares", () => {
    for (const f of [
      ["src", "app", "natural-persons", "_components", "natural-person-form.tsx"],
      ["src", "app", "properties", "_components", "property-form.tsx"],
    ]) {
      expect(region(read(...f), "const saveTile = async", "const editTile")).toMatch(/form\.reset\(values\);/);
    }
  });
});

describe("a group whose every field hides hides whole, its heading too (Ask first 2)", () => {
  it("a framed Section takes its group's paths and hides when every one is hidden", () => {
    const section = region(FORM, "function Section({", "type FieldProps");
    expect(section).toContain("const hidden = useContext(HiddenFieldsContext);");
    expect(section).toMatch(/paths\.every\(\(p\) => hidden\.has\(p\)\)/);
    expect(section).toMatch(/style=\{hiddenFieldStyle\(allHidden, /);
  });

  it("every group's Section is given its paths — the other groups, the fees, the financial and the certificates", () => {
    expect(FORM).toMatch(/<Section key=\{label \|\| "_ungrouped"\}[^>]*paths=\{fields\.map\(/);
    expect(FORM).toMatch(/<Section key="fees"[^>]*paths=\{feesGroup\.fields\.map\(/);
    expect(FORM.match(/<Section panel="financial"[^>]*paths=\{financialGroup\.fields\.map\(/g) ?? []).toHaveLength(2);
    expect(FORM).toMatch(/<Section panel="certificates"[^>]*paths=\{certificatesGroup\.fields\.map\(/);
  });
});
