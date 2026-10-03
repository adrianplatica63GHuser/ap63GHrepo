/**
 * Slice #37.61 — the Properties list: no importance or relevance filter, no
 * „Cod" column, and „Câmpuri afișate" — now the shared chooser — offering
 * today's fields less importance, relevance and provenance.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, renderHook } from "@testing-library/react";
import { useFieldChooser } from "@/components/list/field-chooser";

const ROOT = join(__dirname, "..", "..");
const VIEW = readFileSync(join(ROOT, "src", "app", "properties", "list-view.tsx"), "utf8");

describe("the Properties list (Slice #37.61)", () => {
  it("„Câmpuri afișate” offers today's fields less importance, relevance and provenance, in order", () => {
    const keys = [...VIEW.matchAll(/\{ key: "(\w+)",\s+label:/g)].map((m) => m[1]);
    expect(keys).toEqual(["nickname", "parcela", "tarlaSola", "cadastralNumber", "carteFunciara", "surfaceAreaMp", "calculatedAreaMp", "locality"]);
  });

  it("draws the shared chooser with its four defaults", () => {
    expect(VIEW).toMatch(/const DEFAULT_COLS = \["nickname", "cadastralNumber", "surfaceAreaMp", "locality"\];/);
    expect(VIEW).toMatch(/useFieldChooser\(LS_KEY, optionalCols\.map\(\(c\) => c\.key\), MAX_OPT, DEFAULT_COLS\)/);
    expect(VIEW).toMatch(/<FieldChooser\b/);
  });

  it("has no importance or relevance filter, in its state, its query key or its page", () => {
    expect(VIEW).not.toMatch(/setImportance|setRelevance|importanceLabel|relevanceLabel|metadataValueLabel/);
    expect(VIEW).toMatch(/queryKey: \["properties", "list", debouncedSearch, currentPage\]/);
    expect(VIEW).toMatch(/const pageKey = `\$\{debouncedSearch\}\|\$\{currentPage\}`;/);
  });

  it("has no „Cod” column", () => {
    expect(VIEW).toMatch(/const columns: ColumnName\[\] = \["selectBadges", \.\.\.shownCols\.map\(\(c\) => c\.column\), "openPreview"\];/);
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
