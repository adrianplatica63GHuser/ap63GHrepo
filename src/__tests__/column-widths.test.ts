/**
 * The column widths a user drags — the pure part, and the one piece every list-like table uses.      (Slice 40.12)
 *
 * Adrian, 2026-10-20: „we should be able to grab this divider on the title bar Move it left or right to change the
 * width of the column; This should apply to all the lists and tables that are similar to the lists of principal
 * objects". `src/lib/ui/column-widths.ts` decides (the limits, the fill column's share, the store's round trip);
 * `src/components/table/column-resize.tsx` draws the line and the handle. The browser half is TC-LAYOUT-06.
 */
import fs from "fs";
import path from "path";

import {
  COLUMN_STEP_REM,
  MIN_COLUMN_REM,
  NO_WIDTHS,
  columnWidthsKey,
  isColumnWidthsKey,
  limitColumnRem,
  parseColumnWidths,
  resolveColumnRems,
  serializeColumnWidths,
  withColumnWidth,
} from "@/lib/ui/column-widths";
import { columnRem, tileTableRem } from "@/lib/ui/field-widths";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");

describe("the limits (Ask first 4, 5)", () => {
  it("never under 3 rem, no upper limit", () => {
    expect(MIN_COLUMN_REM).toBe(3);
    expect(COLUMN_STEP_REM).toBe(0.5);
    expect(limitColumnRem(8.5, 2)).toBe(3);
    expect(limitColumnRem(8.5, 13.5)).toBe(13.5);
    expect(limitColumnRem(8.5, 400)).toBe(400);
  });
  it("on a tile, never more than its fill column can give", () => {
    expect(limitColumnRem(8.5, 20, 5)).toBe(13.5);
    expect(limitColumnRem(8.5, 10, 5)).toBe(10);
    expect(limitColumnRem(8.5, 20, 0)).toBe(8.5);
    expect(limitColumnRem(8.5, 20, -2)).toBe(8.5); // a fill already under its floor gives nothing, takes nothing
  });
  it("a column already under 3 rem is not pushed up by a key", () => {
    expect(limitColumnRem(2.25, 1.75)).toBe(2.25);
    expect(limitColumnRem(2.25, 2.75)).toBe(2.75);
  });
});

describe("the widths (Ask first 3, 5, 6)", () => {
  const COLS = ["selectNew", "listDocumentType", "listDocumentTitle", "listRowActions"] as const;
  it("nothing stored: COLUMN's widths, the table their sum — as before 40.12", () => {
    const r = resolveColumnRems(COLS, NO_WIDTHS);
    expect(r.rems).toEqual(COLS.map((n) => columnRem(n)));
    expect(r.tableRem).toBe(COLS.reduce((s, n) => s + columnRem(n), 0));
    expect(r.roomRem).toBe(Number.POSITIVE_INFINITY);
  });
  it("a stored width replaces its column's, and the table grows by it", () => {
    const r = resolveColumnRems(COLS, { listDocumentType: columnRem("listDocumentType") + 5 });
    expect(r.rems[1]).toBe(columnRem("listDocumentType") + 5);
    expect(r.tableRem).toBe(resolveColumnRems(COLS, NO_WIDTHS).tableRem + 5);
  });
  it("on a tile: the fill column takes what the others leave, the table stays the tile's width", () => {
    const cols = ["select", "personName", "personType"] as const;
    const tile = { column: "personName" as const, tableRem: tileTableRem(4) };
    const plain = resolveColumnRems(cols, NO_WIDTHS, tile);
    expect(plain.tableRem).toBe(tile.tableRem);
    expect(plain.rems[1]).toBe(tile.tableRem - columnRem("select") - columnRem("personType"));
    const wider = resolveColumnRems(cols, { personType: columnRem("personType") + 2 }, tile);
    expect(wider.tableRem).toBe(tile.tableRem);
    expect(wider.rems[1]).toBe(plain.rems[1] - 2);
    expect(wider.roomRem).toBe(plain.roomRem - 2);
    // A width stored for the fill column itself is not used: its width is what the others leave.
    expect(resolveColumnRems(cols, { personName: 1000 }, tile).rems[1]).toBe(plain.rems[1]);
  });
  it("on a tile, the fill column never goes under 3 rem — the table grows instead", () => {
    const cols = ["select", "personName", "personType"] as const;
    const tile = { column: "personName" as const, tableRem: tileTableRem(4) };
    const r = resolveColumnRems(cols, { personType: 200 }, tile);
    expect(r.rems[1]).toBe(MIN_COLUMN_REM);
    expect(r.roomRem).toBe(0);
    expect(r.tableRem).toBe(columnRem("select") + 200 + MIN_COLUMN_REM);
  });
});

describe("the store (Ask first 6)", () => {
  it("one key per table, beside „Câmpuri afișate\"'s", () => {
    expect(columnWidthsKey("documents")).toBe("ga40-colw-v1:documents");
    expect(isColumnWidthsKey("ga40-colw-v1:groups")).toBe(true);
    expect(isColumnWidthsKey("ga40-col-document-v3")).toBe(false);
    expect(isColumnWidthsKey(null)).toBe(true); // localStorage.clear()
  });
  it("a round trip, a column given back, and the key gone when nothing is left", () => {
    let w = withColumnWidth(NO_WIDTHS, "listDocumentType", 13.5004);
    expect(w).toEqual({ listDocumentType: 13.5 });
    w = withColumnWidth(w, "nrDocument", 9);
    expect(parseColumnWidths(serializeColumnWidths(w))).toEqual({ listDocumentType: 13.5, nrDocument: 9 });
    w = withColumnWidth(w, "listDocumentType", null);
    expect(w).toEqual({ nrDocument: 9 });
    expect(serializeColumnWidths(withColumnWidth(w, "nrDocument", null))).toBeNull();
  });
  it("a column hidden and shown again keeps its width", () => {
    const stored = { listDocumentType: 13.5, nrDocument: 9 };
    const hidden = resolveColumnRems(["listDocumentType"], stored);
    expect(hidden.rems).toEqual([13.5]);
    const shown = resolveColumnRems(["listDocumentType", "nrDocument"], stored);
    expect(shown.rems).toEqual([13.5, 9]);
  });
  it("what is not a width is dropped", () => {
    expect(parseColumnWidths(null)).toBe(NO_WIDTHS);
    expect(parseColumnWidths("not json")).toBe(NO_WIDTHS);
    expect(parseColumnWidths("[1,2]")).toBe(NO_WIDTHS);
    expect(parseColumnWidths('{"a":2,"b":"9","c":7,"d":null}')).toEqual({ c: 7 });
  });
});

describe("one piece for every list-like table (Ask first 1, 9)", () => {
  const SRC = read("src", "components", "table", "column-resize.tsx");
  const ADMIN = read("src", "components", "list", "admin-list.tsx");
  const tables = (() => {
    const out: [string, string][] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (p.endsWith(".tsx")) for (const m of fs.readFileSync(p, "utf8").matchAll(/<(?:FixedTable|AdminListTable) id=(?:"([^"]+)"|\{`([^`]+)`\})/g)) out.push([path.relative(process.cwd(), p), m[1] ?? m[2]]);
      }
    };
    walk(path.join(process.cwd(), "src", "app"));
    return out;
  })();

  it("28 tables, each named once in the store — but the two person-side associate-document screens, one file twice", () => {
    // Was 29 until 40.62: the dashboard's expiring-documents table left the family — two columns that
    // fill the card, no handles, no stored widths (field-widths.test names it as the one exception).
    expect(tables).toHaveLength(28);
    const ids = tables.map(([, id]) => id);
    // role-stranding.test keeps those two screens byte-identical, so they share one name, and one set of widths.
    expect(ids.filter((id) => id === "persons/associate-document")).toHaveLength(2);
    expect(new Set(ids).size).toBe(ids.length - 1);
  });
  it("no table of that family is drawn without it", () => {
    for (const [file] of tables) expect([file, /fixedTable\(|FixedColumns|adminListTable\(|AdminListColumns/.test(read(file))]).toEqual([file, false]);
  });
  it("the line: an inset shadow in the rows' colour, on every cell but the last (Ask first 2)", () => {
    expect(SRC).toContain('"[&>*>tr>*:not(:last-child)]:shadow-[inset_-1px_0_0_var(--color-crease)] "');
    expect(SRC).toContain('"dark:[&>*>tr>*:not(:last-child)]:shadow-[inset_-1px_0_0_var(--color-zinc-800)]"');
    expect(ADMIN).toContain("COLUMN_LINES");
  });
  it("the handle: a focusable separator, 8 px, the col-resize cursor, the pointer held while dragged (Ask first 3, 7, 8)", () => {
    expect(SRC).toContain('role="separator"');
    expect(SRC).toContain('aria-orientation="vertical"');
    expect(SRC).toContain("tabIndex={0}");
    expect(SRC).toContain("const HANDLE_PX = 8;");
    expect(SRC).toContain("cursor-col-resize");
    expect(SRC).toContain("setPointerCapture(e.pointerId)");
    expect(SRC).toMatch(/e\.key === "ArrowRight"\) step\(widthRem \+ COLUMN_STEP_REM\)/);
    expect(SRC).toMatch(/e\.key === "Home"\) setWidth\(name, null\)/);
    expect(SRC).toMatch(/onDoubleClick=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*setWidth\(name, null\);/);
  });
  it("the fill column has no handle (Ask first 5)", () => {
    expect(SRC).toContain("if (!name || name === fill || rems[i] === undefined) return null;");
  });
});
