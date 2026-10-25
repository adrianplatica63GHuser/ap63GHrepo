/**
 * Slice 40.67 — as many rows a page as the window holds, never fewer than 10; a resize keeps the first row on screen.
 *
 * `fittedRows` and `firstRowPage` are the arithmetic; `useFittedPage` is the page that follows the count; the four
 * principal lists use it with `useListFit().rows`, and ask for no rows before the frame is measured.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { act, renderHook } from "@testing-library/react";
import { FITTED_ROWS_SETTLE_MS, MIN_PAGE_ROWS, firstRowPage, fittedRows, keepRowsWhileResized, useFittedPage } from "@/lib/ui/use-fitted-rows";

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

describe("the rows a frame holds (Ask first 2)", () => {
  it("the frame less its band and borders, in whole rows", () => {
    // 900-px window: a 700-px frame, a 41-px band, 37-px rows → (700 − 41 − 2) / 37 = 17.7 → 17.
    expect(fittedRows({ frame: 700, band: 41, row: 37 })).toBe(17);
    expect(fittedRows({ frame: 1100, band: 41, row: 37 })).toBe(28);
  });
  it("never fewer than 10, whatever the window", () => {
    expect(MIN_PAGE_ROWS).toBe(10);
    expect(fittedRows({ frame: 200, band: 41, row: 37 })).toBe(10);
    expect(fittedRows({ frame: 0, band: 0, row: 37 })).toBe(10);
    expect(fittedRows({ frame: 700, band: 41, row: 0 })).toBe(10);
  });
  it("waits ~150 ms for a resize to settle", () => {
    expect(FITTED_ROWS_SETTLE_MS).toBe(150);
  });
});

describe("a resize keeps the first row on screen", () => {
  it("the page holding the first row that was shown", () => {
    // Page 3 of 15-row pages starts at row 30 (0-based): at 20 a page that is page 2 (index 1), at 10 page 4.
    expect(firstRowPage(2, 15, 20)).toBe(1);
    expect(firstRowPage(2, 15, 10)).toBe(3);
    expect(firstRowPage(0, 15, 27)).toBe(0);
    expect(firstRowPage(41, 15, 17)).toBe(36);
  });
  it("useFittedPage moves the page when the count changes, and not before the first count", () => {
    const { result, rerender } = renderHook(({ rows }) => useFittedPage(2, rows), { initialProps: { rows: null as number | null } });
    expect(result.current[0]).toBe(2);
    expect(result.current[2]).toBeNull();
    rerender({ rows: 15 });
    expect(result.current[0]).toBe(2); // the address's page stands on the first count
    rerender({ rows: 20 });
    expect(result.current[0]).toBe(1);
    act(() => result.current[1](4));
    expect(result.current[0]).toBe(4);
    rerender({ rows: 10 });
    expect(result.current[0]).toBe(8);
  });
});

describe("a resize keeps the rows on screen until the new page arrives", () => {
  it("the previous page stays while only the count changed, never for anything else", () => {
    const keep = keepRowsWhileResized<string>(20);
    expect(keep("rows", { queryKey: ["properties", "list", "", 2, "", "changed:desc", 15] })).toBe("rows");
    expect(keep("rows", { queryKey: ["properties", "list", "", 3, "", "changed:desc", 20] })).toBeUndefined();
    expect(keep("rows", undefined)).toBeUndefined();
  });
});

describe("the four lists (Ask first 1, 3)", () => {
  const LISTS = ["properties", "natural-persons", "judicial-persons", "documents"];
  it.each(LISTS)("%s asks for the fitted count, waits for it, and keeps no 15", (dir) => {
    const src = read("src", "app", dir, "list-view.tsx");
    expect(src).toContain("const [currentPage, setCurrentPage, pageSize] = useFittedPage(address.page, fit.rows);");
    expect(src).toContain('url.searchParams.set("limit",  String(pageSize));');
    expect(src).toMatch(/enabled:\s+(!noTypesSelected && )?pageSize !== null,\n\s+placeholderData: keepRowsWhileResized<ListResponse>\(pageSize\),/);
    expect(src).not.toMatch(/PAGE_SIZE\s*=\s*15/);
  });
  it("the frame's measure gives the count (useListFit)", () => {
    const src = read("src", "components", "list", "list-fit.tsx");
    expect(src).toContain('frame.querySelector("tbody tr:has([data-row-name-link])")');
    expect(src).toContain("const nextRows = fittedRows({ frame: maxPx, band, row: recordRow > 0 ? recordRow : LIST_ROW_PX });");
    expect(src).toContain("}, FITTED_ROWS_SETTLE_MS);");
  });
  it("the address carries no size (Ask first 3)", () => {
    expect(read("src", "components", "list", "use-list-address.tsx")).not.toMatch(/pageSize|limit/);
  });
});
