/**
 * The skills' progress — one rule set, computed from the quiz attempts.                     (Slice #39.41)
 *
 * Adrian's rules (Diagram.of.skills.docx, 2026-10-14), each pinned by src/__tests__/skills-progress.test.ts:
 *
 *   - A skill with no predecessors — every Basic skill — is OPEN from the start.
 *   - A skill is OPEN when every predecessor is Mastered or Obsolete; otherwise it is CLOSED, and its quiz is
 *     not available.
 *   - Passing its quiz — at least 80 %: ceil(0.8 × n) right out of n, 8 of 10 — makes it MASTERED.
 *   - When a skill is Mastered, every predecessor becomes OBSOLETE. Obsolete is mastered-and-superseded (Ask
 *     first 1): it still counts as mastered for its other successors, or mastering 2.1 would close 2.2 again
 *     whenever both need 1.1. It is applied all the way down: a skill whose successor is Mastered or Obsolete is
 *     Obsolete itself, so a revised catalogue that adds a level under a mastered skill cannot open it again.
 *   - A failed quiz cannot be taken again for 72 hours from the failed attempt (Ask first 3); the user is told
 *     the date and hour it opens again, in Toronto time.
 *   - A PATH is mastered when all its Advanced and Expert skills are Mastered or Obsolete.
 *
 * Nothing here is stored: the attempts are (migration_109), and everything else is worked out from them each
 * time, so a revised catalogue never leaves a stale state behind. An attempt is stored against a skill's KEY,
 * which never changes — a renumbered skill keeps its attempts, and an attempt for a key the catalogue no longer
 * has is ignored.
 *
 * PURE MODULE — no React, no DB, no clock: `now` is passed in.
 */
import { SKILL_PATHS, SKILLS, type Skill, type SkillPathKey } from "./catalogue";

export type SkillState = "closed" | "open" | "mastered" | "obsolete";

/** What progress needs of one stored attempt. */
export type AttemptRecord = {
  skillKey: string;
  passed: boolean;
  finishedAt: Date;
};

export type SkillProgress = {
  key: string;
  state: SkillState;
  /** True when the quiz can be taken now: the skill is Open and no failed attempt is still cooling down. */
  quizAvailable: boolean;
  /** When the last failed attempt's 72 hours end, while they have not; otherwise null. */
  retryAt: Date | null;
  /** How many attempts this skill has, passed or not. */
  attempts: number;
  /** When its quiz was first passed (#39.42 shows it); null for a skill never passed — an Obsolete one included. */
  masteredAt: Date | null;
};

export type Progress = {
  skills: SkillProgress[];
  /** Path key → mastered. */
  paths: Record<SkillPathKey, boolean>;
};

/** The pass mark: ceil(0.8 × n). 8 of 10, 4 of 5, 1 of 1. */
export const PASS_FRACTION = 0.8;

/** The wait after a failed quiz, in hours. */
export const RETRY_HOURS = 72;

/** The time zone the retry time is told in — the business's, not the browser's. */
export const RETRY_TIME_ZONE = "America/Toronto";

/** How many right answers out of `questionCount` pass. Integer arithmetic: 5 × c ≥ 4 × n, as migration_109's CHECK. */
export function passMark(questionCount: number): number {
  if (!Number.isInteger(questionCount) || questionCount <= 0) throw new Error(`A quiz has a whole, positive number of questions, not ${questionCount}.`);
  return Math.ceil((questionCount * 4) / 5);
}

/** Whether `correct` out of `questionCount` passes. */
export function isPass(correct: number, questionCount: number): boolean {
  return correct >= passMark(questionCount);
}

/** Every skill the given skill depends on, directly or through others. */
function ancestors(key: string, byKey: ReadonlyMap<string, Skill>, seen = new Set<string>()): Set<string> {
  for (const p of byKey.get(key)?.predecessors ?? []) {
    if (seen.has(p) || !byKey.has(p)) continue;
    seen.add(p);
    ancestors(p, byKey, seen);
  }
  return seen;
}

/**
 * The states of every skill in `skills`, from `attempts`, at `now`. `skills` defaults to the catalogue; the
 * tests pass small graphs of their own.
 */
export function computeProgress(
  attempts: readonly AttemptRecord[],
  now: Date,
  skills: readonly Skill[] = SKILLS,
): Progress {
  const byKey = new Map(skills.map((s) => [s.key, s]));
  const known = attempts.filter((a) => byKey.has(a.skillKey));

  const passed = new Set(known.filter((a) => a.passed).map((a) => a.skillKey));
  const obsolete = new Set<string>();
  for (const k of passed) for (const a of ancestors(k, byKey)) obsolete.add(a);
  const done = (k: string) => passed.has(k) || obsolete.has(k);

  const result: SkillProgress[] = skills.map((s) => {
    const mine = known.filter((a) => a.skillKey === s.key);
    let state: SkillState;
    if (obsolete.has(s.key)) state = "obsolete";
    else if (passed.has(s.key)) state = "mastered";
    else if (s.predecessors.filter((p) => byKey.has(p)).every(done)) state = "open";
    else state = "closed";

    let retryAt: Date | null = null;
    if (state === "open") {
      const lastFailed = mine
        .filter((a) => !a.passed)
        .reduce<AttemptRecord | null>((latest, a) => (!latest || a.finishedAt > latest.finishedAt ? a : latest), null);
      if (lastFailed) {
        const opens = new Date(lastFailed.finishedAt.getTime() + RETRY_HOURS * 3_600_000);
        if (opens > now) retryAt = opens;
      }
    }
    const firstPass = mine
      .filter((a) => a.passed)
      .reduce<Date | null>((first, a) => (!first || a.finishedAt < first ? a.finishedAt : first), null);
    return { key: s.key, state, quizAvailable: state === "open" && retryAt === null, retryAt, attempts: mine.length, masteredAt: firstPass };
  });

  const paths = Object.fromEntries(
    SKILL_PATHS.map((p) => {
      const high = skills.filter((s) => s.path === p.key && s.level >= 3);
      return [p.key, high.length > 0 && high.every((s) => done(s.key))];
    }),
  ) as Record<SkillPathKey, boolean>;

  return { skills: result, paths };
}

/** One skill's progress out of a computed whole; undefined for a key the catalogue does not have. */
export function skillProgress(progress: Progress, key: string): SkillProgress | undefined {
  return progress.skills.find((s) => s.key === key);
}

/**
 * The retry time as the user is told it: the date and the hour, in Toronto time, in the application's language.
 * „15 octombrie 2026, 14:30” / „15 October 2026, 14:30”.
 */
export function formatRetryAt(at: Date, locale: "ro-RO" | "en-GB"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: RETRY_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}
