/**
 * Rule 18 — a document type's own fields take their rows from a packing rule,
 * not from rows anybody wrote.                                 (Slice #37.31)
 *
 * `packFieldRows` flows a panel's fields in form order into rows of its inner
 * width; a textarea, and every Certificate și referințe field, takes a row of
 * its own at the panel's whole width; the panel is the fewest units that hold
 * its widest box, never fewer than 2. This suite runs it over the six seeded
 * types exactly as the Document form does (grouped by `groupRo`, widths from
 * `templateFieldWidth`, the fees panel's own three fields as its base rows),
 * so a new or edited type is checked with no layout work — and writes out the
 * rows it gives a CVC.
 */
import fs from "node:fs";
import path from "node:path";
import {
  DOCUMENT,
  boxRem,
  packFieldRows,
  rowRem,
  templateFieldWidth,
  unitsInnerRem,
  type FieldWidth,
} from "@/lib/ui/field-widths";
import { isCertificatesGroup, isFeesGroup } from "@/lib/documents/template-groups";

type StoredField = {
  key: string;
  type: "text" | "textarea" | "date" | "number" | "select";
  groupRo?: string | null;
  groupEn?: string | null;
  width?: FieldWidth["step"] | null;
  options?: { value: string; labelRo?: string; labelEn?: string }[] | null;
};

const FORMS = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "src/db/document-type-forms.json"), "utf8"),
) as { forms: Record<string, StoredField[]> };

/** messages/ro-RO.json → document.fields.customSelectEmpty. */
const EMPTY = "— fără valoare —";
const FEES_BASE = Math.max(rowRem([DOCUMENT.institutionId]), rowRem([DOCUMENT.nrDocument, DOCUMENT.dateDocument]));

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
      return { key: f.key, width, full: !isSelect && (force || width.kind === "lines") };
    });
    const packed = packFieldRows(items, { baseRowsRem: isFeesGroup(label) ? FEES_BASE : 0 });
    return { label, items, ...packed };
  });
}

describe("the packing rule itself", () => {
  const M: FieldWidth = { step: "M", kind: "fixed" };
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
    expect(units).toBe(2); // the widest box is XL, 17rem — two units hold it
    expect(rows).toEqual([["a", "b"], ["c"], ["d"], ["e"]]);
  });

  it("is never fewer than two units, and widens to hold the widest box or base row", () => {
    expect(packFieldRows([{ key: "a", width: M }]).units).toBe(2);
    expect(packFieldRows([{ key: "a", width: { step: "XXL", kind: "select" } }]).units).toBe(3);
    expect(packFieldRows([], { baseRowsRem: 24 }).units).toBe(3);
  });
});

describe.each(Object.keys(FORMS.forms))("the seeded type %s", (key) => {
  const panels = panelsOf(FORMS.forms[key]);

  it("puts every field in exactly one row, in form order", () => {
    for (const p of panels) {
      expect([p.label, p.rows.flat()]).toEqual([p.label, p.items.map((i) => i.key)]);
    }
  });

  it("gives every panel 2 or 3 units, and no row is wider than its panel", () => {
    for (const p of panels) {
      expect([p.label, [2, 3].includes(p.units)]).toEqual([p.label, true]);
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

describe("a CVC's panels, written out", () => {
  it("packs each group of the sale contract into these rows", () => {
    const cvc = panelsOf(FORMS.forms.CONTRACT_VANZARE).map((p) => ({ label: p.label, units: p.units, rows: p.rows }));
    expect(cvc).toEqual(CVC_ROWS);
  });
});

/**
 * What the rule gives CONTRACT_VANZARE (measured by this suite, Slice #37.31).
 * Most rows hold one field: a CVC's clauses are dropdowns of three to five
 * words, L or XL wide, and two of those do not share a 2-unit panel. The fees
 * fit three numbers to a row beside Instituție's 3 units; Antet instrument is 3
 * because „Categorie internă" has a 37-character option.
 */
const CVC_ROWS: { label: string; units: number; rows: string[][] }[] = [
  { label: "Financiar", units: 2, rows: [
    ["pretTotal"],
    ["monedaPret"],
    ["starePlata"],
    ["modalitatePlata"],
    ["dataPlatii"],
    ["temeiPret"],
    ["alocarePret"],
    ["scopVanzare"],
    ["predareStapanire"],
  ] },
  { label: "Taxe și onorarii", units: 3, rows: [
    ["taxaTimbruPublicitate", "timbruJudiciar", "onorariuNotarial"],
    ["impozitTransfer"],
  ] },
  { label: "Antet instrument", units: 3, rows: [
    ["categorieInterna"],
    ["documentatieFinalizata", "calitateExemplar"],
    ["exemplareEmise"],
    ["temeiAutentificare"],
    ["dataContinut"],
  ] },
  { label: "Excepție cadastru", units: 2, rows: [
    ["temeiExceptieCadastru"],
    ["marcajCarteFunciara"],
    ["poateFiIntabulat"],
    ["renuntareCercetareOcpi"],
    ["obligatieNrCadastral"],
    ["termenFormalitati"],
    ["completareUlterioara"],
    ["consimtamantRadiere"],
  ] },
  { label: "Obiect declarat", units: 2, rows: [
    ["vecinatati"],
    ["origineLot"],
  ] },
  { label: "Stare juridică afirmată", units: 2, rows: [
    ["inCircuitCivil"],
    ["liberDeSarcini"],
    ["faraServituti"],
    ["neipotecat"],
    ["nepromisAltcuiva"],
    ["nearendat"],
    ["neaportatSocietate"],
    ["faraLitigii"],
    ["faraExpropriere"],
    ["faraMonumentIstoric"],
    ["nedezmembratContrar"],
    ["garantieEvictiune"],
    ["garantieVicii"],
    ["cumparatorCunoasteSituatia"],
  ] },
  { label: "Conformitate și formalități", units: 2, rows: [
    ["temeiLegalEvictiune"],
    ["declaratieArt292"],
    ["pretRealDeclarat"],
    ["notificareAml"],
    ["consimtamantDatePersonale"],
    ["preemptiuneTerenAgricol"],
    ["preemptiunePadure"],
    ["taxeLocaleLaZi"],
    ["taxeLocalePlatiteDe"],
    ["cheltuieliPerfectare"],
  ] },
];
