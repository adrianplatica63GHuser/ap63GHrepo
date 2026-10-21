/**
 * Slice 40.25 — a principal list's columns, dragged by their name: the order's rules (`src/lib/ui/column-order.ts`),
 * and where the four lists and „Câmpuri afișate" use them.
 *
 * Adrian, 2026-10-21: „we should be able to grab a column by its title area (the Gray area) and move it left or right
 * to reposition it - when we drop it".
 */
import fs from "node:fs";
import path from "node:path";
import { applyOrder, dropIndex, forgetColumn, gapAt, moveBy, moveTo, readOrder } from "@/lib/ui/column-order";
import { LIST_COLUMN_CHOICE, LIST_COLUMN_ORDER } from "@/lib/ui/list-columns";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");

describe("the order (Ask first 1, 3)", () => {
  it("nothing stored: the columns as the lists lay them out — fixed first, then ticked", () => {
    expect(applyOrder(["name", "nickname", "cnp", "age"], null)).toEqual(["name", "nickname", "cnp", "age"]);
  });
  it("a stored order wins; a column ticked later goes to the end", () => {
    expect(applyOrder(["name", "nickname", "cnp", "age"], ["cnp", "name", "nickname"])).toEqual(["cnp", "name", "nickname", "age"]);
  });
  it("a stored column no longer shown is skipped; a repeated one counts once", () => {
    expect(applyOrder(["name", "nickname"], ["gender", "nickname", "name", "nickname"])).toEqual(["nickname", "name"]);
  });
  it("an unticked column leaves the stored order, so it comes back at the end", () => {
    const stored = ["cnp", "name", "nickname"];
    const after = forgetColumn(stored, "cnp");
    expect(after).toEqual(["name", "nickname"]);
    expect(applyOrder(["name", "nickname", "cnp"], after)).toEqual(["name", "nickname", "cnp"]);
    expect(forgetColumn(null, "cnp")).toBeNull();
  });
});

describe("moving", () => {
  const ORDER = ["a", "b", "c", "d", "e"];
  it("moveTo: the column taken out and put at its new index, clamped", () => {
    expect(moveTo(ORDER, "b", 3)).toEqual(["a", "c", "d", "b", "e"]);
    expect(moveTo(ORDER, "d", 0)).toEqual(["d", "a", "b", "c", "e"]);
    expect(moveTo(ORDER, "a", 99)).toEqual(["b", "c", "d", "e", "a"]);
    expect(moveTo(ORDER, "zz", 1)).toEqual(ORDER);
  });
  it("moveBy: Alt+← / Alt+→ one place; at an end, nowhere", () => {
    expect(moveBy(ORDER, "c", -1)).toEqual(["a", "c", "b", "d", "e"]);
    expect(moveBy(ORDER, "c", 1)).toEqual(["a", "b", "d", "c", "e"]);
    expect(moveBy(ORDER, "a", -1)).toEqual(ORDER);
    expect(moveBy(ORDER, "e", 1)).toEqual(ORDER);
  });
  it("a drop: the boundary under the pointer, then the index once the column is out of its place", () => {
    const mids = [50, 150, 250, 350, 450];
    expect(gapAt(mids, 10)).toBe(0);
    expect(gapAt(mids, 330)).toBe(3);
    expect(gapAt(mids, 999)).toBe(5);
    // „b" (index 1) dropped between „c" and „d" (gap 3) → index 2: two places right.
    expect(dropIndex(3, 1)).toBe(2);
    expect(moveTo(ORDER, "b", dropIndex(3, 1))).toEqual(["a", "c", "b", "d", "e"]);
    // Dropped where it already is (either boundary beside it): no move.
    expect(dropIndex(1, 1)).toBe(1);
    expect(dropIndex(2, 1)).toBe(1);
    expect(dropIndex(0, 3)).toBe(0);
  });
});

describe("what is stored", () => {
  it("an array of strings, or nothing", () => {
    expect(readOrder('["a","b"]')).toEqual(["a", "b"]);
    for (const raw of [null, "", "{", '{"a":1}', "[1,2]", '"a"']) expect(readOrder(raw)).toBeNull();
  });
  it("a key per list, of its own, beside the chooser's", () => {
    expect(Object.keys(LIST_COLUMN_ORDER).sort()).toEqual(Object.keys(LIST_COLUMN_CHOICE).sort());
    const keys = Object.values(LIST_COLUMN_ORDER);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(Object.values(LIST_COLUMN_CHOICE).map((c) => c.storageKey)).not.toContain(k);
  });
});

describe("the four lists and „Câmpuri afișate” use it (Ask first 2, 4, 6)", () => {
  const LISTS = { "natural-persons": "person", "judicial-persons": "company", properties: "property", documents: "document" } as const;
  it.each(Object.entries(LISTS))("%s", (dir, kind) => {
    const src = read("src", "app", dir, "list-view.tsx");
    expect(src).toContain(`useColumnOrder(LIST_COLUMN_ORDER.${kind}, [...fixedKeys, ...shownCols.map((c) => c.key)])`);
    expect(src).toContain("useColumnDrag({ keys: order.keys,");
    expect(src).toContain('[...order.keys.map(columnOf), "listRowActions"]');
    expect(src).toContain("{drag.layer}");
    // Heads and cells in the order dragged; every name cell a handle.
    expect((src.match(/order\.keys\.map\(\(key\)/g) ?? []).length).toBe(2);
    expect((src.match(/drag=\{drag\.headProps\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(src).toContain("onToggle={(key) => { if (chooser.visible.includes(key)) order.forget(key); chooser.toggle(key); }}");
    expect(src).toContain("onResetOrder={order.custom ? order.reset : undefined}");
  });
  it("the cell is the handle; the funnel and the width handle are not", () => {
    const drag = read("src", "components", "list", "column-order.tsx");
    expect(drag).toContain('if ((e.target as Element).closest("button, a, input, select, textarea")) return;');
    expect(drag).toContain("const START_PX = 5;");
    expect(read("src", "components", "table", "list-head.tsx")).toContain("{...drag}");
  });
  it("the words, in both languages", () => {
    const ro = JSON.parse(read("messages", "ro-RO.json")).shared.columnOrder;
    const en = JSON.parse(read("messages", "en-GB.json")).shared.columnOrder;
    expect(ro.defaultOrder).toBe("Ordinea implicită");
    expect(en.defaultOrder).toBe("Default order");
    expect(ro.announce).toBe("Coloana {name}, a {n}-a din {total}");
  });
});
