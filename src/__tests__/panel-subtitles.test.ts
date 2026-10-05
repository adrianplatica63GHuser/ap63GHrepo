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
    for (const g of ["Financiar", "Taxe și onorarii"]) expect([g, cvcGroups.has(g)]).toEqual([g, true]);
  });
});

describe('„Cadastru și CF" (#37.90)', () => {
  it("is the CVC's tab in the forms file, its English name unchanged", () => {
    const tabs = FORMS.CONTRACT_VANZARE.filter((f) => f.tabRo === "Cadastru și CF");
    expect(tabs.length).toBeGreaterThan(0);
    expect([...new Set(tabs.map((f) => f.tabEn))]).toEqual(["Cadastre and land book"]);
  });

  it('leaves no „Cadastru și carte funciară" anywhere in the forms file', () => {
    expect(FORMS_TEXT).not.toContain("Cadastru și carte funciară");
  });

  it("reads a tick stored under the old name as the new tile", () => {
    const reg = documentTileRegistry({
      typeKey: "CONTRACT_VANZARE",
      tabs: ["Preț și taxe", "Cadastru și CF", "Stare juridică", "Formalități"],
      succession: false,
      pages: true,
    });
    const stored = JSON.stringify([tabTileKey("Cadastru și carte funciară"), tabTileKey("Formalități")]);
    expect(parseStoredTiles(stored, reg)).toEqual([tabTileKey("Cadastru și CF"), tabTileKey("Formalități")]);
  });
});
