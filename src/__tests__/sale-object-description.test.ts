/**
 * Slice #38.49 — „Obiectul vânzării" says what is being sold: the composer.
 * One property, several, a share, no scope, every source blank.
 */
import { composeSaleObjectDescription, formatMp, formatShare, soldShare } from "@/lib/documents/sale-object-description";

const LAND = {
  propertyType: "Teren Arabil",
  useCategory: "Arabil",
  surfaceAreaMp: "5000.00",
  calculatedAreaMp: "4987.12",
  tarla: "12",
  parcela: "34",
  cadastralNumber: "12345",
  carteFunciara: "6789",
  locality: "Ciorogârla",
};
const SELLER = (cotaParte: number | null) => ({ roleName: "Vânzător", holdsShare: true, cotaParte });
const BUYER = (cotaParte: number | null) => ({ roleName: "Cumpărător", holdsShare: true, cotaParte });

describe("one property", () => {
  it("every source: the kind, the area, T / P, the cadastral and CF numbers, the locality", () => {
    expect(composeSaleObjectDescription({ properties: [LAND] })).toBe(
      "Teren arabil, 5.000 mp, T 12 / P 34, nr. cad. 12345, CF 6789, loc. Ciorogârla",
    );
  });

  it("a share and a comasare: after a dash", () => {
    expect(composeSaleObjectDescription({ properties: [LAND], parties: [SELLER(50), BUYER(100)], scopVanzare: "COMASARE" })).toBe(
      "Teren arabil, 5.000 mp, T 12 / P 34, nr. cad. 12345, CF 6789, loc. Ciorogârla — cotă 1/2, pentru comasare",
    );
  });

  it("the calculated area when there is no official one; a use category the type does not say is added", () => {
    const built = { propertyType: "Teren Construit", useCategory: "Arabil", calculatedAreaMp: 5780.48, locality: "Bolintin Vale" };
    expect(composeSaleObjectDescription({ properties: [built] })).toBe("Teren construit (categoria arabil), 5.780,48 mp, loc. Bolintin Vale");
  });

  it("blank sources are left out, never written as „necunoscut”", () => {
    expect(composeSaleObjectDescription({ properties: [{ propertyType: "Casă", parcela: "7" }] })).toBe("Casă, P 7");
    const text = composeSaleObjectDescription({ properties: [{ propertyType: " ", tarla: "", cadastralNumber: null, surfaceAreaMp: "0" }] });
    expect(text).toBe("");
    expect(text).not.toMatch(/necunoscut/i);
  });
});

describe("several properties", () => {
  it("summed up — how many, the total area, where — not listed", () => {
    const three = [LAND, { ...LAND, surfaceAreaMp: 4400, cadastralNumber: "2" }, { ...LAND, surfaceAreaMp: 3000, locality: "Domnești" }];
    expect(composeSaleObjectDescription({ properties: three })).toBe("3 terenuri, 12.400 mp în total, loc. Ciorogârla, Domnești");
  });

  it("mixed kinds are „imobile”; an area missing on one says „cel puțin”", () => {
    const mixed = [LAND, { propertyType: "Casă", locality: "Ciorogârla" }];
    expect(composeSaleObjectDescription({ properties: mixed })).toBe("2 imobile, cel puțin 5.000 mp, loc. Ciorogârla");
  });
});

describe("the share and the scope", () => {
  it("the sellers' shares, summed; the whole, or a share not stated for every seller, says nothing", () => {
    expect(soldShare([SELLER(25), SELLER(25)])).toBe(50);
    expect(soldShare([SELLER(100)])).toBeNull();
    expect(soldShare([SELLER(50), SELLER(null)])).toBeNull();
    expect(soldShare([BUYER(50)])).toBeNull();
    expect(soldShare([{ roleName: "Vânzătoare", holdsShare: true, cotaParte: 33.3333 }])).toBe(33.3333);
  });

  it("a share as a person writes it: a small fraction, otherwise a percentage", () => {
    expect(formatShare(50)).toBe("1/2");
    expect(formatShare(33.3333)).toBe("1/3");
    expect(formatShare(66.6667)).toBe("2/3");
    expect(formatShare(12.5)).toBe("1/8");
    expect(formatShare(63.64)).toBe("63,64%");
  });

  it("no scope, an ordinary sale or „Alt scop” add nothing", () => {
    for (const scopVanzare of [null, undefined, "OBISNUITA", "ALTUL"]) {
      expect(composeSaleObjectDescription({ properties: [LAND], scopVanzare })).not.toContain("—");
    }
  });

  it("with no property, the share and the scope alone, capitalised", () => {
    expect(composeSaleObjectDescription({ properties: [], parties: [SELLER(50)], scopVanzare: "COMASARE" })).toBe("Cotă 1/2, pentru comasare");
    expect(composeSaleObjectDescription({ properties: [] })).toBe("");
  });

  it("areas in Romanian: a dot for thousands, a comma for decimals", () => {
    expect(formatMp(12400)).toBe("12.400 mp");
    expect(formatMp(1234.5)).toBe("1.234,5 mp");
    expect(formatMp(850)).toBe("850 mp");
  });
});

describe("the screen and the route (#38.49)", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("node:fs") as typeof import("node:fs");
  const read = (p: string) => fs.readFileSync(`${process.cwd()}/${p}`, "utf8");
  const ro = JSON.parse(read("messages/ro-RO.json"));
  const en = JSON.parse(read("messages/en-GB.json"));

  it("„Recompune” is a change to save; the empty field filled on opening is not", () => {
    const form = read("src/app/documents/_components/document-form.tsx");
    expect(form).toContain('{ shouldDirty: how === "recompose" }');
    expect(form).toMatch(/if \(f\.key === SALE_OBJECT_FIELD_KEY && documentId\)[\s\S]*?<SaleObjectRecompose[\s\S]*?editable=\{effectiveMode === "edit"\}/);
    const button = read("src/components/documents/sale-object-recompose.tsx");
    expect(button).toContain('onText(text, "recompose")');
    expect(button).toContain('onText(text, "auto")');
    // The screen's „Scop vânzare" is sent, saved or not.
    expect(button).toContain('url.searchParams.set("scop", scop ?? "")');
  });

  it("the route composes read-only from the contract's properties, parties and scope", () => {
    const route = read("src/app/api/documents/[id]/sale-object/route.ts");
    expect(route).toContain("export async function GET(");
    expect(route).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    const q = read("src/lib/documents/sale-object-queries.ts");
    expect(q).toContain("listDocumentPersons(documentId)");
    for (const join of ["lookupPropertyType", "lookupUseCategory", "lookupTarla", "propertyAddress"]) expect(q).toContain(`.leftJoin(${join},`);
  });

  it("the words, in both languages", () => {
    expect(ro.document.saleObject).toEqual({
      recompose: "Recompune",
      recomposing: "Se recompune…",
      nothing: "Nu există încă date din care să se compună descrierea: legați proprietățile și părțile.",
      failed: "Descrierea nu a putut fi compusă. Încercați din nou.",
    });
    expect(Object.keys(en.document.saleObject).sort()).toEqual(Object.keys(ro.document.saleObject).sort());
  });
});
