/**
 * Slice #39.34 — every family's line can be followed: children under their own parents, each family's run on a
 * height of its own where it meets another's, every turn rounded, and „<Rol> pentru: <nume întreg>" in the boxes.
 * Adrian's picture (Correction.01.Inheritance.Tree) is the first fixture: the Dumitrescu girls stood under the
 * Voicus and the Stănescus, and their line ran along everyone else's.
 */
import fs from "node:fs";
import path from "node:path";

import { layoutTree, SLOT_W, type TreePerson, type TreeTie } from "@/lib/inheritance/layout";
import { CORNER_R, LANE_GAP, assignLanes, packRow, runPath, runSpan } from "@/lib/inheritance/placement";

const ROLE = { name: "R", converseName: null, converseNameMale: null, converseNameFemale: null };
let n = 0;
const P = (id: string, dateOfBirth: string | null = null): TreePerson => ({
  id, displayName: id, firstName: id, lastName: null, nickname: null, gender: null, dateOfBirth,
});
const T = (holder: string, k: string, other: string): TreeTie => {
  const [a, b] = [holder, other].sort();
  return { id: `t${++n}`, personIdA: a!, personIdB: b!, roleReadsAToB: holder === a, kinship: k, role: ROLE };
};
const couple = (a: string, b: string, kids: string[]) => [T(a, "SPOUSE", b), ...kids.flatMap((c) => [T(a, "PARENT", c), T(b, "PARENT", c)])];

/** No two runs of one gap on one height whose x-ranges meet (or come within LANE_GAP of each other). */
function overlaps(l: ReturnType<typeof layoutTree>): string[] {
  const bad: string[] = [];
  for (let i = 0; i < l.runs.length; i++) {
    for (let j = i + 1; j < l.runs.length; j++) {
      const [a, b] = [l.runs[i]!, l.runs[j]!];
      if (Math.abs(a.laneY - b.laneY) > 0.01) continue;
      const [a1, a2] = runSpan(a);
      const [b1, b2] = runSpan(b);
      if (b1 < a2 + LANE_GAP && a1 < b2 + LANE_GAP) bad.push(`${a.key} ~ ${b.key}`);
    }
  }
  return bad;
}

describe("packRow — the closest places that keep the order and a slot apart", () => {
  it("leaves places that already fit alone", () => {
    expect(packRow([0, 300, 900], [1, 1, 1], 200)).toEqual([0, 300, 900]);
  });
  it("pushes two that want the same place apart, evenly about it", () => {
    expect(packRow([100, 100], [1, 1], 200)).toEqual([0, 200]);
  });
  it("a light one gives way to a heavy one", () => {
    const [a, b] = packRow([100, 100], [1, 0.01], 200);
    expect(Math.abs(a! - 100)).toBeLessThan(5);
    expect(b! - a!).toBeCloseTo(200);
  });
});

describe("Adrian's picture: the Dumitrescus, the Stănescus, the Voicus and the Radus", () => {
  const people = [
    P("Victor", "1955-01-01"), P("Monica", "1957-01-01"), P("Florin", "1960-01-01"), P("Gabriela", "1962-01-01"),
    P("Bogdan", "1985-08-24"), P("Irina", "1990-12-13"), P("Cristina", "1988-02-01"), P("MariusS", "1984-01-17"),
    P("Bianca", "1990-10-17"), P("Razvan", "1985-03-11"), P("Alexandru", "1992-08-19"), P("Mihaela", "1997-05-06"),
    P("MariusR", "1996-08-13"), P("Raluca", "1997-10-07"),
    P("ElenaD", "2014-07-18"), P("CarlaD", "2017-10-08"), P("CarlaS", "2011-08-12"), P("ElenaS", "2012-12-12"), P("ElenaV", "2023-07-30"),
  ];
  const ties = [
    ...couple("Victor", "Monica", ["Bogdan", "Cristina"]),
    ...couple("Florin", "Gabriela", ["Bianca", "Alexandru", "MariusR"]),
    T("Monica", "SIBLING", "Gabriela"),
    ...couple("Bogdan", "Irina", ["ElenaD", "CarlaD"]),
    ...couple("Cristina", "MariusS", ["CarlaS", "ElenaS"]),
    ...couple("Bianca", "Razvan", ["ElenaV"]),
    T("Alexandru", "SPOUSE", "Mihaela"),
    T("MariusR", "SPOUSE", "Raluca"),
  ];
  const l = layoutTree(people, ties);
  const x = (id: string) => l.nodes.find((nd) => nd.id === id)!.x;

  it("Elena and Carla Dumitrescu stand under Bogdan and Irina — between them, not under the Voicus", () => {
    for (const c of ["ElenaD", "CarlaD"]) {
      expect(x(c)).toBeGreaterThanOrEqual(Math.min(x("Bogdan"), x("Irina")) - SLOT_W / 2);
      expect(x(c)).toBeLessThanOrEqual(Math.max(x("Bogdan"), x("Irina")) + SLOT_W / 2);
    }
    expect((x("ElenaD") + x("CarlaD")) / 2).toBeCloseTo((x("Bogdan") + x("Irina")) / 2, 0);
  });

  it("every couple's children are centred under the couple", () => {
    for (const [a, b, kids] of [["Cristina", "MariusS", ["CarlaS", "ElenaS"]], ["Bianca", "Razvan", ["ElenaV"]]] as const) {
      const m = kids.reduce((s, k) => s + x(k), 0) / kids.length;
      expect(m).toBeCloseTo((x(a) + x(b)) / 2, 0);
    }
  });

  it("no two families' runs lie on each other", () => {
    expect(overlaps(l)).toEqual([]);
    // One run per couple, each from between the two.
    const bd = l.runs.find((r) => r.parents.join("+") === "Bogdan+Irina")!;
    expect(bd.from.x).toBe((x("Bogdan") + x("Irina")) / 2);
    expect(bd.children.map((c) => c.id)).toEqual(["ElenaD", "CarlaD"]);
  });
});

describe("random seeded families", () => {
  /** A little LCG, so a failure is reproducible by its seed. */
  const rng = (seed: number) => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

  it.each(Array.from({ length: 40 }, (_, i) => [i + 1]))("seed %d: runs never overlap; a row keeps a slot between neighbours", (seed) => {
    const r = rng(seed);
    const people: TreePerson[] = [];
    const ties: TreeTie[] = [];
    let id = 0;
    const add = (year: number) => {
      const p = P(`s${seed}-${id++}`, `${year}-01-01`);
      people.push(p);
      return p.id;
    };
    const [a, b] = [add(1900), add(1902)];
    ties.push(T(a, "SPOUSE", b));
    let gen: [string, string][] = [[a, b]];
    for (let g = 1; g < 4 && gen.length; g++) {
      const next: [string, string][] = [];
      for (const [p, q] of gen) {
        const k = Math.floor(r() * 4);
        for (let i = 0; i < k; i++) {
          const c = add(1900 + g * 25 + i);
          ties.push(T(p, "PARENT", c), T(q, "PARENT", c));
          if (r() < 0.6) {
            const s = add(1900 + g * 25 + i);
            ties.push(T(c, "SPOUSE", s));
            next.push([c, s]);
          }
        }
      }
      gen = next;
    }
    const l = layoutTree(people, ties);
    expect(overlaps(l)).toEqual([]);
    const rows = new Map<string, number[]>();
    for (const nd of l.nodes) rows.set(`${nd.cluster}:${nd.generation}`, [...(rows.get(`${nd.cluster}:${nd.generation}`) ?? []), nd.x]);
    for (const xs of rows.values()) {
      xs.sort((p, q) => p - q);
      for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(SLOT_W - 1e-6);
    }
    // Every run's lane lies between its parents' row and its children's.
    for (const run of l.runs) for (const c of run.children) expect(run.from.y < run.laneY && run.laneY < c.y).toBe(true);
  });
});

describe("lanes", () => {
  it("runs that meet get different heights; runs that do not, the same", () => {
    expect(assignLanes([[0, 100], [50, 200], [300, 400]])).toEqual([0, 1, 0]);
    // Closer than LANE_GAP counts as meeting.
    expect(assignLanes([[0, 100], [100 + LANE_GAP - 1, 200]])).toEqual([0, 1]);
    expect(assignLanes([[0, 100], [100 + LANE_GAP, 200]])).toEqual([0, 0]);
  });
});

describe("runPath — every turn a quarter circle", () => {
  it("down, a turn, along the lane, a turn, down — the arcs of CORNER_R", () => {
    expect(runPath({ x: 0, y: 0 }, 50, { x: 100, y: 100 })).toBe(
      `M 0 0 V ${50 - CORNER_R} A ${CORNER_R} ${CORNER_R} 0 0 0 ${CORNER_R} 50 H ${100 - CORNER_R} A ${CORNER_R} ${CORNER_R} 0 0 1 100 ${50 + CORNER_R} V 100`,
    );
    // To the left: the sweeps swap.
    expect(runPath({ x: 100, y: 0 }, 50, { x: 0, y: 100 })).toContain(`A ${CORNER_R} ${CORNER_R} 0 0 1 ${100 - CORNER_R} 50`);
  });
  it("straight down when the child is under the start; a smaller turn when there is no room", () => {
    expect(runPath({ x: 10, y: 0 }, 50, { x: 10, y: 100 })).toBe("M 10 0 V 100");
    expect(runPath({ x: 0, y: 0 }, 50, { x: 4, y: 100 })).toContain("A 2 2");
  });
});

describe("„<Rol> pentru: <nume întreg>” in the boxes (Ask first 3 and 4)", () => {
  const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
  it("the words, in both languages", () => {
    expect(JSON.parse(read("messages", "ro-RO.json")).inheritance.tieFor).toBe("{role} pentru: {name}");
    expect(JSON.parse(read("messages", "en-GB.json")).inheritance.tieFor).toBe("{role} for: {name}");
  });
  it("the box writes the other's full name, as their own box heads it, and a cut line is whole in its tooltip", () => {
    const canvas = read("src", "components", "inheritance", "tree-canvas.tsx");
    expect(canvas).toContain('t("tieFor", { role: tie.word, name: byId.get(tie.other)!.displayName })');
    expect(canvas).not.toContain("${tie.word} — ${shortName(");
    expect(canvas).toContain("{fit(l, 11) !== l && <title>{l}</title>}");
  });
});
