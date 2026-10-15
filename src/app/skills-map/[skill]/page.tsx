import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { skillByKey } from "@/lib/skills/catalogue";
import { getProgress } from "@/lib/skills/attempts";
import { skillProgress } from "@/lib/skills/progress";
import { BackToMap } from "./back-to-map";

export const dynamic = "force-dynamic";

/**
 * /skills-map/<key> — a skill's quiz page.                                                    (Slice #39.42)
 *
 * Until #39.43 builds the quiz, it says the quiz is being prepared — and, for a skill that is not Open, that
 * its predecessors come first: the map links here only from an Open box, but an address can be typed.
 */
export default async function SkillQuizPage({ params }: { params: Promise<{ skill: string }> }) {
  const { skill: key } = await params;
  const t = await getTranslations("skillQuiz");
  const lang = (await getLocale()) === "en-GB" ? "en" : "ro";
  const skill = skillByKey(decodeURIComponent(key));
  const user = await getCurrentUser();
  const state = skill && user ? skillProgress(await getProgress(user.id), skill.key)?.state : undefined;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="flex w-full max-w-3xl flex-col gap-4 px-6 py-8" data-skill-quiz={skill?.key ?? ""}>
        {skill ? (
          <>
            <h1 className="text-2xl font-bold text-ink dark:text-zinc-100">
              {t("title", { number: skill.number, name: skill.name[lang] })}
            </h1>
            <p className="text-sm text-fade">{skill.description[lang]}</p>
            <p role="status" className="text-sm text-ink dark:text-zinc-200">
              {state === "open" ? t("preparing") : t("notOpen")}
            </p>
          </>
        ) : (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {t("unknown", { key: decodeURIComponent(key) })}
          </p>
        )}
        <p>
          <BackToMap label={t("back")} />
        </p>
      </main>
    </div>
  );
}
