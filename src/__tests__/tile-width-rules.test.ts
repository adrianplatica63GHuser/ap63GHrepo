/**
 * Slice 41.18 — the drag says when a width cannot be had, or is a bad idea, and why. Each reason, pinned.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { LAPTOP_ROW_PX, VISIBLE_JOIN, headingMeasure, judgeWidth, laptopUnits, type TileLine, type WidthCase } from "@/lib/ui/tile-width-rules";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const base: WidthCase = { asked: 3, min: 2, max: 8, contentUnits: 2, hasFields: true, beside: [], col: 0, laptopUnits: 8 };
const at = (asked: number, more: Partial<WidthCase> = {}) => judgeWidth({ ...base, ...more, asked });

describe("refused (Ask first 1)", () => {
  // 41.21: every line that would not fit at the asked width, each with its px and the px the tile has there.
  const row = (name: string, px: number, top: number, fits = false): TileLine => ({ kind: "fields", name, px, fits, top, left: 13 });

  it("(a) narrower than its content — every line that would not fit, with what each needs and what the tile has", () => {
    const heading = headingMeasure([{ text: "Identitate", px: 103.1 }, { text: "PPERS81773", px: 72 }], [8], 26);
    const lines: TileLine[] = [
      row("Prenume | Nume", 306.4, 60),
      row("CNP", 200, 120, true),
      { kind: "heading", name: heading.title, px: heading.px, fits: true, top: -1, left: 0, heading },
    ];
    expect(at(1, { lines: { have: 119, lines } })).toEqual({
      kind: "refused",
      refusal: { reason: "content", units: 2, misfit: { lines: [{ ...lines[0], px: 306 }], count: 1, more: 0, have: 119 } },
    });
  });

  it("(a) with nothing measured not to fit, it is the one-unit floor", () => {
    expect(at(1, { lines: { have: 119, lines: [row("CNP", 100, 0, true)] } })).toEqual({ kind: "refused", refusal: { reason: "one" } });
  });

  it("(b) wider than this window's row", () => {
    expect(at(9)).toEqual({ kind: "refused", refusal: { reason: "window", units: 8 } });
  });

  it("(c) under one unit", () => {
    expect(at(0)).toEqual({ kind: "refused", refusal: { reason: "one" } });
    expect(at(-2, { min: 1 })).toEqual({ kind: "refused", refusal: { reason: "one" } });
  });
});

describe("41.20 — the heading's px (Ask first 2, 3)", () => {
  it("each part, the space between, the frame — whole px, and the total exactly their sum", () => {
    const m = headingMeasure([{ text: "Identitate", px: 97.6 }, { text: "PPERS 77369", px: 78.6 }], [8], 26);
    expect(m).toEqual({
      title: "Identitate · PPERS 77369",
      parts: [{ text: "Identitate", px: 98 }, { text: "PPERS 77369", px: 79 }],
      spaces: [8],
      frame: 26,
      px: 98 + 8 + 79 + 26,
    });
  });

  it("the visible parts are joined with „ · ”; one part has no space", () => {
    expect(VISIBLE_JOIN).toBe(" · ");
    expect(headingMeasure([{ text: "Date cadastrale", px: 150.2 }], [], 26.4)).toEqual({
      title: "Date cadastrale",
      parts: [{ text: "Date cadastrale", px: 150 }],
      spaces: [],
      frame: 26,
      px: 176,
    });
  });

  it("a space per gap, a missing one counted as none; nothing negative", () => {
    const m = headingMeasure([{ text: "A", px: 10 }, { text: "B", px: 20 }, { text: "C", px: 30 }], [8], -1);
    expect(m.spaces).toEqual([8, 0]);
    expect(m.frame).toBe(0);
    expect(m.px).toBe(68);
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
      "refused.narrower": ["units"], // 41.21: the list's first line, then a line a row
      "refused.row": ["fields", "px", "have"],
      "refused.headingRow": ["title", "px", "have", "detail"],
      "refused.more": ["count"],
      "refused.count": ["count"],
      "refused.window": ["units"],
      "refused.one": [],
      "refused.form": ["units", "form"], // 41.19
      // 41.20: the heading's parts.
      "refused.headingFirst": ["text", "px"],
      "refused.headingPart": ["text", "px"],
      "refused.headingSpace": ["px"],
      "refused.headingFrame": ["px"],
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
    // 41.19: „form”; 41.20: the heading's parts; 41.21: the list — „content” and „heading” became its lines.
    expect(Object.keys(ro.refused).sort()).toEqual(
      ["count", "form", "headingFirst", "headingFrame", "headingPart", "headingRow", "headingSpace", "more", "narrower", "one", "row", "window"],
    );
    expect(Object.keys(en.refused).sort()).toEqual(Object.keys(ro.refused).sort());
    expect(Object.keys(ro.advised).sort()).toEqual(["alone", "laptop", "room", "table"]);
  });

  it("41.20: a heading is called a heading, not a row — and its words add up part by part", () => {
    expect(ro.refused.headingRow).toBe("titlul «{title}» — {px} px (încap {have}): {detail}");
    expect([ro.refused.headingFirst, ro.refused.headingSpace, ro.refused.headingPart, ro.refused.headingFrame]).toEqual([
      "«{text}» {px} px",
      "spațiu {px}",
      "«{text}» {px}",
      "margini {px}",
    ]);
    expect(en.refused.headingRow).toBe("the heading «{title}» — {px} px ({have} available): {detail}");
  });

  it("41.21: the list's words — „«Nume | Prenume» — 314 px (încap 254)”, the cut, the count read out", () => {
    expect(ro.refused.narrower).toBe("Panoul nu poate fi mai îngust de {units, plural, one {# unitate} few {# unități} other {# de unități}}:");
    expect(ro.refused.row).toBe("«{fields}» — {px} px (încap {have})");
    expect(ro.refused.more).toBe("… și încă {count, plural, one {un rând} few {# rânduri} other {# de rânduri}}");
    expect(ro.refused.count).toBe("{count, plural, one {Un rând nu încape} few {# rânduri nu încap} other {# de rânduri nu încap}}.");
  });

  it("41.20–41.21: every line is measured in one pass, the tile itself only when they all fit; names are what is visible", () => {
    const src = read("src", "components", "tiles", "use-tile-packing.ts");
    const rowsAt = src.indexOf("const bad = new Set(broken(shape()));");
    const tileAt = src.indexOf("if (out.every((l) => l.fits)) {");
    expect(rowsAt).toBeGreaterThan(0);
    expect(tileAt).toBeGreaterThan(rowsAt);
    expect(src).toContain("const floor = narrowest(b, p.units, unit, gap, true);");
    expect(src).toContain("lines: m.lines.get(asked),");
    expect(src).toContain('export const TILE_WIDTH_LIST_MAX = "28rem";');
    expect(src).toContain("return (h ? visibleName(h) : \"\") || b.el.getAttribute(\"aria-label\") || tileOf(b.id);");
    expect(src).not.toMatch(/querySelector\("h2, h3"\)\?\.textContent/);
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
