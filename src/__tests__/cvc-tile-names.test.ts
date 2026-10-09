/**
 * The CVC's tiles and panels named so each reads as one name, the fees' order,
 * and a remembered tile choice that survives the rename.        (Slice #37.54)
 *
 * Slice #38.33 rebuilt the tiles: five type tiles where there were four, each
 * field beside the fields it belongs with (Adrian.Request.txt, „Big #1"), and
 * „Identificarea actului" first (#38.32). The assertions below are #37.54's,
 * rewritten in place for the new names; an old tile key now stands for one or
 * more new tiles.
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
const IDENTIFICATION = "Identificarea actului";

function layout(fields: readonly Field[]) {
  const out: { tab: string; tabEn: string; panels: [string, string][] }[] = [];
  // #38.32: the identification group has no tab — it is drawn in „Identificarea actului".
  for (const f of [...fields].filter((x) => x.groupRo !== IDENTIFICATION).sort((a, b) => a.order - b.order)) {
    let tile = out.find((t) => t.tab === f.tabRo);
    if (!tile) out.push((tile = { tab: f.tabRo ?? "", tabEn: f.tabEn ?? "", panels: [] }));
    if (!tile.panels.some(([ro]) => ro === f.groupRo)) tile.panels.push([f.groupRo ?? "", f.groupEn ?? ""]);
  }
  return out;
}

describe("the CVC's tiles and panels (#37.54, rebuilt by #38.33)", () => {
  it("are named as the request names them, in Romanian and English", () => {
    expect(layout(CVC)).toEqual([
      { tab: "Preț și plată", tabEn: "Price and payment", panels: [["Preț", "Price"], ["Plată", "Payment"]] },
      // Slice #38.49 (migration_102): „Descriere" first — #38.33 had „Scop și predare" and „Obiect declarat" alone.
      { tab: "Obiectul vânzării", tabEn: "What is sold", panels: [["Descriere", "Description"], ["Scop și predare", "Purpose and possession"], ["Obiect declarat", "Declared object"]] },
      {
        tab: "Carte funciară",
        tabEn: "Land book",
        panels: [["Dosar cadastral", "Cadastral file"], ["Situația în cartea funciară", "Land-book status"], ["Excepția de la cadastru", "Cadastre exemption"]],
      },
      {
        tab: "Declarații și garanții",
        tabEn: "Representations and warranties",
        panels: [["Declarațiile vânzătorului", "Seller's representations"], ["Garanții", "Warranties"], ["Declarații legale", "Statutory declarations"]],
      },
      { tab: "Taxe și cheltuieli", tabEn: "Fees and costs", panels: [["Taxe și onorarii", "Fees"], ["Cheltuieli", "Costs"]] },
    ]);
  });

  // Slice #38.49 (migration_102): 54 fields — #38.33 had „places every one of the 53 fields".
  it("places every one of the 54 fields exactly once, each where the request puts it", () => {
    const where = new Map(CVC.map((f) => [f.key, f.tabRo ?? IDENTIFICATION]));
    expect(CVC).toHaveLength(54);
    expect(new Set(CVC.map((f) => f.key)).size).toBe(54);
    const PLACE: Record<string, string[]> = {
      [IDENTIFICATION]: ["calitateExemplar", "exemplareEmise", "temeiAutentificare", "dataContinut"],
      "Preț și plată": ["pretTotal", "monedaPret", "starePlata", "modalitatePlata", "dataPlatii", "temeiPret", "alocarePret", "pretRealDeclarat"],
      "Obiectul vânzării": ["descriereObiect", "scopVanzare", "predareStapanire", "vecinatati", "origineLot"],
      "Carte funciară": [
        "temeiExceptieCadastru", "marcajCarteFunciara", "poateFiIntabulat", "renuntareCercetareOcpi", "obligatieNrCadastral",
        "termenFormalitati", "completareUlterioara", "consimtamantRadiere", "categorieInterna", "documentatieFinalizata",
      ],
      "Declarații și garanții": [
        "inCircuitCivil", "liberDeSarcini", "faraServituti", "neipotecat", "nepromisAltcuiva", "nearendat", "neaportatSocietate",
        "faraLitigii", "faraExpropriere", "faraMonumentIstoric", "nedezmembratContrar", "garantieEvictiune", "garantieVicii",
        "cumparatorCunoasteSituatia", "temeiLegalEvictiune", "declaratieArt292", "notificareAml", "consimtamantDatePersonale",
        "preemptiuneTerenAgricol", "preemptiunePadure",
      ],
      "Taxe și cheltuieli": [
        "timbruJudiciar", "onorariuNotarial", "impozitTransfer", "taxaTimbruPublicitate", "cheltuieliPerfectare", "taxeLocalePlatiteDe", "taxeLocaleLaZi",
      ],
    };
    const placed = Object.values(PLACE).flat();
    expect(placed).toHaveLength(54);
    expect(new Set(placed).size).toBe(54);
    for (const [tile, keys] of Object.entries(PLACE)) for (const k of keys) expect([k, where.get(k)]).toEqual([k, tile]);
  });

  it("puts „Temei legal evicțiune” right after „Garanție evicțiune”", () => {
    const keys = [...CVC].sort((a, b) => a.order - b.order).map((f) => f.key);
    expect(keys.indexOf("temeiLegalEvictiune")).toBe(keys.indexOf("garantieEvictiune") + 1);
  });

  it("keeps none of the old names", () => {
    const names = new Set(CVC.flatMap((f) => [f.tabRo, f.groupRo]));
    for (const old of [
      "Instrument", "Cadastru", "Cadastru și carte funciară", "Conformitate", "Antet instrument", "Stare juridică afirmată", "Conformitate și formalități",
      // #38.33
      "Preț și taxe", "Cadastru și CF", "Stare juridică", "Formalități", "Financiar", "Dosar și exemplar", "Excepție cadastru", "Declarații și obligații legale",
    ]) {
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

describe("a remembered tile choice survives the rename (#37.54, #38.33)", () => {
  const TABS = ["Preț și plată", "Obiectul vânzării", "Carte funciară", "Declarații și garanții", "Taxe și cheltuieli"];
  const reg = documentTileRegistry({ typeKey: "CONTRACT_VANZARE", tabs: TABS, succession: false, pages: true, parties: true });
  const k = tabTileKey;

  it("maps each old tab key to its new tile or tiles, for the tabs the type has", () => {
    expect(reg.renamed).toEqual({
      [k("Instrument")]: [k("Preț și plată"), k("Taxe și cheltuieli")],
      [k("Preț și taxe")]: [k("Preț și plată"), k("Taxe și cheltuieli")],
      [k("Cadastru")]: [k("Carte funciară"), k("Obiectul vânzării")],
      [k("Cadastru și carte funciară")]: [k("Carte funciară"), k("Obiectul vânzării")],
      [k("Cadastru și CF")]: [k("Carte funciară"), k("Obiectul vânzării")],
      [k("Stare juridică")]: k("Declarații și garanții"),
      [k("Conformitate")]: [k("Declarații și garanții"), k("Taxe și cheltuieli")],
      [k("Formalități")]: [k("Declarații și garanții"), k("Taxe și cheltuieli")],
      metadata: ["classification", "connections"], // #37.63
      persons: "related", properties: "related", associations: "related", // #37.65: „Corelate"
    });
    expect(Object.keys(RENAMED_TABS)).toHaveLength(10); // #38.34: and the act adițional's two
  });

  it("reads a browser that showed „Preț și taxe” as showing „Preț și plată” and „Taxe și cheltuieli”, in registry order", () => {
    const stored = JSON.stringify(["pages", k("Formalități"), k("Preț și taxe"), k("Stare juridică")]);
    expect(parseStoredTiles(stored, reg)).toEqual([k("Preț și plată"), k("Declarații și garanții"), k("Taxe și cheltuieli"), "pages"]);
  });

  it("offers „Părți” after the type tiles, ticked by default", () => {
    expect(reg.all.slice(0, 7)).toEqual(["general", ...TABS.map(k), "parties"]);
    expect(reg.defaults).toEqual(["general", "pages", k("Preț și plată"), "parties"]);
  });

  it("maps nothing for a type that does not have the new tabs", () => {
    const other = documentTileRegistry({ typeKey: "ACT_ADITIONAL", tabs: ["Act adițional"], succession: false, pages: true });
    // #37.63: META INFO's two halves, and #37.65: „Corelate" for the three lists — on every type.
    expect(other.renamed).toEqual({ metadata: ["classification", "connections"], persons: "related", properties: "related", associations: "related" });
  });
});
