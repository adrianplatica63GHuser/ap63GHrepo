/**
 * The quizzes — their files, and how an attempt is drawn and scored.                (Slices #39.43, #39.44)
 *
 * Every quiz file is checked against Adrian's rules and the manual: multiple choice, exactly one correct
 * option, both languages, a question count within its level's range, at least two variants with no question
 * repeated, and every section id a section of the manual in both languages. Every skill of the catalogue
 * has its quiz and names the manual sections it rests on. And the browser is never handed an answer.
 */
import { SKILLS } from "@/lib/skills/catalogue";
import { manualTarget } from "@/lib/manual/manual";
import {
  QUESTIONS_PER_LEVEL,
  pickVariant,
  presentQuiz,
  quizProblems,
  scoreQuiz,
  seededRandom,
  shuffled,
  type QuizFile,
} from "@/lib/skills/quiz";
import { QUIZZES } from "@/lib/skills/quizzes";
import { isPass } from "@/lib/skills/progress";

const isSection = (id: string) => manualTarget("ro-RO", id)?.kind === "section" && manualTarget("en-GB", id)?.kind === "section";
const skill = (key: string) => SKILLS.find((s) => s.key === key)!;
const files = Object.values(QUIZZES);

describe("the quiz files", () => {
  it("every skill of the catalogue has its quiz (Basic #39.43, the rest #39.44), and every quiz is a skill", () => {
    expect(SKILLS.map((s) => s.key).filter((k) => !QUIZZES[k])).toEqual([]);
    for (const k of Object.keys(QUIZZES)) expect({ k, known: !!SKILLS.find((s) => s.key === k) }).toEqual({ k, known: true });
  });

  it.each(files.map((q) => [q.skill, q] as const))("%s: sound — one correct option each, both languages, sections that exist", (_k, q) => {
    expect(quizProblems(q, skill(q.skill).level, isSection)).toEqual([]);
  });

  it.each(files.map((q) => [q.skill, q] as const))("%s: its questions per variant are within its level's range", (_k, q) => {
    const [lo, hi] = QUESTIONS_PER_LEVEL[skill(q.skill).level];
    for (const v of q.variants) {
      expect(v.questions.length).toBeGreaterThanOrEqual(lo);
      expect(v.questions.length).toBeLessThanOrEqual(hi);
    }
  });

  // #39.44: a quiz whose right answer is usually the longest one can be passed without reading the manual. With
  // three or four options, chance makes it the strictly longest a quarter to a third of the time.
  it.each(files.map((q) => [q.skill, q] as const))("%s: the right option is not usually the longest one, in either language", (_k, q) => {
    for (const lang of ["ro", "en"] as const) {
      const questions = q.variants.flatMap((v) => v.questions);
      const longest = questions.filter((x) => {
        const lengths = x.options.map((o) => o[lang].length);
        const right = lengths[x.options.findIndex((o) => o.correct)];
        return lengths.filter((l) => l >= right).length === 1;
      }).length;
      const share = Math.round((100 * longest) / questions.length);
      // On a failure this prints the language and the share, in per cent.
      expect({ lang, over50: share > 50 ? share : 0 }).toEqual({ lang, over50: 0 });
    }
  });

  it.each(files.map((q) => [q.skill, q] as const))("%s: the catalogue's sections for the skill are the quiz file's", (_k, q) => {
    expect(skill(q.skill).manual).toEqual(q.manual);
  });
});

describe("every skill names the manual sections it rests on", () => {
  it.each(SKILLS.map((s) => [`${s.number} ${s.key}`, s] as const))("%s", (_n, s) => {
    expect(s.manual.length).toBeGreaterThanOrEqual(1);
    expect(s.manual.length).toBeLessThanOrEqual(5);
    for (const id of s.manual) expect({ id, section: isSection(id) }).toEqual({ id, section: true });
  });
});

describe("drawing an attempt", () => {
  const quiz = files[0];

  it("hands the browser no answer — not a word of which option is right", () => {
    const shown = presentQuiz(quiz, quiz.variants[0], "ro", seededRandom(1));
    expect(JSON.stringify(shown)).not.toMatch(/correct|explanation/);
    for (const q of shown.questions) for (const o of q.options) expect(Object.keys(o).sort()).toEqual(["id", "text"]);
  });

  it("shuffles questions and options, and keeps every one of them", () => {
    const v = quiz.variants[0];
    const a = presentQuiz(quiz, v, "ro", seededRandom(1));
    const b = presentQuiz(quiz, v, "ro", seededRandom(99));
    expect(a.questions.map((q) => q.id).sort()).toEqual(v.questions.map((q) => q.id).sort());
    const orders = new Set([a, b].map((x) => x.questions.map((q) => q.id + q.options.map((o) => o.id).join("")).join("|")));
    expect(orders.size).toBe(2);
  });

  it("speaks the language asked for", () => {
    const v = quiz.variants[0];
    const en = presentQuiz(quiz, v, "en", seededRandom(3));
    const q = en.questions[0];
    expect(q.text).toBe(v.questions.find((x) => x.id === q.id)!.en.question);
  });

  it("takes a variant other than the last one (Ask first 2)", () => {
    const two: QuizFile = { ...quiz, variants: quiz.variants.slice(0, 2) };
    for (let seed = 1; seed < 30; seed++) expect(pickVariant(two, two.variants[0].id, seededRandom(seed)).id).toBe(two.variants[1].id);
    expect(two.variants.map((v) => v.id)).toContain(pickVariant(two, null, seededRandom(5)).id);
  });

  it("shuffled keeps every item", () => {
    expect(shuffled([1, 2, 3, 4, 5], seededRandom(7)).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("scoring", () => {
  const v = files[0].variants[0];
  const right = Object.fromEntries(v.questions.map((q) => [q.id, q.options.find((o) => o.correct)!.id]));
  const wrong = Object.fromEntries(v.questions.map((q) => [q.id, q.options.find((o) => !o.correct)!.id]));

  it("all right: every item correct, nothing to read again", () => {
    const s = scoreQuiz(v, right, "ro");
    expect(s.items.every((i) => i.correct)).toBe(true);
    expect(s.readAgain).toEqual([]);
    expect(isPass(s.items.filter((i) => i.correct).length, s.items.length)).toBe(true);
  });

  it("all wrong: every item wrong, and each wrong question's section to read again, once", () => {
    const s = scoreQuiz(v, wrong, "ro");
    expect(s.items.every((i) => !i.correct)).toBe(true);
    expect(s.readAgain).toEqual([...new Set(v.questions.map((q) => q.section))]);
  });

  it("an unanswered question, or an option it does not have, counts as wrong", () => {
    const q0 = v.questions[0].id;
    const s = scoreQuiz(v, { ...right, [q0]: null }, "ro");
    expect(s.items.find((i) => i.question === q0)).toEqual({ question: q0, answer: null, correct: false });
    const t = scoreQuiz(v, { ...right, [q0]: "o9" }, "ro");
    expect(t.items.find((i) => i.question === q0)!.correct).toBe(false);
  });

  it("one item per question, in the file's order", () => {
    expect(scoreQuiz(v, right, "ro").items.map((i) => i.question)).toEqual(v.questions.map((q) => q.id));
  });
});
