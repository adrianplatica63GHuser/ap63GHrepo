/**
 * The quizzes on the server: drawing one for a user, and naming manual sections as links.     (Slice #39.43)
 *
 * The quiz files hold the right answers, so they are read here and in the scoring route only — never by a
 * client component. A client is handed `PresentedQuiz`, which has none (quiz.ts).
 */
import { manualHref, manualTarget } from "@/lib/manual/manual";
import type { ManualLocale } from "@/lib/manual/format";
import { lastVariant } from "./attempts";
import { pickVariant, presentQuiz, seededRandom, type PresentedQuiz, type QuizFile, type QuizLang } from "./quiz";
import { QUIZZES } from "./quizzes";

/** A skill's quiz file, or undefined while its quiz is not written (the Intermediate and higher ones until #39.44). */
export function quizFor(skillKey: string): QuizFile | undefined {
  return QUIZZES[skillKey];
}

export type DrawnQuiz = PresentedQuiz & { /** When it was drawn — the attempt's start. */ startedAt: string };

/** A fresh attempt for a user: a variant other than their last one, its questions and options shuffled. */
export async function drawQuiz(userId: string, skillKey: string, lang: QuizLang): Promise<DrawnQuiz | null> {
  const quiz = quizFor(skillKey);
  if (!quiz) return null;
  const now = new Date();
  const random = seededRandom((now.getTime() ^ Math.floor(Math.random() * 2 ** 31)) >>> 0);
  return { ...presentQuiz(quiz, pickVariant(quiz, await lastVariant(userId, skillKey), random), lang, random), startedAt: now.toISOString() };
}

export type SectionLink = { id: string; href: string; number: string; title: string };

/** Section ids as links into the manual, in the application's language; an id the manual lacks is left out. */
export function sectionLinks(ids: readonly string[], locale: ManualLocale): SectionLink[] {
  return ids.flatMap((id) => {
    const t = manualTarget(locale, id);
    return t ? [{ id, href: manualHref(id), number: t.number, title: t.title }] : [];
  });
}
