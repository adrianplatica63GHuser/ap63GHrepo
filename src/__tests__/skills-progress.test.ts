/**
 * The skills' progress — Adrian's rules, each a test.                                       (Slice #39.41)
 *
 * src/lib/skills/progress.ts computes every state from the stored attempts. These tests pin each rule on small
 * graphs built for the purpose, rebuild the three impossible states of the request's picture and show the
 * rules cannot produce them, and then walk the real catalogue through many random histories checking that
 * nothing the rules forbid ever appears.
 *
 * #39.55 replaced the Obsolete rule, and these tests with it — inverted in place, so the rule has one home. 39.41's
 * rule was „When a skill is Mastered, every predecessor becomes OBSOLETE … applied all the way down”. Adrian's
 * (2026-10-15): „If a skill is mastered then all the arrows that point to that skill disappear”; „If a skill does
 * not have any more arrows originating from itself … then make that skill obsolete; that's the only case when a
 * skill becomes obsolete”.
 */
import { SKILLS, SKILL_PATHS, type Skill, type SkillLevel, type SkillPathKey } from "@/lib/skills/catalogue";
import {
  RETRY_HOURS,
  arrowShown,
  computeProgress,
  formatRetryAt,
  isPass,
  passMark,
  skillProgress,
  type AttemptRecord,
  type Progress,
  type SkillState,
} from "@/lib/skills/progress";

const HOUR = 3_600_000;
const T0 = new Date("2026-10-15T12:00:00Z");
const at = (hours: number) => new Date(T0.getTime() + hours * HOUR);

function mk(key: string, level: SkillLevel, predecessors: string[] = [], path: SkillPathKey = "persons", number = key): Skill {
  return {
    key,
    number,
    level,
    path,
    name: { ro: key, en: key },
    description: { ro: key, en: key },
    predecessors,
    screens: [],
    cases: [],
    manual: [],
  };
}

const pass = (skillKey: string, hours = 0): AttemptRecord => ({ skillKey, passed: true, finishedAt: at(hours) });
const fail = (skillKey: string, hours = 0): AttemptRecord => ({ skillKey, passed: false, finishedAt: at(hours) });

function states(p: Progress): Record<string, SkillState> {
  return Object.fromEntries(p.skills.map((s) => [s.key, s.state]));
}
function stateOf(p: Progress, key: string): SkillState {
  const s = skillProgress(p, key);
  if (!s) throw new Error(`no skill ${key}`);
  return s.state;
}

describe("the pass mark — at least 80 %, ceil(0.8 × n)", () => {
  it.each([
    [10, 8],
    [5, 4],
    [1, 1],
    [3, 3],
    [7, 6],
    [9, 8],
    [12, 10],
    [20, 16],
  ])("%i questions: %i right pass", (n, mark) => {
    expect(passMark(n)).toBe(mark);
    expect(isPass(mark, n)).toBe(true);
    expect(isPass(mark - 1, n)).toBe(false);
  });

  it("is the same rule as migration_109's CHECK, 5 × correct ≥ 4 × n, for every quiz up to 100 questions", () => {
    for (let n = 1; n <= 100; n++) for (let c = 0; c <= n; c++) expect(isPass(c, n)).toBe(c * 5 >= n * 4);
  });

  it("refuses a quiz of no questions", () => {
    expect(() => passMark(0)).toThrow();
    expect(() => passMark(2.5)).toThrow();
  });
});

describe("Open and Closed", () => {
  const G = [mk("a", 1), mk("b", 1), mk("c", 2, ["a", "b"]), mk("d", 3, ["c"])];

  it("a skill with no predecessors is Open from the start; the rest are Closed", () => {
    expect(states(computeProgress([], T0, G))).toEqual({ a: "open", b: "open", c: "closed", d: "closed" });
  });

  it("every Basic skill of the real catalogue is Open from the start, and every other skill Closed", () => {
    const p = computeProgress([], T0);
    for (const s of SKILLS) expect({ key: s.key, state: stateOf(p, s.key) }).toEqual({ key: s.key, state: s.predecessors.length === 0 ? "open" : "closed" });
    expect(SKILLS.filter((s) => s.level === 1).every((s) => s.predecessors.length === 0)).toBe(true);
  });

  it("a skill opens only when EVERY predecessor is mastered — one of two is not enough", () => {
    expect(stateOf(computeProgress([pass("a")], T0, G), "c")).toBe("closed");
    expect(stateOf(computeProgress([pass("a"), pass("b", 1)], T0, G), "c")).toBe("open");
  });

  it("a failed quiz leaves a skill as it was", () => {
    expect(stateOf(computeProgress([fail("a")], T0, G), "a")).toBe("open");
    expect(stateOf(computeProgress([pass("a"), fail("b")], T0, G), "c")).toBe("closed");
  });

  it("a Closed skill's quiz is not available", () => {
    const c = skillProgress(computeProgress([], T0, G), "c")!;
    expect(c.quizAvailable).toBe(false);
  });
});

describe("Mastered and Obsolete", () => {
  it("passing the quiz makes a skill Mastered", () => {
    expect(stateOf(computeProgress([pass("a")], T0, [mk("a", 1)]), "a")).toBe("mastered");
  });

  // #39.55: was „when a skill is Mastered, every predecessor becomes Obsolete”. Here c is the only skill a and b lead
  // to, so mastering it removes every arrow out of both, and both are Obsolete under the new rule too.
  it("a skill whose every arrow out points to a mastered skill is Obsolete", () => {
    const G = [mk("a", 1), mk("b", 1), mk("c", 2, ["a", "b"])];
    expect(states(computeProgress([pass("a"), pass("b"), pass("c")], T0, G))).toEqual({ a: "obsolete", b: "obsolete", c: "mastered" });
  });

  // #39.55: was „all the way down”. A chain still ends this way, because each arrow out points to a done skill.
  it("a chain: each skill under a done one is Obsolete, the top one Mastered", () => {
    const G = [mk("a", 1), mk("b", 2, ["a"]), mk("c", 3, ["b"])];
    expect(states(computeProgress([pass("a"), pass("b", 1), pass("c", 2)], T0, G))).toEqual({ a: "obsolete", b: "obsolete", c: "mastered" });
  });

  // #39.55, INVERTED: was „Mastering 2.1 makes 1.1 Obsolete; 2.2 must stay Open” → { s11: "obsolete", … }. Now 1.1
  // still has an arrow to 2.2, which is not mastered, so 1.1 stays Mastered.
  it("a skill with two successors, one of them mastered, stays Mastered", () => {
    const G = [mk("s11", 1), mk("s21", 2, ["s11"]), mk("s22", 2, ["s11"])];
    expect(states(computeProgress([pass("s11"), pass("s21", 1)], T0, G))).toEqual({ s11: "mastered", s21: "mastered", s22: "open" });
    // …and once 2.2 is mastered too, no arrow leaves 1.1: Obsolete.
    expect(states(computeProgress([pass("s11"), pass("s21", 1), pass("s22", 2)], T0, G))).toEqual({ s11: "obsolete", s21: "mastered", s22: "mastered" });
  });

  it("a chain mastered only at its foot: nothing is Obsolete while the skill above is not mastered", () => {
    const G = [mk("a", 1), mk("b", 2, ["a"]), mk("c", 3, ["b"])];
    expect(states(computeProgress([pass("a")], T0, G))).toEqual({ a: "mastered", b: "open", c: "closed" });
    expect(states(computeProgress([pass("a"), pass("b", 1)], T0, G))).toEqual({ a: "obsolete", b: "mastered", c: "open" });
  });

  it("Ask first 1: an Obsolete skill counts as mastered — the arrows into it go, and its successors stay open", () => {
    // a → b → c and a → d. Mastering b and c: b loses its only arrow out (Obsolete), so the arrow a → b goes too; a
    // still leads to d, so a stays Mastered, and d, which needs only a, is Open.
    const G = [mk("a", 1), mk("b", 2, ["a"]), mk("c", 3, ["b"]), mk("d", 2, ["a"])];
    const p = computeProgress([pass("a"), pass("b", 1), pass("c", 2)], T0, G);
    expect(states(p)).toEqual({ a: "mastered", b: "obsolete", c: "mastered", d: "open" });
    expect(arrowShown(stateOf(p, "b"))).toBe(false);
    expect(arrowShown(stateOf(p, "d"))).toBe(true);
  });

  it("the top of a Path — a skill no arrow leaves — is never Obsolete", () => {
    const G = [mk("a", 3), mk("e", 4, ["a"])];
    expect(states(computeProgress([pass("a"), pass("e", 1)], T0, G))).toEqual({ a: "obsolete", e: "mastered" });
    expect(stateOf(computeProgress([pass("e")], T0, [mk("e", 4)]), "e")).toBe("mastered");
  });

  it("an Obsolete or Mastered skill offers no quiz", () => {
    const G = [mk("a", 1), mk("b", 2, ["a"])];
    const p = computeProgress([pass("a"), pass("b", 1)], T0, G);
    expect(skillProgress(p, "a")!.quizAvailable).toBe(false);
    expect(skillProgress(p, "b")!.quizAvailable).toBe(false);
  });

  // #39.55, Ask first 4: the case 39.41's „all the way down” existed for. Adrian's rule covers it: the new skill's only
  // arrow points to a mastered skill, so the arrow is gone and the skill is Obsolete.
  it("a revised catalogue that puts a new skill under a mastered one marks it Obsolete, not Open", () => {
    const before = [mk("a", 1), mk("b", 2, ["a"])];
    const after = [mk("a", 1), mk("new", 1), mk("b", 2, ["a", "new"])];
    const attempts = [pass("a"), pass("b", 1)];
    expect(stateOf(computeProgress(attempts, T0, before), "b")).toBe("mastered");
    expect(states(computeProgress(attempts, T0, after))).toEqual({ a: "obsolete", new: "obsolete", b: "mastered" });
  });
});

describe("the request's picture — three states the rules cannot produce", () => {
  // The picture's numbering, not the catalogue's: its 2.4 needs its 1.3 and 1.4, its 4.2 needs its 3.3, and its
  // 2.1 needs its 1.1. Rebuilt here as the picture draws them.
  const PICTURE = [
    mk("p11", 1),
    mk("p13", 1),
    mk("p14", 1),
    mk("p21", 2, ["p11"]),
    mk("p24", 2, ["p13", "p14"]),
    mk("p33", 3, ["p24"]),
    mk("p42", 4, ["p33"]),
  ];

  it("„2.4 Open with 1.3 and 1.4 not mastered” — 2.4 is Closed until both are", () => {
    expect(stateOf(computeProgress([], T0, PICTURE), "p24")).toBe("closed");
    expect(stateOf(computeProgress([pass("p13")], T0, PICTURE), "p24")).toBe("closed");
    expect(stateOf(computeProgress([pass("p14")], T0, PICTURE), "p24")).toBe("closed");
    expect(stateOf(computeProgress([pass("p13"), pass("p14")], T0, PICTURE), "p24")).toBe("open");
  });

  it("„4.2 Open with 3.3 not mastered” — 4.2 is Closed while 3.3 is not", () => {
    const upTo24 = [pass("p13"), pass("p14"), pass("p24", 1)];
    expect(stateOf(computeProgress(upTo24, T0, PICTURE), "p33")).toBe("open");
    expect(stateOf(computeProgress(upTo24, T0, PICTURE), "p42")).toBe("closed");
    expect(stateOf(computeProgress([...upTo24, fail("p33", 2)], T0, PICTURE), "p42")).toBe("closed");
    expect(stateOf(computeProgress([...upTo24, pass("p33", 2)], T0, PICTURE), "p42")).toBe("open");
  });

  it("„2.1 Mastered with 1.1 not Obsolete” — mastering 2.1 makes 1.1 Obsolete", () => {
    const p = computeProgress([pass("p11"), pass("p21", 1)], T0, PICTURE);
    expect(stateOf(p, "p21")).toBe("mastered");
    expect(stateOf(p, "p11")).toBe("obsolete");
  });
});

describe("when a skill was mastered (#39.42)", () => {
  it("is the first passed attempt, and stays when the skill becomes Obsolete", () => {
    const G = [mk("a", 1), mk("b", 2, ["a"])];
    const p = computeProgress([fail("a"), pass("a", 73), pass("b", 74)], at(80), G);
    expect(skillProgress(p, "a")).toMatchObject({ state: "obsolete", masteredAt: at(73) });
    expect(skillProgress(p, "b")).toMatchObject({ state: "mastered", masteredAt: at(74) });
  });
  it("is null for a skill never passed", () => {
    expect(skillProgress(computeProgress([fail("a")], at(1), [mk("a", 1)]), "a")!.masteredAt).toBeNull();
  });
});

describe("the arrows „Progresul meu” draws (#39.55)", () => {
  it("an arrow into a Mastered or Obsolete skill is gone; into an Open or Closed one it stays", () => {
    expect(arrowShown("mastered")).toBe(false);
    expect(arrowShown("obsolete")).toBe(false);
    expect(arrowShown("open")).toBe(true);
    expect(arrowShown("closed")).toBe(true);
    expect(arrowShown(undefined)).toBe(true);
  });

  it("the real catalogue: every Basic skill mastered, none is Obsolete — each still leads somewhere not mastered", () => {
    const p = computeProgress(SKILLS.filter((s) => s.level === 1).map((s) => pass(s.key)), T0);
    for (const s of SKILLS.filter((x) => x.level === 1)) expect({ key: s.key, state: stateOf(p, s.key) }).toEqual({ key: s.key, state: "mastered" });
  });

  it("the real catalogue, everything mastered: only the skills no arrow leaves stay Mastered", () => {
    const p = computeProgress(SKILLS.map((s) => pass(s.key)), T0);
    const leaves = new Set(SKILLS.map((s) => s.key).filter((k) => !SKILLS.some((x) => x.predecessors.includes(k))));
    for (const s of SKILLS) expect({ key: s.key, state: stateOf(p, s.key) }).toEqual({ key: s.key, state: leaves.has(s.key) ? "mastered" : "obsolete" });
  });
});

describe("the three days after a failed quiz", () => {
  const G = [mk("a", 1)];

  it(`a failed quiz opens again ${RETRY_HOURS} hours after it was taken, and says when`, () => {
    const attempts = [fail("a")];
    const during = skillProgress(computeProgress(attempts, at(RETRY_HOURS - 0.01), G), "a")!;
    expect(during).toMatchObject({ state: "open", quizAvailable: false, retryAt: at(RETRY_HOURS) });
    const after = skillProgress(computeProgress(attempts, at(RETRY_HOURS), G), "a")!;
    expect(after).toMatchObject({ state: "open", quizAvailable: true, retryAt: null });
  });

  it("counts from the LAST failed attempt", () => {
    const attempts = [fail("a"), fail("a", 80)];
    const s = skillProgress(computeProgress(attempts, at(100), G), "a")!;
    expect(s.retryAt).toEqual(at(80 + RETRY_HOURS));
    expect(s.attempts).toBe(2);
  });

  it("does not hold a skill that has since been mastered", () => {
    const s = skillProgress(computeProgress([fail("a"), pass("a", 73)], at(74), G), "a")!;
    expect(s).toMatchObject({ state: "mastered", retryAt: null, quizAvailable: false });
  });

  it("is per skill: a failure on one does not hold another", () => {
    const H = [mk("a", 1), mk("b", 1)];
    const p = computeProgress([fail("a")], at(1), H);
    expect(skillProgress(p, "b")!.quizAvailable).toBe(true);
  });

  it("is told in Toronto time, with the date and the hour", () => {
    // 18:30 UTC on 15 October is 14:30 in Toronto (EDT, UTC−4); on 1 December 19:00 UTC is 14:00 (EST, UTC−5).
    const october = new Date("2026-10-15T18:30:00Z");
    const december = new Date("2026-12-01T19:00:00Z");
    expect(formatRetryAt(october, "ro-RO")).toMatch(/15 octombrie 2026.*14:30/);
    expect(formatRetryAt(october, "en-GB")).toMatch(/15 October 2026.*14:30/);
    expect(formatRetryAt(december, "ro-RO")).toMatch(/1 decembrie 2026.*14:00/);
  });
});

describe("a Path's mastery", () => {
  const G = [
    mk("b1", 1, [], "links"),
    mk("i1", 2, ["b1"], "links"),
    mk("a1", 3, ["i1"], "links"),
    mk("a2", 3, ["i1"], "links"),
    mk("e1", 4, ["a1", "a2"], "links"),
  ];

  it("is mastered when all its Advanced and Expert skills are Mastered or Obsolete", () => {
    const climb = [pass("b1"), pass("i1", 1), pass("a1", 2), pass("a2", 3)];
    expect(computeProgress(climb, T0, G).paths.links).toBe(false);
    expect(computeProgress([...climb, pass("e1", 4)], T0, G).paths.links).toBe(true);
  });

  it("does not ask for its Basic and Intermediate skills — they are below what it requires", () => {
    // Every Advanced and Expert skill mastered or obsolete, whatever the lower ones say.
    const p = computeProgress([pass("a1"), pass("a2"), pass("e1")], T0, G);
    expect(p.paths.links).toBe(true);
  });

  it("names every Path of the catalogue, and none is mastered at the start", () => {
    const p = computeProgress([], T0);
    expect(Object.keys(p.paths).sort()).toEqual(SKILL_PATHS.map((x) => x.key).sort());
    expect(Object.values(p.paths).every((v) => v === false)).toBe(true);
  });
});

describe("attempts against keys, not numbers", () => {
  it("a renumbered skill keeps its attempts", () => {
    const before = [mk("k", 1, [], "persons", "1.5")];
    const after = [mk("k", 1, [], "persons", "1.9")];
    expect(stateOf(computeProgress([pass("k")], T0, before), "k")).toBe("mastered");
    expect(stateOf(computeProgress([pass("k")], T0, after), "k")).toBe("mastered");
  });

  it("an attempt for a skill the catalogue no longer has is ignored", () => {
    const G = [mk("a", 1), mk("b", 2, ["a", "gone"])];
    const p = computeProgress([pass("gone"), pass("a")], T0, G);
    expect(p.skills.map((s) => s.key)).toEqual(["a", "b"]);
    // „gone” no longer exists, so b waits only on a.
    expect(stateOf(p, "b")).toBe("open");
  });
});

describe("the real catalogue, walked through random histories", () => {
  /** A small deterministic generator, so a failure names a seed that reproduces it. */
  function rng(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 2 ** 32;
    };
  }

  const preds = new Map(SKILLS.map((s) => [s.key, s.predecessors]));
  const successors = new Map(SKILLS.map((s) => [s.key, SKILLS.filter((x) => x.predecessors.includes(s.key)).map((x) => x.key)]));

  it.each(Array.from({ length: 40 }, (_, i) => [i + 1]))("seed %i: nothing the rules forbid ever appears", (seed) => {
    const r = rng(seed);
    const attempts: AttemptRecord[] = [];
    let clock = 0;
    for (let step = 0; step < 200; step++) {
      const p = computeProgress(attempts, at(clock));
      const st = states(p);

      for (const s of SKILLS) {
        const done = (k: string) => st[k] === "mastered" || st[k] === "obsolete";
        // Open ⇒ every predecessor done; Closed ⇒ some predecessor not done.
        if (st[s.key] === "open") expect({ seed, step, key: s.key, predsDone: s.predecessors.every(done) }).toMatchObject({ predsDone: true });
        if (st[s.key] === "closed") expect({ seed, step, key: s.key, somePredOpen: !s.predecessors.every(done) }).toMatchObject({ somePredOpen: true });
        // #39.55, INVERTED: was „Mastered ⇒ every predecessor Obsolete; Obsolete ⇒ some successor done”. Now: Obsolete
        // ⇔ it has arrows out and every one points to a done skill; Mastered ⇒ every predecessor done, and some
        // arrow out still drawn (or none ever left it).
        const out = successors.get(s.key)!;
        const allOutGone = out.length > 0 && out.every(done);
        expect({ seed, step, key: s.key, obsolete: st[s.key] === "obsolete" }).toEqual({ seed, step, key: s.key, obsolete: allOutGone });
        if (st[s.key] === "mastered") expect({ seed, step, key: s.key, predsDone: preds.get(s.key)!.every(done) }).toMatchObject({ predsDone: true });
        // A Basic skill is never Closed.
        if (s.level === 1) expect({ seed, step, key: s.key, closed: st[s.key] === "closed" }).toMatchObject({ closed: false });
      }

      // Take one available quiz, as the server would allow it, and pass or fail it.
      const available = p.skills.filter((s) => s.quizAvailable);
      if (available.length === 0) {
        clock += RETRY_HOURS; // wait out every cooldown
        if (p.skills.every((s) => s.state === "mastered" || s.state === "obsolete")) break;
        continue;
      }
      const pick = available[Math.floor(r() * available.length)];
      attempts.push({ skillKey: pick.key, passed: r() < 0.6, finishedAt: at(clock) });
      clock += r() < 0.3 ? RETRY_HOURS + 1 : 1;
    }
  });
});
