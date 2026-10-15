/**
 * recordAttempt — the one way an attempt is written, and what it refuses.                     (Slice #39.41)
 *
 * The database is replaced by a list: the point here is the decisions recordAttempt makes before it writes —
 * the server counts the right answers and decides the pass, and an attempt the rules do not allow is refused
 * with its reason. The rules themselves are skills-progress.test.ts's.
 */
const stored: { skillKey: string; passed: boolean; finishedAt: Date; correctCount: number; questionCount: number }[] = [];
let clock = new Date("2026-10-15T12:00:00Z");

jest.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: async () => stored.map((r) => ({ skillKey: r.skillKey, passed: r.passed, finishedAt: r.finishedAt })),
        }),
      }),
    }),
    insert: () => ({
      values: async (v: { skillKey: string; passed: boolean; correctCount: number; questionCount: number }) => {
        stored.push({ ...v, finishedAt: clock });
      },
    }),
  },
}));
jest.mock("@/lib/auth/current-user", () => ({ ANONYMOUS_USER_ID: "anonymous" }));

import { recordAttempt, validAttemptItems } from "@/lib/skills/attempts";
import { RETRY_HOURS } from "@/lib/skills/progress";
import { SKILLS } from "@/lib/skills/catalogue";

const BASIC = SKILLS.find((s) => s.level === 1)!.key;
const INTERMEDIATE = SKILLS.find((s) => s.level === 2)!.key;
const USER = "00000000-0000-0000-0000-000000000001";

function quiz(right: number, of: number) {
  return Array.from({ length: of }, (_, i) => ({ question: `q${i + 1}`, answer: "a", correct: i < right }));
}

beforeEach(() => {
  stored.length = 0;
  clock = new Date("2026-10-15T12:00:00Z");
});

describe("validAttemptItems", () => {
  it("takes a list of questions, each answered or not, each right or wrong", () => {
    expect(validAttemptItems(quiz(3, 5))).toBe(true);
    expect(validAttemptItems([{ question: "q1", answer: null, correct: false }])).toBe(true);
  });
  it.each([
    ["no list", "x"],
    ["an empty list", []],
    ["a question with no id", [{ question: " ", answer: "a", correct: true }]],
    ["an answer that is not text", [{ question: "q1", answer: 3, correct: true }]],
    ["no verdict", [{ question: "q1", answer: "a" }]],
    ["more than a hundred questions", quiz(0, 101)],
  ])("refuses %s", (_what, items) => {
    expect(validAttemptItems(items)).toBe(false);
  });
});

describe("recordAttempt", () => {
  const start = () => new Date(clock.getTime() - 10 * 60_000);

  it("counts the right answers and decides the pass itself — 8 of 10 passes, 7 does not", async () => {
    const r = await recordAttempt(USER, { skillKey: BASIC, quizVariant: "a", items: quiz(8, 10), startedAt: start() }, clock);
    expect(r).toMatchObject({ ok: true, passed: true, correctCount: 8, questionCount: 10 });
    expect(stored).toHaveLength(1);
    stored.length = 0;
    const s = await recordAttempt(USER, { skillKey: BASIC, quizVariant: "a", items: quiz(7, 10), startedAt: start() }, clock);
    expect(s).toMatchObject({ ok: true, passed: false, correctCount: 7 });
  });

  it("returns the progress the attempt leads to", async () => {
    const r = await recordAttempt(USER, { skillKey: BASIC, quizVariant: "a", items: quiz(10, 10), startedAt: start() }, clock);
    if (!r.ok) throw new Error(r.code);
    expect(r.progress.skills.find((s) => s.key === BASIC)!.state).toBe("mastered");
  });

  it("refuses a Closed skill, and writes nothing", async () => {
    const r = await recordAttempt(USER, { skillKey: INTERMEDIATE, quizVariant: "a", items: quiz(10, 10), startedAt: start() }, clock);
    expect(r).toEqual({ ok: false, code: "closed" });
    expect(stored).toHaveLength(0);
  });

  it("refuses a skill already mastered", async () => {
    await recordAttempt(USER, { skillKey: BASIC, quizVariant: "a", items: quiz(10, 10), startedAt: start() }, clock);
    const r = await recordAttempt(USER, { skillKey: BASIC, quizVariant: "b", items: quiz(10, 10), startedAt: start() }, clock);
    expect(r).toEqual({ ok: false, code: "already-mastered" });
    expect(stored).toHaveLength(1);
  });

  it(`refuses a retry within ${RETRY_HOURS} hours of a failure, saying when it opens, and takes it after`, async () => {
    await recordAttempt(USER, { skillKey: BASIC, quizVariant: "a", items: quiz(2, 10), startedAt: start() }, clock);
    const failedAt = clock;
    clock = new Date(failedAt.getTime() + (RETRY_HOURS - 1) * 3_600_000);
    const early = await recordAttempt(USER, { skillKey: BASIC, quizVariant: "b", items: quiz(10, 10), startedAt: start() }, clock);
    expect(early).toEqual({ ok: false, code: "cooling-down", retryAt: new Date(failedAt.getTime() + RETRY_HOURS * 3_600_000) });
    clock = new Date(failedAt.getTime() + RETRY_HOURS * 3_600_000);
    const later = await recordAttempt(USER, { skillKey: BASIC, quizVariant: "b", items: quiz(10, 10), startedAt: start() }, clock);
    expect(later).toMatchObject({ ok: true, passed: true });
  });

  it("refuses no user, an unknown skill and a malformed quiz", async () => {
    const ok = { skillKey: BASIC, quizVariant: "a", items: quiz(8, 10), startedAt: start() };
    expect(await recordAttempt("anonymous", ok, clock)).toEqual({ ok: false, code: "no-user" });
    expect(await recordAttempt("", ok, clock)).toEqual({ ok: false, code: "no-user" });
    expect(await recordAttempt(USER, { ...ok, skillKey: "nu-exista" }, clock)).toEqual({ ok: false, code: "unknown-skill" });
    expect(await recordAttempt(USER, { ...ok, quizVariant: "Varianta A" }, clock)).toEqual({ ok: false, code: "invalid" });
    expect(await recordAttempt(USER, { ...ok, items: [] }, clock)).toEqual({ ok: false, code: "invalid" });
    expect(await recordAttempt(USER, { ...ok, startedAt: new Date(clock.getTime() + 60_000) }, clock)).toEqual({ ok: false, code: "invalid" });
    expect(stored).toHaveLength(0);
  });
});
