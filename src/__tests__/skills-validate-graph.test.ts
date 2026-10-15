/**
 * @jest-environment node
 *
 * The skills graph's rules, each on a small graph made by hand.                             (Slice #39.36)
 *
 * Every rule in `validate-graph.ts` has a graph here that breaks it and nothing else — so a red test names the rule
 * — plus a graph that keeps them all, the two arrows Adrian allows across a level (Basic → Advanced, Intermediate
 * → Expert), and the picture from his request as it is drawn, whose two shape errors are the ones he lists.
 */

import {
  skillGraphErrors,
  validateSkillGraph,
  type SkillGraph,
  type SkillGraphIssueCode,
  type SkillGraphNode,
} from "@/lib/skills/validate-graph";

const n = (key: string, number: string, predecessors: string[] = [], path = "p"): SkillGraphNode => ({
  key,
  number,
  level: Number(number.split(".")[0]),
  path,
  predecessors,
});

/** Keeps every rule: three Basic each opening two, two Intermediate, one Advanced, one Expert. */
function good(): SkillGraphNode[] {
  return [
    n("b1", "1.1"),
    n("b2", "1.2"),
    n("b3", "1.3"),
    n("i1", "2.1", ["b1", "b2"]),
    n("i2", "2.2", ["b2", "b3"]),
    n("a1", "3.1", ["i1", "i2", "b1"]),
    n("e1", "4.1", ["a1", "i2"]),
    n("a2", "3.2", ["b3", "i2"]),
  ];
}

const graph = (skills: SkillGraphNode[], paths = [{ key: "p" }]): SkillGraph => ({ paths, skills });
const codes = (g: SkillGraph) => validateSkillGraph(g).map((i) => i.code);
const issuesFor = (g: SkillGraph, code: SkillGraphIssueCode) => validateSkillGraph(g).filter((i) => i.code === code);

describe("a graph that keeps every rule", () => {
  it("has no issue at all", () => {
    expect(validateSkillGraph(graph(good()))).toEqual([]);
  });

  it("allows Basic → Advanced and Intermediate → Expert — „only one intermediate step”", () => {
    const g = graph(good());
    const a1 = g.skills.find((s) => s.key === "a1");
    const e1 = g.skills.find((s) => s.key === "e1");
    expect(a1?.predecessors).toContain("b1"); // Basic → Advanced
    expect(e1?.predecessors).toContain("i2"); // Intermediate → Expert
    expect(skillGraphErrors(g)).toEqual([]);
  });
});

describe("the arrows", () => {
  it("never go from Basic straight to Expert", () => {
    const skills = good().map((s) => (s.key === "e1" ? { ...s, predecessors: ["a1", "b3"] } : s));
    const found = issuesFor(graph(skills), "basic-to-expert");
    expect(found).toHaveLength(1);
    expect(found[0].keys).toEqual(["b3", "e1"]);
    expect(found[0].severity).toBe("error");
  });

  it("always go up at least one level — sideways and downwards are both refused", () => {
    const sideways = good().map((s) => (s.key === "i2" ? { ...s, predecessors: ["b2", "i1"] } : s));
    expect(issuesFor(graph(sideways), "arrow-not-upward").map((i) => i.keys)).toEqual([["i1", "i2"]]);
    const down = good().map((s) => (s.key === "i1" ? { ...s, predecessors: ["b1", "a1"] } : s));
    expect(issuesFor(graph(down), "arrow-not-upward").map((i) => i.keys)).toEqual([["a1", "i1"]]);
  });

  it("give a Basic skill no predecessor", () => {
    const skills = good().map((s) => (s.key === "b2" ? { ...s, predecessors: ["b1"] } : s));
    expect(codes(graph(skills))).toContain("arrow-not-upward");
  });

  it("point at skills that exist, each named once", () => {
    const unknown = good().map((s) => (s.key === "i1" ? { ...s, predecessors: ["b1", "b2", "nope"] } : s));
    expect(issuesFor(graph(unknown), "unknown-predecessor").map((i) => i.keys)).toEqual([["i1", "nope"]]);
    const twice = good().map((s) => (s.key === "i1" ? { ...s, predecessors: ["b1", "b2", "b1"] } : s));
    expect(issuesFor(graph(twice), "duplicate-predecessor").map((i) => i.keys)).toEqual([["i1", "b1"]]);
  });

  it("form no cycle", () => {
    // Levels are set by hand here, so the cycle is the only thing wrong with the arrows' direction… plus the
    // upward rule, which a cycle can never keep — both are reported.
    const skills: SkillGraphNode[] = [
      ...good(),
      { key: "x", number: "2.3", level: 2, path: "p", predecessors: ["b1", "y"] },
      { key: "y", number: "2.4", level: 2, path: "p", predecessors: ["b2", "x"] },
    ];
    const found = issuesFor(graph(skills), "cycle");
    expect(found).toHaveLength(1);
    expect(found[0].keys).toEqual(["x", "y", "x"]);
    expect(codes(graph(skills))).toContain("arrow-not-upward");
  });
});

describe("predecessors and successors", () => {
  it("every non-Basic skill has a predecessor", () => {
    const skills = good().map((s) => (s.key === "a2" ? { ...s, predecessors: [] } : s));
    expect(issuesFor(graph(skills), "no-predecessor").map((i) => i.keys)).toEqual([["a2"]]);
  });

  it("a single predecessor is the picture's first shape error", () => {
    const skills = good().map((s) => (s.key === "i1" ? { ...s, predecessors: ["b1"] } : s));
    const found = issuesFor(graph(skills), "single-predecessor");
    expect(found.map((i) => i.keys)).toEqual([["i1"]]);
    expect(found[0].severity).toBe("error");
  });

  it("more than three predecessors is a warning, not an error", () => {
    const skills = [...good(), n("b4", "1.4"), n("a3", "3.3", ["b1", "b2", "b3", "b4"])];
    // b4 now opens only a3 — keep it from tripping its own rule.
    skills.push(n("i3", "2.3", ["b4", "b1"]), n("a4", "3.4", ["i3", "i1"]));
    const g = graph(skills);
    const found = issuesFor(g, "too-many-predecessors");
    expect(found.map((i) => i.keys)).toEqual([["a3"]]);
    expect(found[0].severity).toBe("warning");
    expect(skillGraphErrors(g)).toEqual([]);
  });

  it("a Basic skill opening only one other is the picture's second shape error", () => {
    const skills = good().map((s) => (s.key === "a2" ? { ...s, predecessors: ["i1", "i2"] } : s));
    const found = issuesFor(graph(skills), "basic-feeds-too-few");
    expect(found.map((i) => i.keys)).toEqual([["b3"]]);
    expect(found[0].message).toContain("feeds 1");
  });

  it("an Intermediate skill that leads nowhere is a warning", () => {
    const skills = [...good(), n("i3", "2.3", ["b1", "b3"])];
    const found = issuesFor(graph(skills), "dead-end");
    expect(found.map((i) => i.keys)).toEqual([["i3"]]);
    expect(found[0].severity).toBe("warning");
  });

  it("every non-Basic skill traces back to a Basic one", () => {
    // Two Intermediate skills feeding each other and nothing Basic beneath them.
    const skills: SkillGraphNode[] = [
      ...good(),
      { key: "x", number: "3.3", level: 3, path: "p", predecessors: ["y", "z"] },
      { key: "y", number: "2.3", level: 2, path: "p", predecessors: ["missing-1", "missing-2"] },
      { key: "z", number: "2.4", level: 2, path: "p", predecessors: ["missing-3", "missing-4"] },
    ];
    const rootless = issuesFor(graph(skills), "no-basic-root").flatMap((i) => i.keys);
    expect(rootless.sort()).toEqual(["x", "y", "z"]);
  });
});

describe("Paths", () => {
  it("every skill belongs to a Path that exists", () => {
    const skills = good().map((s) => (s.key === "b1" ? { ...s, path: "elsewhere" } : s));
    expect(issuesFor(graph(skills), "unknown-path").map((i) => i.keys)).toEqual([["b1"]]);
  });

  it("every Path has an Advanced or Expert skill, since that is what mastering it means", () => {
    const skills = good().map((s) => (s.key === "b3" || s.key === "i2" ? { ...s, path: "q" } : s));
    const found = issuesFor(graph(skills, [{ key: "p" }, { key: "q" }]), "path-without-mastery");
    expect(found.map((i) => i.keys)).toEqual([["q"]]);
  });

  it("no Path is empty", () => {
    expect(issuesFor(graph(good(), [{ key: "p" }, { key: "unused" }]), "empty-path").map((i) => i.keys)).toEqual([
      ["unused"],
    ]);
  });
});

describe("keys, numbers and text", () => {
  it("keys are unique and kebab-case", () => {
    const skills = [...good(), n("b1", "1.4")];
    expect(codes(graph(skills))).toContain("duplicate-key");
    const bad = good().map((s) => (s.key === "b1" ? { ...s, key: "B_1" } : s));
    expect(issuesFor(graph(bad), "bad-key").map((i) => i.keys)).toEqual([["B_1"]]);
  });

  it("numbers are unique and read „<level>.<n>”", () => {
    const dup = good().map((s) => (s.key === "b2" ? { ...s, number: "1.1" } : s));
    expect(issuesFor(graph(dup), "duplicate-number").map((i) => i.keys)).toEqual([["b1", "b2"]]);
    const wrongLevel = good().map((s) => (s.key === "a2" ? { ...s, number: "2.9" } : s));
    expect(issuesFor(graph(wrongLevel), "bad-number").map((i) => i.keys)).toEqual([["a2"]]);
    const zero = good().map((s) => (s.key === "b1" ? { ...s, number: "1.0" } : s));
    expect(issuesFor(graph(zero), "bad-number").map((i) => i.keys)).toEqual([["b1"]]);
  });

  it("a level is 1 to 4", () => {
    const skills = [...good(), { key: "z", number: "5.1", level: 5, path: "p", predecessors: ["e1", "a1"] }];
    expect(codes(graph(skills))).toContain("bad-level");
  });

  it("a name and a description, when given, are written in both locales", () => {
    const skills = good().map((s) =>
      s.key === "b1" ? { ...s, name: { ro: "Ceva", en: " " }, description: { ro: "", en: "Something" } } : s,
    );
    const found = issuesFor(graph(skills), "missing-text").map((i) => i.message);
    expect(found).toEqual(["b1: no name in en.", "b1: no description in ro."]);
  });
});

describe("the picture in Adrian's request, as it is drawn", () => {
  // Another subject (Research, Data Literacy …), so only its shape is read. Its arrows, from the image: solid and
  // dashed alike, since dashed there means „not yet open”, a state (39.41), not a different kind of arrow.
  const picture = (): SkillGraphNode[] => [
    n("research", "1.1"),
    n("data-literacy", "1.2"),
    n("communication", "1.3"),
    n("problem-solving", "1.4"),
    n("project-mgmt", "1.5"),
    n("tools-tech", "1.6"),
    n("data-analysis", "2.1", ["research"]),
    n("storytelling", "2.2", ["research", "data-literacy"]),
    n("stakeholder-mgmt", "2.3", ["data-literacy", "communication"]),
    n("process-improvement", "2.4", ["communication", "problem-solving"]),
    n("advanced-excel", "2.5", ["project-mgmt"]),
    n("sql-basics", "2.6", ["project-mgmt", "tools-tech"]),
    n("analytics-strategy", "3.1", ["data-analysis", "stakeholder-mgmt"]),
    n("predictive-modeling", "3.2", ["storytelling", "stakeholder-mgmt"]),
    n("change-leadership", "3.3", ["stakeholder-mgmt", "process-improvement", "advanced-excel"]),
    n("ml-foundations", "3.4", ["advanced-excel", "sql-basics"]),
    n("ai-strategy", "4.1", ["analytics-strategy", "predictive-modeling"]),
    n("data-architecture", "4.2", ["analytics-strategy", "predictive-modeling", "change-leadership"]),
    n("enterprise-leadership", "4.3", ["predictive-modeling", "change-leadership"]),
    n("innovation-mgmt", "4.4", ["change-leadership", "ml-foundations"]),
  ];

  it("shows both of the shape errors Adrian lists, and no others", () => {
    const errors = skillGraphErrors(graph(picture()));
    expect(errors.map((e) => `${e.code}:${e.keys.join(",")}`).sort()).toEqual([
      "basic-feeds-too-few:problem-solving",
      "basic-feeds-too-few:tools-tech",
      "single-predecessor:advanced-excel",
      "single-predecessor:data-analysis",
    ]);
  });

  it("passes once each of those boxes gets a second arrow", () => {
    const fixed = picture().map((s) => {
      if (s.key === "data-analysis") return { ...s, predecessors: ["research", "problem-solving"] };
      if (s.key === "advanced-excel") return { ...s, predecessors: ["project-mgmt", "tools-tech"] };
      return s;
    });
    expect(skillGraphErrors(graph(fixed))).toEqual([]);
  });
});
