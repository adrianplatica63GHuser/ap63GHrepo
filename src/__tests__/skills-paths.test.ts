/**
 * A skills Path is everything it takes to reach its Expert skills.                            (Slice #39.50)
 *
 * On the real catalogue: every Expert skill's predecessors, all the way down, are in its Path; every skill
 * labelled with a Path is in it; the Properties Path holds skills of other Paths — Adrian's point: „there are
 * many boxes that belong to other topics which are absolutely necessary to be mastered”. And the arrows: a
 * head is always its line's colour, grey outside the Path, navy inside, and a hovered box's own arrows navy.
 */
import { SKILL_PATHS, SKILLS, type Skill } from "@/lib/skills/catalogue";
import { ARROW_GREY, ARROW_NAVY, arrowLook, inPath, PATH_SKILLS, pathSkillKeys } from "@/lib/skills/paths";

const byKey = new Map(SKILLS.map((s) => [s.key, s]));

function ancestors(key: string, seen = new Set<string>()): Set<string> {
  for (const p of byKey.get(key)?.predecessors ?? []) {
    if (seen.has(p)) continue;
    seen.add(p);
    ancestors(p, seen);
  }
  return seen;
}

describe("which skills make a Path — the real catalogue", () => {
  it.each(SKILL_PATHS.map((p) => [p.key]))("%s: every Expert skill of the Path, and everything it rests on, is in it", (path) => {
    const experts = SKILLS.filter((s) => s.path === path && s.level === 4);
    expect(experts.length).toBeGreaterThan(0);
    for (const e of experts) {
      expect(PATH_SKILLS[path].has(e.key)).toBe(true);
      for (const a of ancestors(e.key)) expect(PATH_SKILLS[path].has(a)).toBe(true);
    }
  });

  it.each(SKILL_PATHS.map((p) => [p.key]))("%s: every skill labelled with the Path is in it", (path) => {
    for (const s of SKILLS.filter((x) => x.path === path)) expect(PATH_SKILLS[path].has(s.key)).toBe(true);
  });

  it.each(SKILL_PATHS.map((p) => [p.key]))("%s: nothing else — each skill is labelled with the Path or leads to one of its Expert skills", (path) => {
    const experts = SKILLS.filter((s) => s.path === path && s.level === 4).map((s) => s.key);
    const needed = new Set(experts.flatMap((e) => [e, ...ancestors(e)]));
    for (const k of PATH_SKILLS[path]) expect(byKey.get(k)!.path === path || needed.has(k)).toBe(true);
  });

  it("the Properties Path holds skills of other Paths — the ones its Expert skills rest on", () => {
    const others = [...PATH_SKILLS.properties].map((k) => byKey.get(k)!).filter((s) => s.path !== "properties");
    expect(others.length).toBeGreaterThan(0);
    expect(new Set(others.map((s) => s.path)).size).toBeGreaterThan(0);
  });

  it("no Path is the whole catalogue — choosing one still fades something", () => {
    for (const p of SKILL_PATHS) expect(PATH_SKILLS[p.key].size).toBeLessThan(SKILLS.length);
  });

  it("„Toate traseele” — no Path chosen — keeps every skill", () => {
    for (const s of SKILLS) expect(inPath(s.key, null)).toBe(true);
  });
});

describe("pathSkillKeys on a small graph", () => {
  const sk = (key: string, level: 1 | 2 | 3 | 4, path: Skill["path"], predecessors: string[] = []): Skill => ({
    key,
    number: key,
    level,
    path,
    name: { ro: key, en: key },
    description: { ro: key, en: key },
    predecessors,
    screens: [],
    cases: [],
    manual: [],
  });
  const graph = [
    sk("b1", 1, "persons"),
    sk("b2", 1, "workspace"),
    sk("b3", 1, "documents"),
    sk("i1", 2, "documents", ["b1", "b2"]),
    sk("a1", 3, "properties", ["i1"]),
    sk("a2", 3, "properties", ["b3"]), // labelled, leads to no Expert skill
    sk("e1", 4, "properties", ["a1", "b1"]),
  ];

  it("the Expert skill, its predecessors transitively, and the Path's own skills — nothing more", () => {
    expect([...pathSkillKeys("properties", graph)].sort()).toEqual(["a1", "a2", "b1", "b2", "e1", "i1"]);
  });

  it("a predecessor the catalogue does not have is skipped", () => {
    const g = [sk("e", 4, "links", ["gone"])];
    expect([...pathSkillKeys("links", g)]).toEqual(["e"]);
  });

  it("a Path with no Expert skill is its labelled skills", () => {
    expect([...pathSkillKeys("documents", graph)].sort()).toEqual(["b3", "i1"]);
  });
});

describe("the arrows — a head is its line's colour", () => {
  const cases = [
    // kept, focused, lit → colour, head
    [true, false, false, ARROW_NAVY, "navy"],
    [false, false, false, ARROW_GREY, "grey"],
    [true, true, true, ARROW_NAVY, "navy"],
    [false, true, true, ARROW_NAVY, "navy"], // a hovered box's own arrows come forward, inside the Path or not
    [true, true, false, ARROW_NAVY, "navy"],
    [false, true, false, ARROW_GREY, "grey"],
  ] as const;

  it.each(cases)("kept %s, focused %s, lit %s: %s, head %s", (kept, focused, lit, colour, head) => {
    const look = arrowLook({ kept, focused, lit });
    expect(look.colour).toBe(colour);
    expect(look.head).toBe(head);
    expect(look.head === "navy" ? ARROW_NAVY : ARROW_GREY).toBe(look.colour);
  });

  it("an arrow outside the Path is never navy, unless its box is hovered", () => {
    expect(arrowLook({ kept: false, focused: false, lit: false }).colour).not.toBe(ARROW_NAVY);
    expect(arrowLook({ kept: false, focused: true, lit: false }).colour).not.toBe(ARROW_NAVY);
  });

  it("a hovered box's own arrows are drawn strongest", () => {
    const lit = arrowLook({ kept: true, focused: true, lit: true });
    for (const other of [arrowLook({ kept: true, focused: false, lit: false }), arrowLook({ kept: false, focused: false, lit: false })]) {
      expect(lit.opacity).toBeGreaterThan(other.opacity);
      expect(lit.width).toBeGreaterThan(other.width);
    }
  });
});
