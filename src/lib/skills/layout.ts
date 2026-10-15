/**
 * „Harta competențelor” — where every box and arrow goes.                                    (Slice #39.42)
 *
 * Adrian's request: four level columns, Basic to Expert, left to right; straight arrows only — „please do not
 * use arrows that make 90 degrees angles … Use straight arrows; … feel free to use larger gaps and distance
 * between boxes”. So:
 *
 *   - each level is a column, with a wide gap between columns;
 *   - an arrow runs in one straight line from the predecessor's right edge, at mid-height, to the successor's
 *     left edge, at mid-height — always left to right, because a predecessor is always a lower level
 *     (validate-graph.ts's `arrow-not-upward`);
 *   - within a column the boxes are ordered to cut crossings: the classic barycentre sweeps — each box moved
 *     near the mean height of the boxes it joins, column by column, down the levels and back up, a few times —
 *     keeping whichever order crossed least; then neighbour swaps, kept whenever they cross less. The
 *     catalogue's own order is where it starts, and a few seeded shuffles of it are tried as well, so the map
 *     is the same every time and a catalogue that happens to cross less is never made worse.
 *
 * PURE MODULE — no React. The drawing (src/app/skills-map) only places what this returns.
 */
import type { Skill, SkillLevel } from "./catalogue";

export type LayoutOptions = {
  boxWidth: number;
  boxHeight: number;
  /** Between two columns — where the arrows run. */
  columnGap: number;
  /** Between two boxes of one column. */
  rowGap: number;
  /** Above the first row: the column headings. */
  top: number;
  /** Barycentre sweeps, each down the levels and back up. */
  sweeps: number;
  /** Passes of neighbour swaps after the sweeps; each pass tries every adjacent pair once. */
  transpositionPasses: number;
  /** Seeded random starting orders tried besides the catalogue's own. */
  restarts: number;
  seed: number;
};

export const DEFAULT_LAYOUT: LayoutOptions = {
  boxWidth: 196,
  boxHeight: 68,
  columnGap: 200,
  rowGap: 22,
  top: 64,
  sweeps: 8,
  transpositionPasses: 12,
  restarts: 12,
  seed: 17,
};

export type LaidOutBox = { key: string; level: SkillLevel; x: number; y: number; width: number; height: number };

export type LaidOutArrow = { from: string; to: string; x1: number; y1: number; x2: number; y2: number };

export type SkillLayout = {
  boxes: LaidOutBox[];
  arrows: LaidOutArrow[];
  /** The x of each level's column, for its heading. */
  columns: Record<SkillLevel, number>;
  width: number;
  height: number;
  crossings: number;
};

const LEVELS: readonly SkillLevel[] = [1, 2, 3, 4];

type Order = Record<SkillLevel, string[]>;

function place(order: Order, o: LayoutOptions): Map<string, { x: number; y: number }> {
  const tallest = Math.max(...LEVELS.map((l) => order[l].length));
  const pitch = o.boxHeight + o.rowGap;
  const at = new Map<string, { x: number; y: number }>();
  for (const l of LEVELS) {
    // Shorter columns are centred against the tallest, so their arrows fan rather than all climbing.
    const offset = ((tallest - order[l].length) * pitch) / 2;
    order[l].forEach((key, i) => at.set(key, { x: (l - 1) * (o.boxWidth + o.columnGap), y: o.top + offset + i * pitch }));
  }
  return at;
}

function arrowsOf(skills: readonly Skill[], at: Map<string, { x: number; y: number }>, o: LayoutOptions): LaidOutArrow[] {
  const arrows: LaidOutArrow[] = [];
  for (const s of skills) {
    const to = at.get(s.key);
    if (!to) continue;
    for (const p of s.predecessors) {
      const from = at.get(p);
      if (!from) continue;
      arrows.push({
        from: p,
        to: s.key,
        x1: from.x + o.boxWidth,
        y1: from.y + o.boxHeight / 2,
        x2: to.x,
        y2: to.y + o.boxHeight / 2,
      });
    }
  }
  return arrows;
}

/** Whether two straight arrows cross — sharing an end is not a crossing. */
export function arrowsCross(a: LaidOutArrow, b: LaidOutArrow): boolean {
  if (a.from === b.from || a.to === b.to || a.from === b.to || a.to === b.from) return false;
  const d = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = d(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1);
  const d2 = d(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
  const d3 = d(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1);
  const d4 = d(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

export function countCrossings(arrows: readonly LaidOutArrow[]): number {
  let n = 0;
  for (let i = 0; i < arrows.length; i++) for (let j = i + 1; j < arrows.length; j++) if (arrowsCross(arrows[i], arrows[j])) n++;
  return n;
}

function cloneOrder(order: Order): Order {
  return { 1: [...order[1]], 2: [...order[2]], 3: [...order[3]], 4: [...order[4]] };
}

/** Re-sort one column by the mean height of each box's neighbours on the given side; a box with none keeps its place. */
function sortByBarycentre(column: string[], neighbours: (key: string) => string[], at: Map<string, { x: number; y: number }>): string[] {
  const keyed = column.map((key, i) => {
    const ys = neighbours(key)
      .map((n) => at.get(n)?.y)
      .filter((y): y is number => y !== undefined);
    return { key, i, b: ys.length ? ys.reduce((a, y) => a + y, 0) / ys.length : (at.get(key)?.y ?? 0) };
  });
  keyed.sort((p, q) => p.b - q.b || p.i - q.i);
  return keyed.map((k) => k.key);
}

/** A small deterministic generator: the same seed gives the same restarts, so the map is the same every time. */
function seeded(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

/** Barycentre sweeps, then neighbour swaps, from one starting order; the best order found and its crossings. */
function improve(start: Order, score: (o: Order) => number, preds: Map<string, string[]>, succs: Map<string, string[]>, o: LayoutOptions) {
  let order = cloneOrder(start);
  let best = cloneOrder(order);
  let bestScore = score(best);

  for (let sweep = 0; sweep < o.sweeps; sweep++) {
    for (const l of [2, 3, 4] as const) order[l] = sortByBarycentre(order[l], (k) => preds.get(k) ?? [], place(order, o));
    for (const l of [3, 2, 1] as const) order[l] = sortByBarycentre(order[l], (k) => succs.get(k) ?? [], place(order, o));
    const now = score(order);
    if (now < bestScore) {
      best = cloneOrder(order);
      bestScore = now;
    }
    order = cloneOrder(order);
  }

  // Then transpositions: swap two neighbours in a column whenever that crosses less, until no swap helps.
  for (let pass = 0, improved = true; improved && pass < o.transpositionPasses; pass++) {
    improved = false;
    for (const l of LEVELS) {
      for (let i = 0; i + 1 < best[l].length; i++) {
        const trial = cloneOrder(best);
        [trial[l][i], trial[l][i + 1]] = [trial[l][i + 1], trial[l][i]];
        const t = score(trial);
        if (t < bestScore) {
          best = trial;
          bestScore = t;
          improved = true;
        }
      }
    }
  }
  return { order: best, score: bestScore };
}

/** The whole map: boxes, arrows, column positions, size, and how many arrows still cross. */
export function layoutSkills(skills: readonly Skill[], options: Partial<LayoutOptions> = {}): SkillLayout {
  const o = { ...DEFAULT_LAYOUT, ...options };
  const keys = new Set(skills.map((s) => s.key));
  const preds = new Map(skills.map((s) => [s.key, s.predecessors.filter((p) => keys.has(p))]));
  const succs = new Map(skills.map((s) => [s.key, skills.filter((x) => x.predecessors.includes(s.key)).map((x) => x.key)]));
  const score = (ord: Order) => countCrossings(arrowsOf(skills, place(ord, o), o));

  // The catalogue's own order first, then seeded shuffles of it; the order that crosses least wins.
  const catalogue: Order = { 1: [], 2: [], 3: [], 4: [] };
  for (const s of skills) catalogue[s.level].push(s.key);
  let { order: best, score: bestScore } = improve(catalogue, score, preds, succs, o);
  const random = seeded(o.seed);
  for (let r = 0; r < o.restarts; r++) {
    const start = cloneOrder(catalogue);
    for (const l of LEVELS) start[l] = start[l].map((k) => [random(), k] as const).sort((p, q) => p[0] - q[0]).map(([, k]) => k);
    const tried = improve(start, score, preds, succs, o);
    if (tried.score < bestScore) ({ order: best, score: bestScore } = tried);
  }

  const at = place(best, o);
  const byKey = new Map(skills.map((s) => [s.key, s]));
  const boxes: LaidOutBox[] = [...at.entries()].map(([key, p]) => ({
    key,
    level: byKey.get(key)!.level,
    x: p.x,
    y: p.y,
    width: o.boxWidth,
    height: o.boxHeight,
  }));
  const arrows = arrowsOf(skills, at, o);
  const tallest = Math.max(...LEVELS.map((l) => best[l].length));
  return {
    boxes,
    arrows,
    columns: { 1: 0, 2: o.boxWidth + o.columnGap, 3: 2 * (o.boxWidth + o.columnGap), 4: 3 * (o.boxWidth + o.columnGap) },
    width: 4 * o.boxWidth + 3 * o.columnGap,
    height: o.top + tallest * (o.boxHeight + o.rowGap) - o.rowGap,
    crossings: countCrossings(arrows),
  };
}
