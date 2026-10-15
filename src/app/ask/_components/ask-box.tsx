"use client";

/**
 * „Întreabă” — one box, a question in plain words, the manual's answer.                 (Slices #39.45, #39.49)
 *
 * #39.49: one box and one button, „Întreabă”; Enter asks. Claude picks the sections that answer the question by
 * what it means, from the manual's outline, and writes a short answer from their text (POST /api/manual/ask). The
 * page shows either the answer, its [§n] marks as links, with the sections it rests on listed under it as links —
 * or the single sentence „Manualul nu răspunde la această întrebare.” with a link to the manual's contents. Never a
 * list of near misses: Adrian ruled a word list worse than no answer, so every question is a paid read.
 *
 * It stands at the top of „Manual de utilizare” and as its own screen, „Întreabă”. `compact` is the manual's: no
 * introduction of its own.
 */
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { BookOpenText, MessageCircleQuestion } from "lucide-react";
import { IconButton, LeadingIcon } from "@/lib/ui/icon-button";
import { rem, SCALE } from "@/lib/ui/field-widths";
import { answerRuns, QUESTION_MAX } from "@/lib/manual/ask";
import { MANUAL_ROUTE } from "@/lib/manual/manual";

type Cited = { id: string; number: string; title: string; href: string };
type State =
  | { state: "idle" }
  | { state: "asking" }
  | { state: "answer"; text: string; cited: Cited[] }
  | { state: "not-in-manual" }
  | { state: "error"; code: string };

export function AskBox({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("ask");
  const lang = useLocale() === "en-GB" ? "en" : "ro";
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<State>({ state: "idle" });

  async function ask(e?: FormEvent) {
    e?.preventDefault();
    const q = question.trim();
    if (!q || result.state === "asking") return;
    setResult({ state: "asking" });
    try {
      const res = await fetch("/api/manual/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, lang }),
      });
      const body = (await res.json().catch(() => ({}))) as { kind?: string; text?: string; cited?: Cited[]; code?: string };
      if (!res.ok) setResult({ state: "error", code: body.code ?? "unknown" });
      else if (body.kind === "answer" && body.text) setResult({ state: "answer", text: body.text, cited: body.cited ?? [] });
      else setResult({ state: "not-in-manual" });
    } catch {
      setResult({ state: "error", code: "network" });
    }
  }

  return (
    <section className="flex w-full max-w-3xl flex-col gap-3" data-ask-box data-ask-state={result.state}>
      {!compact && <p className="text-sm text-fade">{t("intro")}</p>}
      <form onSubmit={ask} className="flex flex-wrap items-center gap-2" role="search">
        <label htmlFor="ask-question" className="sr-only">
          {t("label")}
        </label>
        <input
          id="ask-question"
          type="search"
          value={question}
          maxLength={QUESTION_MAX}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t("placeholder")}
          style={{ width: rem(SCALE.XXL) }}
          className="rounded-md border border-card-rim bg-white px-3 py-2 text-sm text-ink dark:bg-zinc-900 dark:text-zinc-100"
          data-ask-input
        />
        <IconButton
          icon={MessageCircleQuestion}
          label={t("ask")}
          showLabel
          variant="primary"
          type="submit"
          busy={result.state === "asking"}
          busyLabel={t("asking")}
          disabled={!question.trim() || result.state === "asking"}
        />
      </form>
      {!compact && <p className="text-xs text-fade">{t("note")}</p>}

      {result.state === "answer" && (
        <div className="flex flex-col gap-2 rounded-md border border-cta/40 bg-cta-pale p-3" data-ask-answer>
          <p className="text-sm text-ink dark:text-zinc-100">
            {answerRuns(result.text, result.cited).map((run, i) =>
              "id" in run ? (
                <Link key={i} href={result.cited.find((c) => c.id === run.id)!.href} className="font-medium text-cta underline-offset-2 hover:underline" data-ask-cited={run.id}>
                  {`§${run.number}`}
                </Link>
              ) : (
                <span key={i}>{run.text}</span>
              ),
            )}
          </p>
          {result.cited.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-fade">{t("sources")}</p>
              <ul className="flex flex-col gap-1">
                {result.cited.map((c) => (
                  <li key={c.id}>
                    <Link href={c.href} className="inline-flex items-baseline text-sm font-semibold text-cta hover:underline" data-ask-link={c.id}>
                      <LeadingIcon icon={BookOpenText} />
                      {`§${c.number} ${c.title}`}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-fade">{t("writtenBy")}</p>
        </div>
      )}

      {result.state === "not-in-manual" && (
        <p role="status" className="text-sm text-ink dark:text-zinc-200" data-ask-not-in-manual>
          {t("notInManual")}{" "}
          <Link href={MANUAL_ROUTE} className="font-medium text-cta underline-offset-2 hover:underline" data-ask-contents>
            {t("openContents")}
          </Link>
        </p>
      )}

      {result.state === "error" && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400" data-ask-error={result.code}>
          {result.code === "no_api_key" ? t("notConfigured") : t("failed")}
        </p>
      )}
    </section>
  );
}
