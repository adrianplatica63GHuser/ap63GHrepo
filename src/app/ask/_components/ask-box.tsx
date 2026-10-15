"use client";

/**
 * „Întreabă” — one box, a question in plain words, the manual's answer.                        (Slice #39.45)
 *
 * Enter (or „Caută”) runs the built-in search: the five sections that answer best, each a link into „Manual de
 * utilizare”, with the sentences that match and the matched words marked. Nothing is sent out and nothing is paid.
 * „Răspuns AI” — only when pressed (Ask first 1) — asks Claude for a short answer written from those sections
 * alone, naming them; the manual is the only source, and a question it does not answer is told so.
 *
 * It stands at the top of „Manual de utilizare” and as its own screen, „Întreabă” (Ask first 3). `compact` is the
 * manual's: no heading of its own.
 */
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { BookOpenText, Search, Sparkles } from "lucide-react";
import { IconButton, LeadingIcon } from "@/lib/ui/icon-button";
import { answerRuns, QUESTION_MAX } from "@/lib/manual/ask";
import type { Highlighted } from "@/lib/manual/search";

type Result = { id: string; number: string; title: string; chapterTitle: string; href: string; sentences: Highlighted[] };
type Cited = { id: string; number: string; title: string; href: string };
type Ai =
  | { state: "idle" }
  | { state: "asking" }
  | { state: "answer"; text: string; cited: Cited[] }
  | { state: "not-in-manual" }
  | { state: "error"; code: string };

export function AskBox({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("ask");
  const lang = useLocale() === "en-GB" ? "en" : "ro";
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ai, setAi] = useState<Ai>({ state: "idle" });

  async function search(e?: FormEvent) {
    e?.preventDefault();
    const q = question.trim();
    if (!q) return;
    setSearching(true);
    setFailed(false);
    setAi({ state: "idle" });
    try {
      const res = await fetch(`/api/manual/search?${new URLSearchParams({ q, lang })}`);
      if (!res.ok) throw new Error(String(res.status));
      setResults(((await res.json()) as { results: Result[] }).results);
      setAsked(q);
    } catch {
      setFailed(true);
      setResults(null);
    } finally {
      setSearching(false);
    }
  }

  async function askAi() {
    if (!asked) return;
    setAi({ state: "asking" });
    try {
      const res = await fetch("/api/manual/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: asked, lang }),
      });
      const body = (await res.json().catch(() => ({}))) as { kind?: string; text?: string; cited?: Cited[]; code?: string };
      if (!res.ok) setAi({ state: "error", code: body.code ?? "unknown" });
      else if (body.kind === "answer" && body.text) setAi({ state: "answer", text: body.text, cited: body.cited ?? [] });
      else setAi({ state: "not-in-manual" });
    } catch {
      setAi({ state: "error", code: "network" });
    }
  }

  return (
    <section className="flex w-full max-w-3xl flex-col gap-3" data-ask-box>
      {!compact && <p className="text-sm text-fade">{t("intro")}</p>}
      <form onSubmit={search} className="flex flex-wrap items-center gap-2" role="search">
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
          className="min-w-0 flex-1 rounded-md border border-card-rim bg-white px-3 py-2 text-sm text-ink dark:bg-zinc-900 dark:text-zinc-100"
          data-ask-input
        />
        <IconButton icon={Search} label={t("search")} showLabel variant="primary" type="submit" busy={searching} busyLabel={t("searching")} disabled={!question.trim() || searching} />
      </form>

      {failed && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {t("searchFailed")}
        </p>
      )}

      {results !== null && results.length === 0 && (
        <p role="status" className="text-sm text-ink dark:text-zinc-200" data-ask-empty>
          {t("noResults")}
        </p>
      )}

      {results !== null && results.length > 0 && (
        <div className="flex flex-col gap-3" data-ask-results>
          <p role="status" className="text-sm text-fade">
            {t("found", { count: results.length })}
          </p>
          <ol className="flex flex-col gap-3">
            {results.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 rounded-md border border-card-rim bg-white p-3 dark:bg-zinc-900" data-ask-result={r.id}>
                <Link href={r.href} className="inline-flex items-baseline text-sm font-semibold text-cta hover:underline" data-ask-link={r.id}>
                  <LeadingIcon icon={BookOpenText} />
                  {`§${r.number} ${r.title}`}
                </Link>
                <span className="text-xs text-fade">{r.chapterTitle}</span>
                {r.sentences.map((s, i) => (
                  <p key={i} className="text-sm text-ink dark:text-zinc-200">
                    {s.map((run, j) =>
                      run.hit ? (
                        <mark key={j} className="rounded-sm bg-amber-100 px-0.5 text-ink dark:bg-amber-900/60 dark:text-zinc-100" data-ask-hit>
                          {run.text}
                        </mark>
                      ) : (
                        <span key={j}>{run.text}</span>
                      ),
                    )}
                  </p>
                ))}
              </li>
            ))}
          </ol>

          <div className="flex flex-col gap-2" data-ask-ai={ai.state}>
            <div className="flex flex-wrap items-center gap-2">
              <IconButton icon={Sparkles} label={t("aiAnswer")} showLabel variant="secondary" busy={ai.state === "asking"} busyLabel={t("aiAsking")} disabled={ai.state === "asking"} onClick={askAi} />
              <span className="text-xs text-fade">{t("aiNote")}</span>
            </div>
            {ai.state === "answer" && (
              <div className="flex flex-col gap-1 rounded-md border border-cta/40 bg-cta-pale p-3" data-ask-answer>
                <p className="text-sm text-ink dark:text-zinc-100">
                  {answerRuns(ai.text, ai.cited).map((run, i) =>
                    "id" in run ? (
                      <Link key={i} href={ai.cited.find((c) => c.id === run.id)!.href} className="font-medium text-cta underline-offset-2 hover:underline" data-ask-cited={run.id}>
                        {`§${run.number}`}
                      </Link>
                    ) : (
                      <span key={i}>{run.text}</span>
                    ),
                  )}
                </p>
                <p className="text-xs text-fade">{t("aiWrittenFrom")}</p>
              </div>
            )}
            {ai.state === "not-in-manual" && (
              <p role="status" className="text-sm text-ink dark:text-zinc-200" data-ask-not-in-manual>
                {t("aiNotInManual")}
              </p>
            )}
            {ai.state === "error" && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-400" data-ask-error={ai.code}>
                {ai.code === "no_api_key" ? t("aiNotConfigured") : t("aiFailed")}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
