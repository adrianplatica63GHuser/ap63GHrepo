/**
 * Slice 41.21 — a refused narrowing lists every line that would not fit, the heading too, each with its pixels.
 *
 * Adrian, 2026-10-31: „please list all the rows including the heading that will not fit; and provide the measurements
 * associated with your thinking, how many pixels each line would need". The list is `misfitList` (tile-width-rules.ts):
 * lines in, lines out — the order, the heading first, the cut at six, a row of text left out, and the px. The measure
 * itself (use-tile-packing.ts) is driven by TC-TILES-26 steps 7 and 9.
 */
import { MISFIT_CAP, headingMeasure, misfitList, type TileLine } from "@/lib/ui/tile-width-rules";

const U = 119;
const G = 16;
const have = (k: number) => k * U + (k - 1) * G;
const row = (name: string, px: number, top: number, more: Partial<TileLine> = {}): TileLine => ({ kind: "fields", name, px, fits: false, top, left: 13, ...more });
const heading = headingMeasure([{ text: "Identitate", px: 103.1 }, { text: "PPERS81773", px: 72 }], [8], 26);
const head = (fits: boolean): TileLine => ({ kind: "heading", name: heading.title, px: heading.px, fits, top: -1, left: 0, heading });

describe("what is listed (Ask first 1)", () => {
  it("only the lines that do not fit — the heading first, then the rows top to bottom, left to right", () => {
    const m = misfitList([row("CNP", 370, 120), row("Prenume | Nume", 306, 60), head(false), row("Sex", 200, 120, { left: 400 }), row("Poreclă", 180, 90, { fits: true })], have(2));
    expect(m.lines.map((l) => l.name)).toEqual(["Identitate · PPERS81773", "Prenume | Nume", "CNP", "Sex"]);
    expect([m.count, m.more, m.have]).toEqual([4, 0, 254]);
  });

  it("a heading that fits is not listed", () => {
    expect(misfitList([head(true), row("Prenume | Nume", 306, 60)], have(2)).lines.map((l) => l.kind)).toEqual(["fields"]);
  });

  it("a row of text that wraps is not a line that does not fit — it grows downward", () => {
    const m = misfitList([row("Observații", 600, 300, { kind: "text" }), row("Prenume | Nume", 306, 60)], have(2));
    expect(m.lines.map((l) => l.name)).toEqual(["Prenume | Nume"]);
    expect(m.count).toBe(1);
  });

  it("nothing that does not fit, nothing listed", () => {
    expect(misfitList([head(true), row("CNP", 100, 0, { fits: true })], have(2))).toEqual({ lines: [], count: 0, more: 0, have: 254 });
  });
});

describe("past six (Ask first 2)", () => {
  it("the six widest, still in screen order, and how many more", () => {
    expect(MISFIT_CAP).toBe(6);
    const lines = [300, 400, 260, 500, 280, 450, 270, 320].map((px, i) => row(`R${i}`, px, i * 30));
    const m = misfitList(lines, have(1));
    expect(m.lines.map((l) => l.name)).toEqual(["R0", "R1", "R3", "R4", "R5", "R7"]);
    expect([m.count, m.more]).toEqual([8, 2]);
  });

  it("exactly six: all of them, none more", () => {
    const m = misfitList([1, 2, 3, 4, 5, 6].map((i) => row(`R${i}`, 300 + i, i)), have(2));
    expect([m.lines.length, m.more]).toEqual([6, 0]);
  });
});

describe("the px (Ask first 5)", () => {
  it("what a line needs in whole px; what the tile has: k units and k − 1 gaps", () => {
    const m = misfitList([row("Prenume | Nume", 306.4, 60), row("CNP", 254.6, 90)], have(2));
    expect(m.lines.map((l) => l.px)).toEqual([306, 255]);
    expect(m.have).toBe(254);
    expect(misfitList([row("X", 500, 0)], have(3)).have).toBe(389);
  });

  it("the heading's line is its 41.20 measure — its parts add up to it", () => {
    const [l] = misfitList([head(false)], have(1)).lines;
    expect(l.px).toBe(103 + 8 + 72 + 26);
    expect(l.heading?.parts.map((p) => p.px)).toEqual([103, 72]);
  });
});
