/**
 * „Clasificare subiectivă" is called „Clasificări", everywhere.  (Slice #37.87)
 *
 * The tile, its checkbox and the section heading read „Clasificări"
 * („Classifications") on Property, Natural Person, Judicial Person and
 * Document. The keys stay `classification`, so a stored tile choice keeps its
 * tick; only the words changed.
 *
 * Slice #38.30 renamed it again, to „Clasificare" („Classification"), with the
 * line „Importanță, relevanță, proveniență" under it. The assertions below are
 * #37.87's, inverted in place: they used to read
 * `toBe("Clasificări")` / `toBe("Classifications")`. „Clasificare subiectivă"
 * is still the name that must not come back.
 */
import fs from "fs";
import path from "path";

const LOCALES = ["ro-RO.json", "en-GB.json"] as const;
const read = (file: string) => fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8");
const at = (tree: unknown, key: string): unknown =>
  key.split(".").reduce<unknown>((n, k) => (n && typeof n === "object" ? (n as Record<string, unknown>)[k] : undefined), tree);

describe("the old name is gone from both message files", () => {
  it.each(LOCALES)("%s spells neither old name", (file) => {
    const text = read(file);
    expect(text).not.toMatch(/Clasificare subiectiv/i);
    expect(text).not.toMatch(/Subjective classification/i);
  });
});

describe("the five places read the new name (#38.30), under the old keys", () => {
  const KEYS = [
    "property.tiles.classification",
    "naturalPerson.tiles.classification",
    "judicialPerson.tiles.classification",
    "document.tiles.classification",
  ];
  it.each(KEYS)("%s", (key) => {
    expect(at(JSON.parse(read("ro-RO.json")), key)).toBe("Clasificare");
    expect(at(JSON.parse(read("en-GB.json")), key)).toBe("Classification");
  });

  it("the section heading too", () => {
    for (const [file, word] of [["ro-RO.json", "Clasificare"], ["en-GB.json", "Classification"]] as const) {
      const text = read(file);
      expect(text).toContain(`"sectionClassification": "${word}"`);
    }
  });
});
