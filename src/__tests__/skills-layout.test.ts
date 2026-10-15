/**
 * „Harta competențelor” — where the boxes and arrows go.                                     (Slice #39.42)
 *
 * Adrian asked for straight arrows only and room between the boxes. These tests hold the layout to that on
 * the real catalogue: no two boxes overlap, every box sits in its level's column, every arrow is one straight
 * segment going left to right from its predecessor's right edge to its successor's left edge, and the
 * crossings are bounded — never more than the catalogue's own order gives, and within a ceiling measured when
 * the layout was written.
 */
import { SKILLS, type Skill, type SkillLevel } from "@/lib/skills/catalogue";
import { DEFAULT_LAYOUT, arrowsCross, countCrossings, layoutSkills, type LaidOutArrow } from "@/lib/skills/layout";

/** Measured on 2026-10-15 at 83, against 424 for the catalogue's own order with no reordering. */
const CROSSINGS_CEILING = 90;

const L = layoutSkills(SKILLS);
const byKey = new Map(L.boxes.map((b) => [b.key, b]));

describe("the boxes", () => {
  it("one per skill", () => {
    expect(L.boxes.map((b) => b.key).sort()).toEqual(SKILLS.map((s) => s.key).sort());
  });

  it("no two overlap — and keep a gap between them", () => {
    for (const p of L.boxes)
      for (const q of L.boxes) {
        if (p === q) continue;
        const apart = p.x + p.width <= q.x || q.x + q.width <= p.x || p.y + p.height + DEFAULT_LAYOUT.rowGap <= q.y || q.y + q.height + DEFAULT_LAYOUT.rowGap <= p.y;
        expect({ p: p.key, q: q.key, apart }).toEqual({ p: p.key, q: q.key, apart: true });
      }
  });

  it("each in its level's column, Basic to Expert from left to right, with a wide gap between columns", () => {
    for (const b of L.boxes) expect(b.x).toBe(L.columns[b.level]);
    expect(L.columns[1] < L.columns[2] && L.columns[2] < L.columns[3] && L.columns[3] < L.columns[4]).toBe(true);
    expect(L.columns[2] - L.columns[1] - DEFAULT_LAYOUT.boxWidth).toBeGreaterThanOrEqual(150);
  });

  it("inside the map", () => {
    for (const b of L.boxes) {
      expect(b.x >= 0 && b.y >= DEFAULT_LAYOUT.top).toBe(true);
      expect(b.x + b.width <= L.width && b.y + b.height <= L.height).toBe(true);
    }
  });
});

describe("the arrows", () => {
  it("one per predecessor, and nothing else", () => {
    const want = SKILLS.flatMap((s) => s.predecessors.map((p) => `${p}>${s.key}`)).sort();
    expect(L.arrows.map((a) => `${a.from}>${a.to}`).sort()).toEqual(want);
  });

  it.each(L.arrows.map((a) => [`${a.from} → ${a.to}`, a] as const))("%s: straight, left to right, edge to edge", (_n, a) => {
    const from = byKey.get(a.from)!;
    const to = byKey.get(a.to)!;
    // One segment from the predecessor's right edge to the successor's left edge, each at mid-height:
    // a single straight line, never a right angle.
    expect(a.x1).toBe(from.x + from.width);
    expect(a.y1).toBe(from.y + from.height / 2);
    expect(a.x2).toBe(to.x);
    expect(a.y2).toBe(to.y + to.height / 2);
    expect(a.x2).toBeGreaterThan(a.x1);
  });

  it(`cross at most ${CROSSINGS_CEILING} times, and fewer than the catalogue's own order`, () => {
    const naive = layoutSkills(SKILLS, { sweeps: 0, transpositionPasses: 0, restarts: 0 });
    expect(L.crossings).toBe(countCrossings(L.arrows));
    expect(L.crossings).toBeLessThanOrEqual(CROSSINGS_CEILING);
    expect(L.crossings).toBeLessThan(naive.crossings);
  });

  it("are laid out the same every time", () => {
    const again = layoutSkills(SKILLS);
    expect(again.boxes).toEqual(L.boxes);
  });
});

describe("arrowsCross", () => {
  const arrow = (from: string, to: string, x1: number, y1: number, x2: number, y2: number): LaidOutArrow => ({ from, to, x1, y1, x2, y2 });
  it("two arrows that swap heights cross", () => {
    expect(arrowsCross(arrow("a", "b", 0, 0, 10, 10), arrow("c", "d", 0, 10, 10, 0))).toBe(true);
  });
  it("two parallel arrows do not", () => {
    expect(arrowsCross(arrow("a", "b", 0, 0, 10, 0), arrow("c", "d", 0, 5, 10, 5))).toBe(false);
  });
  it("two arrows sharing a box do not count as crossing", () => {
    expect(arrowsCross(arrow("a", "b", 0, 0, 10, 10), arrow("a", "d", 0, 0, 10, 0))).toBe(false);
  });
});

describe("a small graph the sweeps must untangle", () => {
  // Catalogue order puts x1 over x2 and y2 over y1, so their arrows cross; the layout must uncross them.
  const mk = (key: string, level: SkillLevel, predecessors: string[] = []): Skill => ({
    key, number: key, level, path: "persons", name: { ro: key, en: key }, description: { ro: key, en: key }, predecessors, screens: [], cases: [],
  });
  it("leaves no crossing where none is needed", () => {
    const G = [mk("x1", 1), mk("x2", 1), mk("y2", 2, ["x2"]), mk("y1", 2, ["x1"])];
    expect(layoutSkills(G, { sweeps: 0, transpositionPasses: 0, restarts: 0 }).crossings).toBe(1);
    expect(layoutSkills(G).crossings).toBe(0);
  });
});
