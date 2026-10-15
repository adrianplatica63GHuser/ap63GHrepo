"use client";

/**
 * One attempt at a skill's quiz.                                                              (Slice #39.43)
 *
 * The questions and options arrive drawn and shuffled, with nothing marked right (quiz.ts → presentQuiz). The
 * user picks one option per question; „Trimite” sends the choices once, and the server marks them, records the
 * attempt and answers with the result (POST /api/account/skills-quiz/<key>).
 *
 *   - Passed: the score, and each question's explanation with its right answer and manual section.
 *   - Failed: the score, the manual sections to read again and when the quiz reopens — never the right answers,
 *     which would carry into the next attempt (Ask first 3).
 *
 * Nothing is recorded until „Trimite” (Ask first 4). Leaving with answers chosen asks first, through the app's
 * unsaved-changes guard: its „Salvează” sends the quiz, when every question is answered; „Renunță” leaves and
 * records nothing, so leaving costs no wait.
 */
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useUnsavedChangesGuard } from "@/components/providers/unsaved-changes-provider";
import { formatRetryAt } from "@/lib/skills/progress";
import type { PresentedQuiz, QuizLang } from "@/lib/skills/quiz";
import { SectionList, type SectionLinkData } from "../_components/section-list";

type Passed = {
  passed: true;
  correct: number;
  total: number;
  explanations: { question: string; text: string; explanation: string; answer: string; section: SectionLinkData | null }[];
};
type Failed = { passed: false; correct: number; total: number; pass: number; readAgain: SectionLinkData[]; retryAt: string | null };
type Refused = { refused: true; code: string; retryAt: string | null };
type Result = Passed | Failed | Refused;

export function QuizForm({
  skillKey,
  quiz,
  pass,
  lang,
}: {
  skillKey: string;
  quiz: PresentedQuiz & { startedAt: string };
  pass: number;
  lang: QuizLang;
}) {
  const t = useTranslations("skillQuiz");
  const locale = useLocale() === "en-GB" ? "en-GB" : "ro-RO";
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const total = quiz.questions.length;
  const answered = quiz.questions.filter((q) => answers[q.id]).length;
  const complete = answered === total;

  async function send(): Promise<boolean> {
    if (!complete || sending) return false;
    setSending(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/account/skills-quiz/${encodeURIComponent(skillKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant: quiz.variant, answers, startedAt: quiz.startedAt, lang }),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 409 && body?.code) {
        setResult({ refused: true, code: body.code, retryAt: body.retryAt ?? null });
        return true;
      }
      if (!res.ok || !body) {
        setFailed(true);
        return false;
      }
      setResult(body as Passed | Failed);
      void qc.invalidateQueries({ queryKey: ["skills-progress"] });
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setSending(false);
    }
  }

  useUnsavedChangesGuard({ isDirty: answered > 0 && result === null, onSave: send });

  if (result && "refused" in result) {
    return (
      <p role="status" className="text-sm text-ink dark:text-zinc-200" data-quiz-result="refused">
        {result.code === "cooling-down" && result.retryAt
          ? t("cooling", { when: formatRetryAt(new Date(result.retryAt), locale) })
          : result.code === "already-mastered"
            ? t("masteredNoDate")
            : t("notOpen")}
      </p>
    );
  }

  if (result && result.passed) {
    return (
      <section className="flex flex-col gap-4" data-quiz-result="passed" aria-live="polite">
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
          <h2 className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">{t("passedTitle")}</h2>
          <p className="text-sm text-ink dark:text-zinc-200">{t("passedScore", { correct: result.correct, total: result.total })}</p>
        </div>
        <h3 className="text-base font-semibold text-ink dark:text-zinc-100">{t("explanationsTitle")}</h3>
        <ol className="flex list-decimal flex-col gap-3 pl-5">
          {result.explanations.map((e) => (
            <li key={e.question} className="text-sm text-ink dark:text-zinc-200" data-quiz-explanation={e.question}>
              <p className="font-medium">{e.text}</p>
              <p>{t("rightAnswer", { answer: e.answer })}</p>
              <p className="text-fade">{e.explanation}</p>
              {e.section && <SectionList title="" sections={[e.section]} />}
            </li>
          ))}
        </ol>
      </section>
    );
  }

  if (result && !result.passed) {
    return (
      <section className="flex flex-col gap-4" data-quiz-result="failed" aria-live="polite">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-300">{t("failedTitle")}</h2>
          <p className="text-sm text-ink dark:text-zinc-200">{t("failedScore", { correct: result.correct, total: result.total, pass: result.pass })}</p>
          {result.retryAt && (
            <p className="text-sm text-ink dark:text-zinc-200" data-quiz-retry>
              {t("cooling", { when: formatRetryAt(new Date(result.retryAt), locale) })}
            </p>
          )}
        </div>
        <SectionList title={t("readAgain")} sections={result.readAgain} />
      </section>
    );
  }

  return (
    <form
      className="flex flex-col gap-5"
      data-quiz-form={quiz.variant}
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <p className="text-sm text-ink dark:text-zinc-200">{t("intro", { count: total, pass })}</p>
      {quiz.questions.map((q, i) => (
        <fieldset key={q.id} className="flex flex-col gap-2 rounded-lg border border-card-rim bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900" data-quiz-question={q.id}>
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-fade">{t("question", { n: i + 1, count: total })}</legend>
          <p className="text-sm font-medium text-ink dark:text-zinc-100">{q.text}</p>
          {q.options.map((o) => (
            <label key={o.id} className="flex cursor-pointer items-start gap-2 text-sm text-ink dark:text-zinc-200">
              <input
                type="radio"
                name={q.id}
                value={o.id}
                checked={answers[q.id] === o.id}
                onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                className="mt-0.5"
              />
              <span>{o.text}</span>
            </label>
          ))}
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <IconButton
          icon={Send}
          label={t("send")}
          showLabel
          busy={sending}
          busyLabel={t("sending")}
          variant="primary"
          type="submit"
          disabled={!complete || sending}
          note={complete ? undefined : t("allNeeded")}
        />
        <span className="text-xs text-fade" data-quiz-answered>{t("answered", { answered, count: total })}</span>
      </div>
      {failed && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{t("sendFailed")}</p>}
    </form>
  );
}
