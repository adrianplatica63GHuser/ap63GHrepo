/**
 * „Câmpuri afișate": the Properties list starts with Tarla/Solă and Parcelă,
 * the other three lists with nothing ticked; each key moved once so every
 * browser sees these defaults.                                  (Slice #37.94)
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
  it("are Tarla/Solă and Parcelă on Properties, none on the other three", () => {
    expect(LIST_COLUMN_CHOICE.property.defaults).toEqual(["tarlaSola", "parcela"]);
    expect(LIST_COLUMN_CHOICE.document.defaults).toEqual([]);
    expect(LIST_COLUMN_CHOICE.person.defaults).toEqual([]);
    expect(LIST_COLUMN_CHOICE.company.defaults).toEqual([]);
  });

  it("are fields the list offers", () => {
    const offered = [...VIEW("properties").matchAll(/\{ key: "(\w+)",\s+label:/g)].map((m) => m[1]);
    for (const key of LIST_COLUMN_CHOICE.property.defaults) expect([key, offered.includes(key)]).toEqual([key, true]);
  });

  it.each(LISTS)("are what %s's list hands its chooser, with its key", (entry, dir) => {
    const view = VIEW(dir);
    expect(view).toContain(`useFieldChooser(LIST_COLUMN_CHOICE.${entry}.storageKey, optionalCols.map((c) => c.key), MAX_OPT, LIST_COLUMN_CHOICE.${entry}.defaults)`);
    expect(view).not.toMatch(/"ga40-col-/);
    expect(view).not.toMatch(/DEFAULT_COLS/);
  });
});

describe("the keys (#37.94)", () => {
  it("each moved once to its next version, so every browser starts on the defaults", () => {
    expect(LIST_COLUMN_CHOICE.property.storageKey).toBe("ga40-col-property-v3");
    expect(LIST_COLUMN_CHOICE.document.storageKey).toBe("ga40-col-document-v3");
    expect(LIST_COLUMN_CHOICE.person.storageKey).toBe("ga40-col-person-v3");
    expect(LIST_COLUMN_CHOICE.company.storageKey).toBe("ga40-col-company-v2");
  });

  beforeEach(() => localStorage.clear());

  it("a browser with nothing stored under the new key gets the defaults — whatever the old key held", () => {
    localStorage.setItem("ga40-col-property-v2", JSON.stringify(["cadastralNumber", "surfaceAreaMp", "locality"]));
    const { storageKey, defaults } = LIST_COLUMN_CHOICE.property;
    expect(readStored(storageKey, ["tarlaSola", "parcela", "locality"], defaults)).toEqual(["tarlaSola", "parcela"]);
  });

  it("a choice stored under the new key is read back unchanged — an empty one too", () => {
    const { storageKey, defaults } = LIST_COLUMN_CHOICE.property;
    localStorage.setItem(storageKey, JSON.stringify(["locality", "parcela"]));
    expect(readStored(storageKey, ["tarlaSola", "parcela", "locality"], defaults)).toEqual(["locality", "parcela"]);
    localStorage.setItem(storageKey, JSON.stringify([]));
    expect(readStored(storageKey, ["tarlaSola", "parcela", "locality"], defaults)).toEqual([]);
    const doc = LIST_COLUMN_CHOICE.document;
    localStorage.setItem(doc.storageKey, JSON.stringify(["subject"]));
    expect(readStored(doc.storageKey, ["nrDocument", "subject"], doc.defaults)).toEqual(["subject"]);
  });
});
