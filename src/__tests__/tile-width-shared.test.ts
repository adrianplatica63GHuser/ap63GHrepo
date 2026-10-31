/**
 * Slice 41.19 — Legături, the address tiles and Clasificare: one width on every form.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { SHARED_WIDTH_TILES, formOfEntity, sharedWidthOf } from "@/lib/ui/tiles";
import {
  SHARED_FLOORS_KEY,
  SHARED_WIDTHS_KEY,
  parseSharedFloors,
  parseSharedWidths,
  sharedFloor,
  withSharedFloor,
  withSharedWidth,
} from "@/lib/ui/tile-positions";
import { judgeWidth } from "@/lib/ui/tile-width-rules";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

describe("which tiles share a width (Ask first 1, 3)", () => {
  it("Adrian's three — Legături, every address tile, Clasificare — and Etichete și grupuri", () => {
    expect(SHARED_WIDTH_TILES).toEqual({
      related: "related",
      addresses: "address",
      address: "address",
      classification: "classification",
      connections: "connections",
    });
    // A natural person's two address tiles, a firm's and a property's: one width.
    expect([sharedWidthOf("addresses"), sharedWidthOf("address")]).toEqual(["address", "address"]);
    expect([sharedWidthOf("identity"), sharedWidthOf("cadastral"), sharedWidthOf("interactions"), sharedWidthOf("toString")]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("each document type is one form, „Act”", () => {
    expect([formOfEntity("natural-person"), formOfEntity("property"), formOfEntity("document-CONTRACT_VANZARE"), formOfEntity("document-untyped")]).toEqual([
      "natural-person",
      "property",
      "document",
      "document",
    ]);
  });
});

describe("stored once per browser (Ask first 2)", () => {
  it("under a key of its own, { tile: units }", () => {
    expect(SHARED_WIDTHS_KEY).toBe("ga40-tile-widths-shared-v1");
    expect(parseSharedWidths(JSON.stringify({ related: 5, address: 0, classification: 2.5, connections: 3 }))).toEqual({ related: 5, connections: 3 });
    expect([parseSharedWidths(null), parseSharedWidths("x"), parseSharedWidths("[1]")]).toEqual([{}, {}, {}]);
    expect(withSharedWidth({ related: 5 }, "address", 3)).toEqual({ related: 5, address: 3 });
    expect(withSharedWidth({ related: 5 }, "related", undefined)).toEqual({});
  });

  it("each form's narrowest kept, so a width set on one form fits every form (Ask first 4)", () => {
    expect(SHARED_FLOORS_KEY).toBe("ga40-tile-width-floors-v1");
    const floors = withSharedFloor(withSharedFloor({}, "address", "natural-person", 2), "address", "property", 3);
    expect(parseSharedFloors(JSON.stringify(floors))).toEqual({ address: { "natural-person": 2, property: 3 } });
    expect(sharedFloor(floors, "address", "natural-person", 2)).toEqual({ units: 3, form: "property" });
    expect(sharedFloor(floors, "address", "property", 3)).toEqual({ units: 3, form: "property" });
    expect(sharedFloor(floors, "address", "property", 1)).toEqual({ units: 2, form: "natural-person" });
    expect(sharedFloor({}, "related", "document", 2)).toEqual({ units: 2, form: "document" });
  });

  it("the refusal names the form whose content sets it", () => {
    expect(judgeWidth({ asked: 2, min: 3, max: 8, contentUnits: 3, elsewhere: "property", hasFields: true, beside: [], col: 0, laptopUnits: 8 })).toEqual({
      kind: "refused",
      refusal: { reason: "form", units: 3, form: "property" },
    });
  });
});

describe("the packing reads and writes it (Ask first 2, 5, 6, 7)", () => {
  const src = read("src", "components", "tiles", "use-tile-packing.ts");

  it("a shared tile's width is the shared one, on every form; its kind's entry keeps its place only", () => {
    expect(src).toContain("return k ? shared[k] : stored[b.id]?.units;");
    expect(src).toMatch(/shared = withSharedWidth\(shared, k, units === own \? undefined : units\);\s*writeShared\(shared\);\s*stored = withStoredWidth\(stored, id, undefined\);/);
  });

  it("lazily: read at each layout, so another form — or tab — takes it when it is shown again", () => {
    expect(src).toMatch(/stored = readPlaces\(key\);\s*shared = readShared\(\);/);
  });

  it("„Implicit” forgets the shared widths too; a double-click forgets one tile's everywhere", () => {
    expect(src).toMatch(/visit = \{\};[\s\S]{0,200}shared = \{\};\s*writeShared\(shared\);\s*fresh\(\);/);
    expect(src).toMatch(/if \(shared\[k\] === undefined\) return;\s*shared = withSharedWidth\(shared, k, undefined\);/);
  });

  it("the bubble adds that the width applies on every form", () => {
    expect(src).toContain("...(m.shared ? [words.current.shared(m.title)] : [])");
    const ro = JSON.parse(read("messages", "ro-RO.json")).shared.tileWidth;
    expect(ro.shared).toBe("Lățimea se aplică panoului {title} pe toate formularele.");
    expect(ro.refused.form).toContain("{form}");
    expect(Object.keys(ro.forms).sort()).toEqual(["document", "judicial-person", "natural-person", "property"]);
    const en = JSON.parse(read("messages", "en-GB.json")).shared.tileWidth;
    expect(Object.keys(en.forms).sort()).toEqual(Object.keys(ro.forms).sort());
  });
});
