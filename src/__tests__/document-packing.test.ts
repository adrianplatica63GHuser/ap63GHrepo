/**
 * Rule 18 — a document type's own fields take their rows from a packing rule,
 * not from rows anybody wrote.                                 (Slice #37.31)
 *
 * `packFieldRows` flows a panel's fields in form order into rows of its inner
 * width; a textarea, and every Certificate și referințe field, takes a row of
 * its own at the panel's whole width; the panel is the fewest units that hold
 * its widest box, never fewer than 3 (40.98; 2 until then). This suite runs it over the six seeded
 * types exactly as the Document form does (grouped by `groupRo`, widths from
 * `templateFieldWidth`, the fees panel's own three fields as its base rows),
 * so a new or edited type is checked with no layout work — and writes out the
 * rows it gives a CVC.
 */
import fs from "node:fs";
import path from "node:path";
import {
  SCALE,
  boxRem,
  packFieldRows,
  rowRem,
  selectNeedPx,
  templateFieldTakesRow,
  templateFieldWidth,
  unitsInnerRem,
  type FieldWidth,
} from "@/lib/ui/field-widths";
import { isCertificatesGroup, isFeesGroup, isIdentificationGroup } from "@/lib/documents/template-groups";

type StoredField = {
  key: string;
  type: "text" | "textarea" | "date" | "number" | "select";
  groupRo?: string | null;
  groupEn?: string | null;
  width?: FieldWidth["step"] | null;
  newRow?: boolean;
  options?: { value: string; labelRo?: string; labelEn?: string }[] | null;
};

const FORMS = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "src/db/document-type-forms.json"), "utf8"),
) as { forms: Record<string, StoredField[]> };

/** messages/ro-RO.json → document.fields.customSelectEmpty. */
const EMPTY = "fără valoare";
// Slice #38.32: the fees panel and the identification fields are packed to 3 units — the
// width the fees panel had while Instituție and Nr. | Data topped it, and the width of
// „Identificarea actului", where those three are now.
const FEES_BASE = unitsInnerRem(3);
const IDENTIFICATION_BASE = unitsInnerRem(3);

function widthOf(f: StoredField, force: boolean): FieldWidth {
  if (f.type === "select" && f.options && f.options.length > 0) {
    return templateFieldWidth(f, [EMPTY, ...f.options.map((o) => o.labelRo || o.labelEn || o.value)]);
  }
  return templateFieldWidth({ type: f.type === "select" ? "text" : f.type, width: f.width ?? null }, [], force);
}

/** Every group of a type, packed as the form packs it. */
function panelsOf(fields: StoredField[]) {
  const groups = new Map<string, StoredField[]>();
  for (const f of fields) {
    const label = f.groupRo || f.groupEn || "";
    groups.set(label, [...(groups.get(label) ?? []), f]);
  }
  return [...groups].map(([label, group]) => {
    const force = isCertificatesGroup(label);
    const items = group.map((f) => {
      const width = widthOf(f, force);
      const isSelect = f.type === "select" && !!f.options && f.options.length > 0;
      return { key: f.key, width, full: templateFieldTakesRow(width, { isSelect, forceLines: force }), newRow: f.newRow === true };
    });
    const packed = packFieldRows(items, { baseRowsRem: isFeesGroup(label) ? FEES_BASE : isIdentificationGroup(label) ? IDENTIFICATION_BASE : 0 });
    return { label, items, ...packed };
  });
}

describe("a row started on purpose (40.89, `newRow`)", () => {
  const M: FieldWidth = { step: "M", kind: "input" };
  it("ends the row before the field, whatever room it had, and keeps form order", () => {
    expect(packFieldRows([{ key: "a", width: M }, { key: "b", width: M, newRow: true }, { key: "c", width: M }]).rows).toEqual([["a"], ["b", "c"]]);
    // A field that starts a row as the first of its panel, or after a full one, changes nothing.
    expect(packFieldRows([{ key: "a", width: M, newRow: true }, { key: "b", width: M }]).rows).toEqual([["a", "b"]]);
  });
});

describe("the packing rule itself", () => {
  const M: FieldWidth = { step: "M", kind: "input" };
  const XL: FieldWidth = { step: "XL", kind: "grows" };
  const TA: FieldWidth = { step: "TILE", kind: "lines", rows: 1 };

  it("flows boxes in order into rows of the panel's inner width; a full field takes a row of its own", () => {
    const { units, rows } = packFieldRows([
      { key: "a", width: M },
      { key: "b", width: M },
      { key: "c", width: XL },
      { key: "d", width: TA, full: true },
      { key: "e", width: M },
    ]);
    expect(units).toBe(3); // the widest box is XL, 17rem — two units would hold it; 40.98: a gray panel is 3 at least
    expect(rows).toEqual([["a", "b"], ["c"], ["d"], ["e"]]);
  });

  // 40.98 (Adrian: „Each panel needs to fit 363 px inside"): three units at least, 22.6875rem inside; it was two.
  it("is never fewer than three units, and widens to hold the widest box or base row", () => {
    expect(packFieldRows([{ key: "a", width: M }]).units).toBe(3);
    expect(unitsInnerRem(3) * 16).toBe(363);
    expect(packFieldRows([{ key: "a", width: { step: "XXL", kind: "select" } }]).units).toBe(4); // 24rem, past 363 px
    expect(packFieldRows([], { baseRowsRem: 22 }).units).toBe(3);
    expect(packFieldRows([], { baseRowsRem: 24 }).units).toBe(4);
  });
});

describe.each(Object.keys(FORMS.forms))("the seeded type %s", (key) => {
  const panels = panelsOf(FORMS.forms[key]);

  it("puts every field in exactly one row, in form order", () => {
    for (const p of panels) {
      expect([p.label, p.rows.flat()]).toEqual([p.label, p.items.map((i) => i.key)]);
    }
  });

  // 40.98: every seeded panel is 3 units — the floor holds each; a panel past it would be listed in the handover.
  it("gives every panel 3 units, and no row is wider than its panel", () => {
    for (const p of panels) {
      expect([p.label, p.units]).toEqual([p.label, 3]);
      const byKey = new Map(p.items.map((i) => [i.key, i] as const));
      for (const row of p.rows) {
        const sized = row.map((k) => byKey.get(k)!).filter((i) => !i.full);
        expect([p.label, row.join("|"), rowRem(sized.map((i) => i.width)) <= unitsInnerRem(p.units)]).toEqual([p.label, row.join("|"), true]);
        if (row.some((k) => byKey.get(k)!.full)) expect([p.label, row.length]).toEqual([p.label, 1]);
      }
      for (const i of p.items) if (!i.full) expect(boxRem(i.width)).toBeLessThanOrEqual(unitsInnerRem(p.units));
    }
  });
});

describe("an Act Adițional's panels at Adrian's sizes (40.88)", () => {
  it("packs „Identificarea actului” and „Ce modifică” into these rows", () => {
    const act = panelsOf(FORMS.forms.ACT_ADITIONAL)
      .filter((p) => ["Identificarea actului", "Motiv și efect", "Clauze completate"].includes(p.label))
      .map((p) => ({ label: p.label, units: p.units, rows: p.rows }));
    expect(act).toEqual([
      // Calitate exemplar | Onorariu notarial, then Exemplare emise across the tile (the swap, and TILE).
      { label: "Identificarea actului", units: 3, rows: [["calitateExemplar", "onorariuNotarial"], ["exemplareEmise"]] },
      // Motiv completare (a textarea) and Temei legal completare (TILE) each the panel's width; the two dropdowns at M
      // share a row. 40.98: 3 units, the floor (was 2).
      { label: "Motiv și efect", units: 3, rows: [["motivCompletare"], ["temeiLegalCompletare"], ["efectUrmarit", "pretNeschimbat"]] },
      // The nine clauses at M (136 px), two to a row since 40.98 — three and their gaps are 440 px, past 363 (Ask
      // first 6: a row the packing made breaks where it no longer fits). Was three to a row in 3 units of 148.
      { label: "Clauze completate", units: 3, rows: [
        ["liberDeSarcini", "faraServituti"],
        ["nearendat", "notificareAml"],
        ["consimtamantRadiere", "taxeLocaleLaZi"],
        ["nedezmembratContrar", "consimtamantDatePersonale"],
        ["celelalteClauzeNemodificate"],
      ] },
    ]);
  });

  it("draws each marked field at its step", () => {
    const byKey = new Map(panelsOf(FORMS.forms.ACT_ADITIONAL).flatMap((p) => p.items).map((i) => [i.key, i.width] as const));
    for (const k of ["calitateExemplar", "efectUrmarit", "pretNeschimbat", "liberDeSarcini", "celelalteClauzeNemodificate"]) {
      expect([k, boxRem(byKey.get(k)!)]).toEqual([k, SCALE.M]);
    }
    for (const k of ["exemplareEmise", "temeiLegalCompletare"]) expect([k, byKey.get(k)!.step, byKey.get(k)!.fill]).toEqual([k, "TILE", true]);
  });
});

describe("a CVC's panels, written out", () => {
  it("packs each group of the sale contract into these rows", () => {
    const cvc = panelsOf(FORMS.forms.CONTRACT_VANZARE).map((p) => ({ label: p.label, units: p.units, rows: p.rows }));
    expect(cvc).toEqual(CVC_ROWS);
  });
});

/**
 * What the rule gives CONTRACT_VANZARE (measured by this suite, Slice #37.31;
 * re-measured in #37.53 and #37.55). Since #37.53 a dropdown is as wide as its
 * widest choice, and a panel of dropdowns takes a third unit when that pairs
 * them. Since #37.55 the blank reads „fără valoare" (120 px, no longer the
 * widest), so a clause offering „Da / Nu / Nu e menționat" is 9rem. 40.98: on the
 * 119-px unit every panel is 3 units, 363 px inside — the floor (Ask first 6);
 * the rows are as they were, only the units of the 2-unit panels changed. The fees fit three numbers to a row beside
 * Instituție's 3 units, „Taxă timbru și publicitate" last and alone (#37.54);
 * Dosar și exemplar (#37.54, it was Antet instrument) is 3 because „Categorie
 * internă" has a 37-character option (18rem).
 */
const CVC_ROWS: { label: string; units: number; rows: string[][] }[] = [
  // #38.33: the CVC's groups after its six tiles (Adrian.Request.txt), in form order.
  // 40.88 (migration_120): Calitate exemplar M; Exemplare emise TILE — the panel's width, on a row of its own.
  // 40.93 (migration_122): Temei autentificare TILE, so Data conținutului starts the next row by itself.
  { label: "Identificarea actului", units: 3, rows: [
    ["calitateExemplar"],
    ["exemplareEmise"],
    ["temeiAutentificare"],
    ["dataContinut"],
  ] },
  // 40.89 (migration_121): Preț total S | Monedă S | Preț declarat real M — 19.5rem, so the panel takes 3 units (Ask
  // first 5), and the two text boxes at XL below, one a row.
  { label: "Preț", units: 3, rows: [
    ["pretTotal", "monedaPret", "pretRealDeclarat"],
    ["temeiPret"],
    ["alocarePret"],
  ] },
  // 40.93 (migration_122): Stare plată L | Data plății M, then Modalitate plată L under Stare plată (`newRow`).
  // 22.25rem with the gap — still 3 units.
  { label: "Plată", units: 3, rows: [
    ["starePlata", "dataPlatii"],
    ["modalitatePlata"],
  ] },
  // Slice #38.49 (migration_102): „Descrierea obiectului" first in „Obiectul vânzării", a panel of its own.
  { label: "Descriere", units: 3, rows: [
    ["descriereObiect"],
  ] },
  { label: "Scop și predare", units: 3, rows: [
    ["scopVanzare", "predareStapanire"],
  ] },
  { label: "Obiect declarat", units: 3, rows: [
    ["vecinatati"],
    ["origineLot"],
  ] },
  // 40.93 (migration_122): Documentație finalizată back to its widest choice (184 px), under Categorie internă
  // (`newRow`) — 2 units held XL (was 3, the pair, 40.89); 3, the floor, since 40.98.
  { label: "Dosar cadastral", units: 3, rows: [
    ["categorieInterna"],
    ["documentatieFinalizata"],
  ] },
  // 40.89: Marcaj carte funciară (L) alone; Consimțământ radiere starts the next row (`newRow`), Intabulare posibilă beside it.
  { label: "Situația în cartea funciară", units: 3, rows: [
    ["marcajCarteFunciara"],
    ["consimtamantRadiere", "poateFiIntabulat"],
  ] },
  // 40.89: the three text boxes at TILE, each on a row of its own; the two dropdowns alone on the row between them (Ask first 4).
  { label: "Excepția de la cadastru", units: 3, rows: [
    ["temeiExceptieCadastru"],
    ["renuntareCercetareOcpi", "obligatieNrCadastral"],
    ["termenFormalitati"],
    ["completareUlterioara"],
  ] },
  // 40.93 (migration_122): rows of two, by `newRow` on the 3rd, 5th, … — 2 units (was 3, three to a row); 3, the floor, since 40.98.
  { label: "Declarațiile vânzătorului", units: 3, rows: [
    ["inCircuitCivil", "liberDeSarcini"],
    ["faraServituti", "neipotecat"],
    ["nepromisAltcuiva", "nearendat"],
    ["neaportatSocietate", "faraLitigii"],
    ["faraExpropriere", "faraMonumentIstoric"],
    ["nedezmembratContrar", "cumparatorCunoasteSituatia"],
  ] },
  // 40.93: Garanție vicii ascunse takes Temei legal evicțiune's place; the Temei under them at TILE — 2 units (was 3); 3 since 40.98.
  { label: "Garanții", units: 3, rows: [
    ["garantieEvictiune", "garantieVicii"],
    ["temeiLegalEvictiune"],
  ] },
  { label: "Declarații legale", units: 3, rows: [
    ["declaratieArt292", "notificareAml"],
    ["consimtamantDatePersonale", "preemptiuneTerenAgricol"],
    ["preemptiunePadure"],
  ] },
  // 40.93: the four sums at M, two to a row, Onorariu notarial | Impozit transfer first; 3 units, the fees panel's base.
  { label: "Taxe și onorarii", units: 3, rows: [
    ["onorariuNotarial", "impozitTransfer"],
    ["timbruJudiciar", "taxaTimbruPublicitate"],
  ] },
  // 40.93: Cheltuieli perfectare | Plătitor taxe locale, then Taxe locale la zi (`newRow`) — 2 units (was 3); 3 since 40.98.
  { label: "Cheltuieli", units: 3, rows: [
    ["cheltuieliPerfectare", "taxeLocalePlatiteDe"],
    ["taxeLocaleLaZi"],
  ] },
];

// 40.98: the 119-px unit ends three dropdowns to a row. A 3-unit panel is 363 px inside, and three 9rem dropdowns with
// their gaps are 448 — so the rule that gave a panel of dropdowns its third unit (#37.53) is gone with the 2-unit
// panel it widened: every gray panel is 3 units at least, and two dropdowns pair there by the floor alone. Was
// „dropdowns three to a row (#37.53, #37.55)": three to a row in 3 units of 148 px, 28.125rem inside.
describe("dropdowns on the 119-px unit (40.98; three to a row until then, #37.53, #37.55)", () => {
  it("on „Da / Nu / Nu e menționat” plus the blank choice, the widest is „Nu e menționat”, and the dropdown is 9rem", () => {
    const labels = [EMPTY, "Da", "Nu", "Nu e menționat"];
    const widest = labels.reduce((a, b) => (selectNeedPx([b]) > selectNeedPx([a]) ? b : a));
    expect(widest).toBe("Nu e menționat");
    const d = templateFieldWidth({ type: "select" }, labels);
    expect(boxRem(d)).toBe(9);
    // Two of them and the gap fit a 3-unit panel; three do not (they did in 3 units of 148 px).
    expect(rowRem([d, d])).toBeLessThanOrEqual(unitsInnerRem(3));
    expect(rowRem([d, d, d])).toBeGreaterThan(unitsInnerRem(3));
  });

  it("no seeded panel holds three dropdowns to a row", () => {
    const threes: string[] = [];
    for (const [type, fields] of Object.entries(FORMS.forms)) {
      for (const p of panelsOf(fields)) {
        const kind = new Map(p.items.map((i) => [i.key, i.width.kind] as const));
        if (p.rows.some((r) => r.length === 3 && r.every((k) => kind.get(k) === "select"))) threes.push(`${type} · ${p.label}`);
      }
    }
    // Was ["ACT_ADITIONAL · Clauze completate"] — its nine clauses are two to a row since 40.98.
    expect(threes).toEqual([]);
  });

  it("pairs two dropdowns in the floor's 3 units, with no rule of their own", () => {
    const M = { step: "M", kind: "input" } as const;
    const D = { step: "L", kind: "select", rem: 10 } as const;
    // Two dropdowns: 21rem with the gap, in 3 units (22.6875 inside).
    expect(packFieldRows([{ key: "a", width: D }, { key: "b", width: D }])).toEqual({ units: 3, rows: [["a", "b"]] });
    // One dropdown and two M boxes: three units, the M pair first, the dropdown on the next row.
    expect(packFieldRows([{ key: "a", width: M }, { key: "b", width: M }, { key: "c", width: D }])).toEqual({ units: 3, rows: [["a", "b"], ["c"]] });
  });
});
