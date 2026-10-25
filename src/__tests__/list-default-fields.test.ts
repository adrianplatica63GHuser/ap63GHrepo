/**
 * „Câmpuri afișate": the Properties list starts with Tip proprietate (#38.02),
 * the other three lists with nothing ticked; each key moved once so every
 * browser sees these defaults (#37.94), the Properties key once more (#38.02).
 *
 * Slice 40.66: every list opens on four columns Claude picked („please pick the best default yourself"), and all four
 * keys moved once more so every browser sees them.
 */
import fs from "node:fs";
import path from "node:path";
import { readStored } from "@/components/list/field-chooser";
import { LIST_COLUMN_CHOICE } from "@/lib/ui/list-columns";

const VIEW = (dir: string) => fs.readFileSync(path.join(process.cwd(), "src/app", dir, "list-view.tsx"), "utf8");
const LISTS = [
  ["property", "properties"],
  ["document", "documents"],
  ["person", "natural-persons"],
  ["company", "judicial-persons"],
] as const;

describe("each list's default fields (#37.94)", () => {
  // Was (#38.02): „Tip proprietate on Properties, none on the other three".
  it("are four on three lists since 40.66, three on Acte — „Modificat la” wherever there is room", () => {
    expect(LIST_COLUMN_CHOICE.property.defaults).toEqual(["tarlaSola", "parcela", "propertyType", "locality"]);
    // Instituție was the fourth: at 1366 px it made the table scroll sideways, so it dropped (Ask first 3).
    expect(LIST_COLUMN_CHOICE.document.defaults).toEqual(["nrDocument", "dateDocument", "changed"]);
    expect(LIST_COLUMN_CHOICE.person.defaults).toEqual(["cnp", "dateOfBirth", "professionalType", "changed"]);
    expect(LIST_COLUMN_CHOICE.company.defaults).toEqual(["judicialPersonType", "cuiNumber", "locality", "changed"]);
    // No more than „Câmpuri afișate" holds.
    for (const [entry, dir] of LISTS) {
      expect([entry, /const MAX_OPT\s*=\s*4;/.test(VIEW(dir))]).toEqual([entry, true]);
      expect(LIST_COLUMN_CHOICE[entry].defaults.length).toBe(entry === "document" ? 3 : 4);
    }
  });

  // Was (#38.02): „Tarla/Solă and Parcelă are still offered, unticked" — since 40.66 they are two of the defaults.
  it.each(LISTS)("are fields %s's list offers, in the order it offers them", (entry, dir) => {
    const offered = [...VIEW(dir).matchAll(/\{ key: "(\w+)",\s+label:/g)].map((m) => m[1]);
    const defaults: readonly string[] = LIST_COLUMN_CHOICE[entry].defaults;
    for (const key of defaults) expect([key, offered.includes(key)]).toEqual([key, true]);
    expect(offered.filter((k) => defaults.includes(k))).toEqual([...defaults]);
  });

  it.each(LISTS)("are what %s's list hands its chooser, with its key", (entry, dir) => {
    const view = VIEW(dir);
    expect(view).toContain(`useFieldChooser(LIST_COLUMN_CHOICE.${entry}.storageKey, optionalCols.map((c) => c.key), MAX_OPT, LIST_COLUMN_CHOICE.${entry}.defaults)`);
    expect(view).not.toMatch(/"ga40-col-/);
    expect(view).not.toMatch(/DEFAULT_COLS/);
  });
});

describe("the keys (#37.94, #38.02)", () => {
  it("each moved once more in 40.66, so every browser starts on the new defaults", () => {
    expect(LIST_COLUMN_CHOICE.property.storageKey).toBe("ga40-col-property-v5");
    expect(LIST_COLUMN_CHOICE.document.storageKey).toBe("ga40-col-document-v4");
    expect(LIST_COLUMN_CHOICE.person.storageKey).toBe("ga40-col-person-v4");
    expect(LIST_COLUMN_CHOICE.company.storageKey).toBe("ga40-col-company-v3");
  });

  beforeEach(() => localStorage.clear());

  it("a browser with nothing stored under the new key gets the defaults — whatever the old keys held", () => {
    localStorage.setItem("ga40-col-property-v2", JSON.stringify(["cadastralNumber", "surfaceAreaMp", "locality"]));
    localStorage.setItem("ga40-col-property-v3", JSON.stringify(["tarlaSola", "parcela"]));
    localStorage.setItem("ga40-col-property-v4", JSON.stringify(["propertyType"]));
    localStorage.setItem("ga40-col-person-v3", JSON.stringify([]));
    const { storageKey, defaults } = LIST_COLUMN_CHOICE.property;
    expect(readStored(storageKey, ["tarlaSola", "parcela", "propertyType", "locality"], defaults)).toEqual(["tarlaSola", "parcela", "propertyType", "locality"]);
    const person = LIST_COLUMN_CHOICE.person;
    expect(readStored(person.storageKey, ["cnp", "dateOfBirth", "professionalType", "changed"], person.defaults)).toEqual(["cnp", "dateOfBirth", "professionalType", "changed"]);
  });

  it("a choice stored under the new key is read back unchanged — an empty one too", () => {
    const { storageKey, defaults } = LIST_COLUMN_CHOICE.property;
    localStorage.setItem(storageKey, JSON.stringify(["locality", "parcela"]));
    expect(readStored(storageKey, ["tarlaSola", "parcela", "propertyType", "locality"], defaults)).toEqual(["locality", "parcela"]);
    localStorage.setItem(storageKey, JSON.stringify(["tarlaSola", "parcela"]));
    expect(readStored(storageKey, ["tarlaSola", "parcela", "propertyType", "locality"], defaults)).toEqual(["tarlaSola", "parcela"]);
    localStorage.setItem(storageKey, JSON.stringify([]));
    expect(readStored(storageKey, ["tarlaSola", "parcela", "propertyType", "locality"], defaults)).toEqual([]);
    const doc = LIST_COLUMN_CHOICE.document;
    localStorage.setItem(doc.storageKey, JSON.stringify(["subject"]));
    expect(readStored(doc.storageKey, ["nrDocument", "subject"], doc.defaults)).toEqual(["subject"]);
  });
});
