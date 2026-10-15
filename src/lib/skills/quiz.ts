/**
 * A skill's quiz — its file's shape, what the browser is shown, and how it is scored.        (Slice #39.43)
 *
 * Adrian's rules: multiple choice; 5 to 15 questions (by level, Ask first 1: Basic 5–8, Intermediate 8–10,
 * Advanced 10–12, Expert 12–15); at least 80 % to pass; several variants of one skill's quiz; a failed quiz waits
 * three days. The pass mark, the wait and the states are 39.41's (progress.ts); this file is the quiz itself.
 *
 * THE ANSWERS STAY ON THE SERVER. A quiz file (src/lib/skills/quizzes/<key>.json) holds the correct option of
 * every question; `presentQuiz` gives the browser the questions and options WITHOUT it, shuffled; the browser
 * sends back an option id per question; `scoreQuiz` marks them against the file. A browser never learns which
 * option was right before it has sent its answers, and the score is never its own.
 *
 * PURE MODULE — no React, no DB. The files are read by quizzes/index.ts, on the server only.
 */
import type { SkillAttemptItem } from "@/db/schema";
import type { SkillLevel } from "./catalogue";

export type QuizLang = "ro" | "en";

export type QuizOption = { id: string; correct: boolean; ro: string; en: string };

export type QuizQuestion = {
  id: string;
  /** The manual section the answer comes from — where a user who got it wrong reads again. */
  section: string;
  ro: { question: string; explanation: string };
  en: { question: string; explanation: string };
  options: QuizOption[];
};

export type QuizVariant = { id: string; questions: QuizQuestion[] };

export type QuizFile = {
  skill: string;
  /** The sections the skill rests on, most important first — the catalogue's `manual` comes from here for Basic skills. */
  manual: string[];
  variants: QuizVariant[];
};

/** Questions per variant, by level (Ask first 1). */
export const QUESTIONS_PER_LEVEL: Readonly<Record<SkillLevel, readonly [number, number]>> = {
  1: [5, 8],
  2: [8, 10],
  3: [10, 12],
  4: [12, 15],
};

/** What the browser is shown: the questions and options in the order drawn, and nothing about which is right. */
export type PresentedQuiz = {
  skill: string;
  variant: string;
  questions: { id: string; text: string; options: { id: string; text: string }[] }[];
};

/** A seeded generator, so one attempt's order can be reproduced in a test. */
export function seededRandom(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

/** A shuffled copy (Fisher–Yates). */
export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Which variant the next attempt takes (Ask first 2): one other than the last one taken, when there is another;
 * among those, any.
 */
export function pickVariant(quiz: QuizFile, lastVariant: string | null, random: () => number): QuizVariant {
  const others = quiz.variants.filter((v) => v.id !== lastVariant);
  const pool = others.length > 0 ? others : quiz.variants;
  return pool[Math.floor(random() * pool.length)];
}

/** The variant, in the given language, questions and options shuffled, with no option marked right. */
export function presentQuiz(quiz: QuizFile, variant: QuizVariant, lang: QuizLang, random: () => number): PresentedQuiz {
  return {
    skill: quiz.skill,
    variant: variant.id,
    questions: shuffled(variant.questions, random).map((q) => ({
      id: q.id,
      text: q[lang].question,
      options: shuffled(q.options, random).map((o) => ({ id: o.id, text: o[lang] })),
    })),
  };
}

export type ScoredQuiz = {
  /** One per question of the variant, in the file's order — what 39.41's recordAttempt stores. */
  items: SkillAttemptItem[];
  /** The sections of the questions answered wrong (or not at all), each once, in the file's order. */
  readAgain: string[];
  /** Per question: its explanation and section, and the right option — shown only after a pass. */
  explanations: { question: string; text: string; explanation: string; section: string; answer: string }[];
};

/**
 * Mark the answers — question id → option id, or nothing — against the variant. An answer naming an option the
 * question does not have counts as wrong, the same as no answer.
 */
export function scoreQuiz(variant: QuizVariant, answers: Readonly<Record<string, string | null | undefined>>, lang: QuizLang): ScoredQuiz {
  const items: SkillAttemptItem[] = [];
  const readAgain: string[] = [];
  const explanations: ScoredQuiz["explanations"] = [];
  for (const q of variant.questions) {
    const given = answers[q.id] ?? null;
    const chosen = given === null ? undefined : q.options.find((o) => o.id === given);
    const correct = chosen?.correct === true;
    items.push({ question: q.id, answer: chosen ? chosen.id : null, correct });
    if (!correct && !readAgain.includes(q.section)) readAgain.push(q.section);
    explanations.push({
      question: q.id,
      text: q[lang].question,
      explanation: q[lang].explanation,
      section: q.section,
      answer: q.options.find((o) => o.correct)![lang],
    });
  }
  return { items, readAgain, explanations };
}

/** Everything wrong with a quiz file, as sentences; [] when it is sound. `isSection` says whether an id is one. */
export function quizProblems(quiz: QuizFile, level: SkillLevel, isSection: (id: string) => boolean): string[] {
  const p: string[] = [];
  const [lo, hi] = QUESTIONS_PER_LEVEL[level];
  if (quiz.manual.length < 1) p.push("names no manual section");
  for (const m of quiz.manual) if (!isSection(m)) p.push(`manual: „${m}” is not a section`);
  if (quiz.variants.length < 2) p.push("has fewer than two variants");
  const vids = new Set<string>();
  const qids = new Set<string>();
  const texts = new Map<string, string>();
  for (const v of quiz.variants) {
    if (vids.has(v.id)) p.push(`variant „${v.id}” twice`);
    vids.add(v.id);
    if (v.questions.length < lo || v.questions.length > hi) p.push(`variant ${v.id}: ${v.questions.length} questions, outside ${lo}–${hi}`);
    for (const q of v.questions) {
      const w = `${v.id}/${q.id}`;
      if (qids.has(q.id)) p.push(`${w}: question id twice`);
      qids.add(q.id);
      if (!isSection(q.section)) p.push(`${w}: „${q.section}” is not a section`);
      for (const l of ["ro", "en"] as const) {
        if (!q[l]?.question?.trim() || !q[l]?.explanation?.trim()) p.push(`${w}: no ${l} question or explanation`);
        for (const o of q.options) if (!o[l]?.trim()) p.push(`${w}/${o.id}: no ${l} text`);
      }
      const t = q.ro.question.trim().toLowerCase();
      if (texts.has(t)) p.push(`${w}: the same question as ${texts.get(t)}`);
      texts.set(t, w);
      if (q.options.length < 3 || q.options.length > 4) p.push(`${w}: ${q.options.length} options, not 3–4`);
      if (q.options.filter((o) => o.correct).length !== 1) p.push(`${w}: not exactly one correct option`);
      if (new Set(q.options.map((o) => o.id)).size !== q.options.length) p.push(`${w}: an option id twice`);
      if (/[şţŞŢ]/.test(JSON.stringify(q))) p.push(`${w}: a cedilla ş/ţ`);
    }
  }
  return p;
}
