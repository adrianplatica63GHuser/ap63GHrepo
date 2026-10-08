/**
 * A Document's panel subtitles in square brackets, and the CVC's tile
 * „Cadastru și carte funciară" renamed „Cadastru și CF".        (Slice #37.90)
 *
 * The brackets are display only — `panelSubtitle` wraps the stored `groupRo`
 * where a framed section draws it — so the forms file keeps every panel's
 * name bare. The rename is data: the CVC's `tabRo` in
 * `src/db/document-type-forms.json`, which the runner's forms-export writes
 * from the local database; `tabEn` stays. A tick stored under the old name is
 * read as the new one.
 */
import fs from "node:fs";
import path from "node:path";
import { panelSubtitle } from "@/lib/ui/panel-subtitle";
import { parseStoredTiles } from "@/lib/ui/tiles";
import { documentTileRegistry, tabTileKey } from "@/app/documents/_components/document-tiles";

type Field = { key: string; tabRo?: string; tabEn?: string; groupRo?: string; groupEn?: string };
const FORMS_TEXT = fs.readFileSync(path.join(process.cwd(), "src/db/document-type-forms.json"), "utf8");
const FORMS = (JSON.parse(FORMS_TEXT) as { forms: Record<string, Field[]> }).forms;
const FORM_SOURCE = fs.readFileSync(path.join(process.cwd(), "src/app/documents/_components/document-form.tsx"), "utf8");

describe("a panel's subtitle inside a tile (#37.90)", () => {
  it('is "[" + groupRo + "]"', () => {
    expect(panelSubtitle("Financiar")).toBe("[Financiar]");
    expect(panelSubtitle("Taxe și onorarii")).toBe("[Taxe și onorarii]");
  });

  it("is what a framed section's heading draws, and only a framed one", () => {
    expect(FORM_SOURCE).toContain("{framed ? panelSubtitle(title) : title}");
  });

  it("leaves every stored panel name bare, so recognition by text and the AI prompt read it as before", () => {
    const groups = Object.values(FORMS).flat().map((f) => f.groupRo ?? "");
    expect(groups.filter((g) => g.startsWith("[") || g.endsWith("]"))).toEqual([]);
    const cvcGroups = new Set(FORMS.CONTRACT_VANZARE.map((f) => f.groupRo));
    // #38.33: the CVC has no „Financiar" any more (its fields are „Preț" and „Plată"); the fees group keeps its name.
    for (const g of ["Taxe și onorarii"]) expect([g, cvcGroups.has(g)]).toEqual([g, true]);
  });
});

// #38.33: „Cadastru și CF" (#37.90) became „Carte funciară" and „Obiectul vânzării"; this block
// used to assert it was the CVC's tab, „Cadastre and land book" in English.
describe('„Cadastru și CF" (#37.90, split by #38.33)', () => {
  it("is no longer a tab; „Carte funciară” is, „Land book” in English", () => {
    expect(FORMS.CONTRACT_VANZARE.filter((f) => f.tabRo === "Cadastru și CF")).toEqual([]);
    const cf = FORMS.CONTRACT_VANZARE.filter((f) => f.tabRo === "Carte funciară");
    expect(cf.length).toBeGreaterThan(0);
    expect([...new Set(cf.map((f) => f.tabEn))]).toEqual(["Land book"]);
  });

  it('leaves no „Cadastru și carte funciară" anywhere in the forms file', () => {
    expect(FORMS_TEXT).not.toContain("Cadastru și carte funciară");
  });

  it("reads a tick stored under the old names as the new tiles", () => {
    const reg = documentTileRegistry({
      typeKey: "CONTRACT_VANZARE",
      tabs: ["Preț și plată", "Obiectul vânzării", "Carte funciară", "Declarații și garanții", "Taxe și cheltuieli"],
      succession: false,
      pages: true,
    });
    const stored = JSON.stringify([tabTileKey("Cadastru și carte funciară"), tabTileKey("Formalități")]);
    expect(parseStoredTiles(stored, reg)).toEqual([
      tabTileKey("Obiectul vânzării"), tabTileKey("Carte funciară"), tabTileKey("Declarații și garanții"), tabTileKey("Taxe și cheltuieli"),
    ]);
  });
});
