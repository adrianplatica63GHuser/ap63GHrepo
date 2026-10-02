/**
 * The CVC's tiles and panels named so each reads as one name, the fees' order,
 * and a remembered tile choice that survives the rename.        (Slice #37.54)
 *
 * The names and the order are data — `lookup_document_type.template_fields`,
 * exported to `src/db/document-type-forms.json` by the runner's forms-export —
 * so this suite reads that file, the way a rebuilt database and Ciprian's box
 * get them. A tile's key is its tab's label (`tabTileKey`), so the three
 * renamed tabs carry their old keys in `RENAMED_TABS`, and a choice stored
 * under an old key is read as the new one.
 */
import fs from "node:fs";
import path from "node:path";
import { parseStoredTiles } from "@/lib/ui/tiles";
import { RENAMED_TABS, documentTileRegistry, tabTileKey } from "@/app/documents/_components/document-tiles";

type Field = { key: string; order: number; tabRo?: string; tabEn?: string; groupRo?: string; groupEn?: string };
const CVC = (
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/db/document-type-forms.json"), "utf8")) as {
    forms: Record<string, Field[]>;
  }
).forms.CONTRACT_VANZARE;

/** Tile → its panels, Romanian and English, in form order. */
function layout(fields: readonly Field[]) {
  const out: { tab: string; tabEn: string; panels: [string, string][] }[] = [];
  for (const f of [...fields].sort((a, b) => a.order - b.order)) {
    let tile = out.find((t) => t.tab === f.tabRo);
    if (!tile) out.push((tile = { tab: f.tabRo ?? "", tabEn: f.tabEn ?? "", panels: [] }));
    if (!tile.panels.some(([ro]) => ro === f.groupRo)) tile.panels.push([f.groupRo ?? "", f.groupEn ?? ""]);
  }
  return out;
}

describe("the CVC's tiles and panels (#37.54)", () => {
  it("are named as the header names them, in Romanian and English", () => {
    expect(layout(CVC)).toEqual([
      { tab: "Preț și taxe", tabEn: "Price and fees", panels: [["Financiar", "Financial"], ["Taxe și onorarii", "Fees"]] },
      {
        tab: "Cadastru și carte funciară",
        tabEn: "Cadastre and land book",
        panels: [["Dosar și exemplar", "File and copy"], ["Excepție cadastru", "Cadastre exception"], ["Obiect declarat", "Declared object"]],
      },
      { tab: "Stare juridică", tabEn: "Legal status", panels: [["Declarații și garanții", "Representations and warranties"]] },
      { tab: "Formalități", tabEn: "Formalities", panels: [["Declarații și obligații legale", "Statutory declarations and duties"]] },
    ]);
  });

  it("keeps none of the old names", () => {
    const names = new Set(CVC.flatMap((f) => [f.tabRo, f.groupRo]));
    for (const old of ["Instrument", "Cadastru", "Conformitate", "Antet instrument", "Stare juridică afirmată", "Conformitate și formalități"]) {
      expect([old, names.has(old)]).toEqual([old, false]);
    }
  });

  it("orders the fees Timbru judiciar, Onorariu notarial, Impozit transfer, Taxă timbru și publicitate", () => {
    const fees = [...CVC].filter((f) => f.groupRo === "Taxe și onorarii").sort((a, b) => a.order - b.order).map((f) => f.key);
    expect(fees).toEqual(["timbruJudiciar", "onorariuNotarial", "impozitTransfer", "taxaTimbruPublicitate"]);
  });

  it("keeps every field's `order` 0..n-1, each once, as the Form editor writes it", () => {
    expect([...CVC].map((f) => f.order).sort((a, b) => a - b)).toEqual(CVC.map((_, i) => i));
  });
});

describe("a remembered tile choice survives the rename (#37.54)", () => {
  const TABS = ["Preț și taxe", "Cadastru și carte funciară", "Stare juridică", "Formalități"];
  const reg = documentTileRegistry({ typeKey: "CONTRACT_VANZARE", tabs: TABS, succession: false, pages: true });

  it("maps each old tab key to its new one, for the tabs the type has", () => {
    expect(reg.renamed).toEqual({
      [tabTileKey("Instrument")]: tabTileKey("Preț și taxe"),
      [tabTileKey("Cadastru")]: tabTileKey("Cadastru și carte funciară"),
      [tabTileKey("Conformitate")]: tabTileKey("Formalități"),
    });
    expect(Object.keys(RENAMED_TABS)).toHaveLength(3);
  });

  it("reads a choice stored under the old keys as the new tiles, in registry order", () => {
    const stored = JSON.stringify(["pages", tabTileKey("Conformitate"), tabTileKey("Instrument"), tabTileKey("Stare juridică")]);
    expect(parseStoredTiles(stored, reg)).toEqual(["pages", tabTileKey("Preț și taxe"), tabTileKey("Stare juridică"), tabTileKey("Formalități")]);
  });

  it("maps nothing for a type that does not have the new tab", () => {
    const other = documentTileRegistry({ typeKey: "ACT_ADITIONAL", tabs: ["Act adițional"], succession: false, pages: true });
    expect(other.renamed).toEqual({});
  });
});
