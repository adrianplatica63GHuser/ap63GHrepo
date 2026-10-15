/**
 * POST /api/manual/ask — „Răspuns AI”: a short answer written from the manual sections the search found.
 *                                                                                              (Slice #39.45)
 *   { question, lang: "ro" | "en" }
 *
 * Called only when the user presses „Răspuns AI” (Ask first 1), never as they type. The server runs the same
 * search as GET /api/manual/search and hands Claude the question and those sections' text — nothing else: not the
 * archive's records, not earlier questions. The answer:
 *
 *   { kind: "answer", text, cited: [{ id, number, title, href }], usage: { inputTokens, outputTokens } }
 *   { kind: "not-in-manual" }      — the search found nothing (no call is made), or Claude found no answer in it
 *   503 { code: "no_api_key" } · 502 { code: "network" } · the API's own error, mapped as the other AI routes do
 *
 * Every answer from the Messages API is recorded with recordPaidRead (route „ask-manual”), so „Setări → AI”
 * counts it with the application's other paid reads. The model is ASK_MODEL (Ask first 2).
 */
import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { getCurrentUser } from "@/lib/auth/current-user";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { ASK_MODEL } from "@/lib/ai/models";
import { recordPaidRead } from "@/lib/ai/paid-reads";
import { askPrompt, QUESTION_MAX, readAnswer, type AskSection } from "@/lib/manual/ask";
import { manualHref } from "@/lib/manual/manual";
import { entryText, searchManual } from "@/lib/manual/search";
import { manualIndex } from "@/lib/manual/search-index";

export const dynamic = "force-dynamic";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

/** Room for three short sentences with their section marks. */
const MAX_TOKENS = 400;

const bodySchema = z.object({
  question: z.string().trim().min(1).max(QUESTION_MAX),
  lang: z.enum(["ro", "en"]),
});

export async function POST(request: NextRequest): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return zodErrorToResponse(parsed.error);
    const { question, lang } = parsed.data;

    const index = manualIndex(lang === "en" ? "en-GB" : "ro-RO");
    const found = searchManual(index, question);
    // Nothing found: the manual does not say, and nothing is paid for saying so.
    if (found.length === 0) return Response.json({ kind: "not-in-manual" });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return Response.json({ error: "ANTHROPIC_API_KEY is not configured on the server", code: "no_api_key" }, { status: 503 });

    const sections: AskSection[] = found.map((r) => ({ id: r.id, number: r.number, title: r.title, text: entryText(index, r.id) ?? r.title }));
    const { system, user: content } = askPrompt(question, lang, sections);

    let res: globalThis.Response;
    try {
      res = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: ASK_MODEL, max_tokens: MAX_TOKENS, temperature: 0, system, messages: [{ role: "user", content }] }),
      });
    } catch (err) {
      console.error("[manual-ask] could not reach the Messages API:", err);
      return Response.json({ error: "The AI service could not be reached.", code: "network" }, { status: 502 });
    }

    await recordPaidRead({ route: "ask-manual", model: ASK_MODEL, success: res.ok });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      let code = "unknown";
      let message = `Anthropic API error (HTTP ${res.status})`;
      try {
        const e = (JSON.parse(detail) as { error?: { type?: string; message?: string } }).error;
        const t = e?.type ?? "";
        const m = e?.message ?? "";
        if (/credit balance is too low/i.test(m)) { code = "insufficient_credits"; message = m; }
        else if (res.status === 401 || t === "authentication_error") { code = "invalid_api_key"; message = m || message; }
        else if (res.status === 429 || t === "rate_limit_error") { code = "rate_limited"; message = m || message; }
        else if (res.status === 529 || t === "overloaded_error") { code = "overloaded"; message = m || message; }
      } catch { /* not JSON */ }
      console.error("[manual-ask] Anthropic error:", res.status, detail);
      return Response.json({ error: message, code }, { status: res.status >= 500 ? 502 : res.status });
    }

    const json = (await res.json()) as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } };
    const text = json.content?.find((b) => b.type === "text")?.text ?? "";
    const answer = readAnswer(text, sections);
    if (answer.kind === "not-in-manual") return Response.json({ kind: "not-in-manual" });
    const byId = new Map(sections.map((s) => [s.id, s]));
    return Response.json({
      kind: "answer",
      text: answer.text,
      cited: answer.cited.map((id) => ({ id, number: byId.get(id)!.number, title: byId.get(id)!.title, href: manualHref(id) })),
      usage: { inputTokens: json.usage?.input_tokens ?? null, outputTokens: json.usage?.output_tokens ?? null },
    });
  } catch (err) {
    return unexpectedError(err, "manual-ask");
  }
}
