import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { skillByKey } from "@/lib/skills/catalogue";
import { getProgress } from "@/lib/skills/attempts";
import { formatRetryAt, passMark, skillProgress } from "@/lib/skills/progress";
import { drawQuiz, sectionLinks } from "@/lib/skills/quiz-server";
import { BackToMap } from "./back-to-map";
import { QuizForm } from "./quiz-form";
import { SectionList } from "../_components/section-list";

export const dynamic = "force-dynamic";

/**
 * /skills-map/<key> — a skill's quiz.                                       (Slice #39.42, the quiz #39.43)
 *
 * The server decides what the page is, from 39.41's rules: an Open skill whose quiz is available gets a freshly
 * drawn attempt (quiz-server.ts — a variant other than the last one, shuffled, no answer marked); an Open one
 * still in its three days says when it reopens; a Closed one says its predecessors come first; a Mastered or
 * Obsolete one says when, with the manual sections it rests on. A skill whose quiz is not written yet (#39.44)
 * says it is being prepared.
 */
export default async function SkillQuizPage({ params }: { params: Promise<{ skill: string }> }) {
  const { skill: raw } = await params;
  const key = decodeURIComponent(raw);
  const t = await getTranslations("skillQuiz");
  const locale = (await getLocale()) === "en-GB" ? "en-GB" : "ro-RO";
  const lang = locale === "en-GB" ? "en" : "ro";
  const skill = skillByKey(key);
  const user = await getCurrentUser();
  const progress = skill && user ? skillProgress(await getProgress(user.id), skill.key) : undefined;
  const quiz = skill && user && progress?.quizAvailable ? await drawQuiz(user.id, skill.key, lang) : null;
  const sections = skill ? sectionLinks(skill.manual, locale) : [];

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="flex w-full max-w-3xl flex-col gap-4 px-6 py-8" data-skill-quiz={skill?.key ?? ""}>
        {!skill && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {t("unknown", { key })}
          </p>
        )}
        {skill && (
          <>
            <h1 className="text-2xl font-bold text-ink dark:text-zinc-100">{t("title", { number: skill.number, name: skill.name[lang] })}</h1>
            <p className="text-sm text-fade">{skill.description[lang]}</p>
            {quiz && (
              <QuizForm skillKey={skill.key} quiz={quiz} pass={passMark(quiz.questions.length)} lang={lang} />
            )}
            {!quiz && progress?.state === "open" && progress.retryAt && (
              <p role="status" className="text-sm text-ink dark:text-zinc-200" data-quiz-cooling>
                {t("cooling", { when: formatRetryAt(progress.retryAt, locale) })}
              </p>
            )}
            {!quiz && progress?.state === "open" && !progress.retryAt && (
              <p role="status" className="text-sm text-ink dark:text-zinc-200">
                {t("preparing")}
              </p>
            )}
            {progress?.state === "closed" && (
              <p role="status" className="text-sm text-ink dark:text-zinc-200">
                {t("notOpen")}
              </p>
            )}
            {(progress?.state === "mastered" || progress?.state === "obsolete") && (
              <p role="status" className="text-sm text-ink dark:text-zinc-200" data-quiz-mastered>
                {progress.masteredAt
                  ? t("masteredOn", { date: formatRetryAt(progress.masteredAt, locale) })
                  : t("masteredNoDate")}
              </p>
            )}
            {!quiz && sections.length > 0 && <SectionList title={t("sectionsTitle")} sections={sections} />}
          </>
        )}
        <p>
          <BackToMap label={t("back")} />
        </p>
      </main>
    </div>
  );
}
