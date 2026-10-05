/**
 * Slice #37.61 — the Properties list: no importance or relevance filter, no
 * „Cod" column, and „Câmpuri afișate" — now the shared chooser — offering
 * today's fields less importance, relevance and provenance.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, renderHook } from "@testing-library/react";
import { readStored, useFieldChooser } from "@/components/list/field-chooser";
import { COLUMN, SCREEN_ROWS } from "@/lib/ui/field-widths";

const ROOT = join(__dirname, "..", "..");
const VIEW = readFileSync(join(ROOT, "src", "app", "properties", "list-view.tsx"), "utf8");
const QUERIES = readFileSync(join(ROOT, "src", "lib", "properties", "queries.ts"), "utf8");

describe("the Properties list (Slice #37.61)", () => {
  it("„Câmpuri afișate” offers every field of „Date cadastrale” but Poreclă and Note, in that panel's order, then Localitate (#37.72)", () => {
    const keys = [...VIEW.matchAll(/\{ key: "(\w+)",\s+label:/g)].map((m) => m[1]);
    expect(keys).toEqual(["tarlaSola", "parcela", "surfaceAreaMp", "calculatedAreaMp", "carteFunciara", "cadastralNumber", "useCategory", "propertyType", "locality"]);
    // „Date cadastrale"'s own order, less Poreclă and Note (the keys are the stored ones: tarlaSola for tarlaId).
    const panel = SCREEN_ROWS.property.cadastral.flat().filter((f) => f !== "nickname" && f !== "notes");
    expect(panel).toEqual(["tarlaId", "parcela", "surfaceAreaMp", "calculatedAreaMp", "carteFunciara", "cadastralNumber", "useCategoryId", "propertyTypeId"]);
    expect(keys).not.toContain("nickname");
    expect(keys).not.toContain("notes");
  });

  it("the two new fields: labelled as on the form, their own columns, the API's names (#37.72)", () => {
    expect(VIEW).toMatch(/\{ key: "useCategory",\s+label: t\("fields\.useCategory"\),\s+column: "useCategory" \}/);
    expect(VIEW).toMatch(/\{ key: "propertyType",\s+label: t\("fields\.propertyType"\),\s+column: "propertyType" \}/);
    expect(COLUMN.useCategory.kind).toBe("wraps");
    expect(COLUMN.propertyType.kind).toBe("wraps");
    const q = QUERIES.slice(QUERIES.indexOf("export async function listProperties"));
    expect(q).toMatch(/useCategory:\s+lookupUseCategory\.name/);
    expect(q).toMatch(/propertyType:\s+lookupPropertyType\.name/);
    expect(q).toMatch(/\.leftJoin\(lookupUseCategory, eq\(lookupUseCategory\.id, property\.useCategoryId\)\)/);
    expect(q).toMatch(/\.leftJoin\(lookupPropertyType, eq\(lookupPropertyType\.id, property\.propertyTypeId\)\)/);
  });

  it("draws the shared chooser with its defaults, Poreclă no longer among them (#37.72)", () => {
    // Slice #37.94: the defaults are Tarla/Solă and Parcelă, in list-columns.ts (list-default-fields.test.ts).
    expect(VIEW).toContain("useFieldChooser(LIST_COLUMN_CHOICE.property.storageKey, optionalCols.map((c) => c.key), MAX_OPT, LIST_COLUMN_CHOICE.property.defaults)");
    expect(VIEW).toMatch(/<FieldChooser\b/);
  });

  it("has no importance or relevance filter, in its state, its query key or its page", () => {
    expect(VIEW).not.toMatch(/setImportance|setRelevance|importanceLabel|relevanceLabel|metadataValueLabel/);
    expect(VIEW).toMatch(/queryKey: \["properties", "list", debouncedSearch, currentPage\]/);
    expect(VIEW).toMatch(/const pageKey = `\$\{debouncedSearch\}\|\$\{currentPage\}`;/);
  });

  it("has no „Cod” column; Poreclă is always the first after the checkbox (#37.72)", () => {
    expect(VIEW).toMatch(/const columns: ColumnName\[\] = \["selectBadges", "propertyNickname", \.\.\.shownCols\.map\(\(c\) => c\.column\), "openPreview"\];/);
    expect(VIEW).toMatch(/\{\.\.\.columnHead\("propertyNickname"\)\}>\s*\{t\("table\.nickname"\)\}/);
    expect(VIEW).not.toMatch(/columnHead\("code"\)/);
  });
});

describe("the shared chooser's defaults", () => {
  beforeEach(() => localStorage.clear());

  it("a browser that has never chosen sees the defaults; a stored choice of none stays none", async () => {
    const first = renderHook(() => useFieldChooser("p", ["a", "b", "c"], 4, ["a", "b"]));
    expect(first.result.current.visible).toEqual(["a", "b"]);
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    expect(first.result.current.visible).toEqual(["a", "b"]);

    localStorage.setItem("q", "[]");
    const none = renderHook(() => useFieldChooser("q", ["a", "b"], 4, ["a"]));
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    expect(none.result.current.visible).toEqual([]);

    localStorage.setItem("r", JSON.stringify(["importance", "b", "provenance"]));
    const old = renderHook(() => useFieldChooser("r", ["a", "b"], 4, ["a"]));
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    expect(old.result.current.visible).toEqual(["b"]);
  });
});

describe("a stored choice that names Poreclă (Slice #37.72)", () => {
  beforeEach(() => localStorage.clear());

  it("reads back without it — the column is drawn anyway", () => {
    const offered = [...VIEW.matchAll(/\{ key: "(\w+)",\s+label:/g)].map((m) => m[1]);
    localStorage.setItem("ga40-col-property-v4", JSON.stringify(["nickname", "locality", "tarlaSola", "parcela"]));
    expect(readStored("ga40-col-property-v4", offered, ["propertyType"])).toEqual(["locality", "tarlaSola", "parcela"]);
  });
});
