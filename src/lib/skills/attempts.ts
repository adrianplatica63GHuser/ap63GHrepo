/**
 * The skills' progress on the server: reading a user's attempts, and recording one.          (Slice #39.41)
 *
 * `recordAttempt` is the ONE way an attempt is written. The quiz page's scoring (#39.43) calls it on the
 * server, with the questions asked, the answers given and whether each was right; it counts them and decides
 * the pass itself, so a browser can never claim one. It refuses an attempt the rules do not allow — a skill
 * that is Closed, Mastered or Obsolete, or one whose failed quiz is still in its 72 hours — with the reason,
 * and, for the last, when the quiz opens again.
 *
 * The rules are src/lib/skills/progress.ts; this file only reads and writes skill_attempt (migration_109).
 */
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { skillAttempt, type SkillAttemptItem } from "@/db/schema";
import { ANONYMOUS_USER_ID } from "@/lib/auth/current-user";
import { skillByKey } from "./catalogue";
import { computeProgress, isPass, skillProgress, type AttemptRecord, type Progress } from "./progress";

/** At most this many questions in one quiz — a guard against a malformed call, not a design limit. */
export const MAX_QUESTIONS = 100;

const VARIANT = /^[a-z0-9-]{1,40}$/;

export type RecordAttemptInput = {
  skillKey: string;
  quizVariant: string;
  items: readonly SkillAttemptItem[];
  startedAt: Date;
};

export type RecordAttemptRefusal =
  | { ok: false; code: "no-user" | "unknown-skill" | "invalid" | "closed" | "already-mastered" }
  | { ok: false; code: "cooling-down"; retryAt: Date };

export type RecordAttemptResult =
  | { ok: true; passed: boolean; correctCount: number; questionCount: number; progress: Progress }
  | RecordAttemptRefusal;

function usableUser(userId: string): boolean {
  return userId !== "" && userId !== ANONYMOUS_USER_ID;
}

/** A user's attempts, oldest first, as the rules need them. */
export async function listAttempts(userId: string): Promise<AttemptRecord[]> {
  const rows = await db
    .select({ skillKey: skillAttempt.skillKey, passed: skillAttempt.passed, finishedAt: skillAttempt.finishedAt })
    .from(skillAttempt)
    .where(eq(skillAttempt.userId, userId))
    .orderBy(asc(skillAttempt.finishedAt));
  return rows;
}

/** A user's progress now. */
export async function getProgress(userId: string, now: Date = new Date()): Promise<Progress> {
  return computeProgress(usableUser(userId) ? await listAttempts(userId) : [], now);
}

/** Whether the items are what a scored quiz hands over: a non-empty list of answered-or-not questions. */
export function validAttemptItems(items: unknown): items is SkillAttemptItem[] {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    items.length <= MAX_QUESTIONS &&
    items.every(
      (i) =>
        typeof i === "object" &&
        i !== null &&
        typeof (i as SkillAttemptItem).question === "string" &&
        (i as SkillAttemptItem).question.trim() !== "" &&
        ((i as SkillAttemptItem).answer === null || typeof (i as SkillAttemptItem).answer === "string") &&
        typeof (i as SkillAttemptItem).correct === "boolean",
    )
  );
}

/**
 * Record one finished quiz for `userId`, if the rules allow it now. `now` is passed in for the tests; the
 * stored `finished_at` is the database's own now().
 */
export async function recordAttempt(
  userId: string,
  input: RecordAttemptInput,
  now: Date = new Date(),
): Promise<RecordAttemptResult> {
  if (!usableUser(userId)) return { ok: false, code: "no-user" };
  if (!skillByKey(input.skillKey)) return { ok: false, code: "unknown-skill" };
  if (
    !VARIANT.test(input.quizVariant) ||
    !validAttemptItems(input.items) ||
    !(input.startedAt instanceof Date) ||
    Number.isNaN(input.startedAt.getTime()) ||
    input.startedAt > now
  ) {
    return { ok: false, code: "invalid" };
  }

  const before = skillProgress(computeProgress(await listAttempts(userId), now), input.skillKey);
  if (!before || before.state === "closed") return { ok: false, code: "closed" };
  if (before.state === "mastered" || before.state === "obsolete") return { ok: false, code: "already-mastered" };
  if (before.retryAt) return { ok: false, code: "cooling-down", retryAt: before.retryAt };

  const questionCount = input.items.length;
  const correctCount = input.items.filter((i) => i.correct).length;
  const passed = isPass(correctCount, questionCount);
  await db.insert(skillAttempt).values({
    userId,
    skillKey: input.skillKey,
    quizVariant: input.quizVariant,
    items: [...input.items],
    questionCount,
    correctCount,
    passed,
    startedAt: input.startedAt,
  });
  return { ok: true, passed, correctCount, questionCount, progress: await getProgress(userId, now) };
}

/** How many attempts a user has — what the reset script reports before it deletes. */
export async function countAttempts(userId: string, skillKey?: string): Promise<number> {
  const rows = await db
    .select({ id: skillAttempt.id })
    .from(skillAttempt)
    .where(skillKey ? and(eq(skillAttempt.userId, userId), eq(skillAttempt.skillKey, skillKey)) : eq(skillAttempt.userId, userId));
  return rows.length;
}
