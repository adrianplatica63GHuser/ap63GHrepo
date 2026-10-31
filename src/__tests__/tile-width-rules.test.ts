/**
 * Slice 41.18 — the drag says when a width cannot be had, or is a bad idea, and why. Each reason, pinned.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { LAPTOP_ROW_PX, judgeWidth, laptopUnits, type WidthCase } from "@/lib/ui/tile-width-rules";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const base: WidthCase = { asked: 3, min: 2, max: 8, contentUnits: 2, hasFields: true, beside: [], col: 0, laptopUnits: 8 };
const at = (asked: number, more: Partial<WidthCase> = {}) => judgeWidth({ ...base, ...more, asked });

describe("refused (Ask first 1)", () => {
  it("(a) narrower than its content — the widest row named, with what it needs", () => {
    expect(at(1, { widest: { fields: "Nume | Prenume", px: 314.4 } })).toEqual({
      kind: "refused",
      refusal: { reason: "content", units: 2, fields: "Nume | Prenume", px: 314 },
    });
  });

  it("(b) wider than this window's row", () => {
    expect(at(9)).toEqual({ kind: "refused", refusal: { reason: "window", units: 8 } });
  });

  it("(c) under one unit", () => {
    expect(at(0)).toEqual({ kind: "refused", refusal: { reason: "one" } });
    expect(at(-2, { min: 1 })).toEqual({ kind: "refused", refusal: { reason: "one" } });
  });
});

describe("advised (Ask first 2) — the width is taken, and the cost said", () => {
  it("(a) two units or more wider than its content needs", () => {
    expect(at(3)).toEqual({ kind: "ok" });
    expect(at(4)).toEqual({ kind: "advised", advice: [{ reason: "room", spare: 2 }] });
    expect(at(4, { hasFields: false })).toEqual({ kind: "ok" });
  });

  it("(b) so wide that a tile beside it goes under it", () => {
    expect(at(3, { beside: [{ col: 3, title: "Clasificare" }] })).toEqual({ kind: "ok" });
    expect(at(4, { contentUnits: 3, beside: [{ col: 3, title: "Clasificare" }] })).toEqual({
      kind: "advised",
      advice: [{ reason: "alone", title: "Clasificare" }],
    });
  });

  it("(c) wider than a 1366-px window holds beside the sidebar on this unit", () => {
    expect(LAPTOP_ROW_PX).toBe(1070);
    expect([laptopUnits(119, 16), laptopUnits(100, 16), laptopUnits(200, 16)]).toEqual([8, 9, 5]);
    expect(at(9, { max: 12, contentUnits: 8 })).toEqual({ kind: "advised", advice: [{ reason: "laptop", units: 8 }] });
  });

  it("(d) a list tile narrower than its table's columns", () => {
    expect(at(2, { hasFields: false, tableUnits: 3 })).toEqual({ kind: "advised", advice: [{ reason: "table" }] });
    expect(at(3, { hasFields: false, tableUnits: 3 })).toEqual({ kind: "ok" });
  });

  it("every cost at once, in that order", () => {
    const v = at(10, { max: 12, beside: [{ col: 6, title: "Hartă" }], tableUnits: 11 });
    expect(v).toEqual({
      kind: "advised",
      advice: [{ reason: "room", spare: 8 }, { reason: "alone", title: "Hartă" }, { reason: "laptop", units: 8 }, { reason: "table" }],
    });
  });
});

describe("the words (Ask first 3, 5)", () => {
  const ro = JSON.parse(read("messages", "ro-RO.json")).shared.tileWidth;
  const en = JSON.parse(read("messages", "en-GB.json")).shared.tileWidth;

  it("every reason in both languages, with its arguments", () => {
    const args: Record<string, string[]> = {
      "refused.content": ["units", "fields", "px"],
      "refused.window": ["units"],
      "refused.one": [],
      "advised.room": ["spare"],
      "advised.alone": ["title"],
      "advised.laptop": ["units"],
      "advised.table": [],
    };
    for (const [key, names] of Object.entries(args)) {
      const [group, leaf] = key.split(".");
      for (const [lang, m] of [["ro", ro], ["en", en]] as const) {
        const text: string = m[group][leaf];
        expect([lang, key, typeof text]).toEqual([lang, key, "string"]);
        for (const n of names) expect([lang, key, n, text.includes(`{${n}`)]).toEqual([lang, key, n, true]);
      }
    }
    expect(Object.keys(ro.refused).sort()).toEqual(["content", "one", "window"]);
    expect(Object.keys(ro.advised).sort()).toEqual(["alone", "laptop", "room", "table"]);
  });

  it("are shown beside the edge and read out politely, never a toast or a dialog", () => {
    const src = read("src", "components", "tiles", "use-tile-packing.ts");
    expect(src).toContain('live.setAttribute("aria-live", "polite");');
    expect(src).toContain("export const TILE_WIDTH_NOTE_CLASS =");
    expect(src).toContain("const verdict = verdictOf(r.measured, asked);");
    expect(src).toContain('if (verdict.kind !== "refused") commit(id, asked);');
    expect(src).toContain("child.dataset.tileWidthNote !== undefined");
    expect(src).not.toMatch(/useToast|showToast|role="dialog"|<dialog/);
  });

  it("the edge turns red when refused and amber when advised", () => {
    const src = read("src", "components", "tiles", "use-tile-packing.ts");
    expect(src).toContain('refused: "var(--color-danger)",');
    expect(src).toContain('advised: "var(--color-warning)",');
    expect(src).toContain("paint(r.handle, verdict.kind);");
  });
});
