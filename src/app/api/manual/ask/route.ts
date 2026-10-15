/**
 * POST /api/manual/ask — „Întreabă”: the manual's answer to a question, by what it means.   (Slices #39.45, #39.49)
 *   { question, lang: "ro" | "en" }
 *
 * #39.49: no word search any more (Adrian: „a question is much more than the sum of its words”). One press, two
 * calls to ASK_MODEL, the manual the only source (src/lib/manual/ask.ts):
 *
 *   1. the question and the manual's outline → at most five section ids, or none. Ids that are not sections of the
 *      manual are dropped. The outline is the same for every question, so it is sent for prompt caching.
 *   2. the question and those sections' full text → a short answer naming them, or NOT_IN_MANUAL.
 *
 *   { kind: "answer", text, cited: [{ id, number, title, href }], usage }   — `cited`: the sections the answer names,
 *                                                                           or the ones picked when it names none
 *   { kind: "not-in-manual", usage }      — no section answers the question, or the sections picked do not after all
 *   400 · 401 · 503 { code: "no_api_key" } · 502 { code: "network" } · the API's own error, mapped as the other AI routes do
 *
 * Every call to the Messages API is recorded with recordPaidRead (route „ask-manual”), so „Setări → AI” counts each
 * question as the reads it really made: one when nothing answers, two otherwise. Nothing from the archive's records
 * and no earlier question is ever sent.
 */
import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { getCurrentUser } from "@/lib/auth/current-user";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { ASK_MODEL } from "@/lib/ai/models";
import { recordPaidRead } from "@/lib/ai/paid-reads";
import {
  askPrompt,
  manualOutline,
  pickSystem,
  pickUser,
  QUESTION_MAX,
  readAnswer,
  readPick,
  sectionText,
  type AskSection,
} from "@/lib/manual/ask";
import { getManual, manualHref } from "@/lib/manual/manual";
import { MANUAL_OUTLINE } from "@/lib/manual/outline";

export const dynamic = "force-dynamic";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

/** The pick: five ids. The answer: three short sentences with their section marks. */
const PICK_MAX_TOKENS = 120;
const ANSWER_MAX_TOKENS = 400;

const bodySchema = z.object({
  question: z.string().trim().min(1).max(QUESTION_MAX),
  lang: z.enum(["ro", "en"]),
});

type Usage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };
type Call = { ok: true; text: string; usage: Usage } | { ok: false; response: Response };

/** One call to the Messages API, recorded as a paid read; an error mapped as the other AI routes map it. */
async function callClaude(apiKey: string, body: Record<string, unknown>): Promise<Call> {
  let res: globalThis.Response;
  try {
    res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: ASK_MODEL, temperature: 0, ...body }),
    });
  } catch (err) {
    console.error("[manual-ask] could not reach the Messages API:", err);
    return { ok: false, response: Response.json({ error: "The AI service could not be reached.", code: "network" }, { status: 502 }) };
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
    return { ok: false, response: Response.json({ error: message, code }, { status: res.status >= 500 ? 502 : res.status }) };
  }
  const json = (await res.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
  };
  return {
    ok: true,
    text: json.content?.find((b) => b.type === "text")?.text ?? "",
    usage: {
      inputTokens: json.usage?.input_tokens ?? 0,
      outputTokens: json.usage?.output_tokens ?? 0,
      cacheReadTokens: json.usage?.cache_read_input_tokens ?? 0,
      cacheWriteTokens: json.usage?.cache_creation_input_tokens ?? 0,
    },
  };
}

const sum = (a: Usage, b?: Usage): Usage =>
  b
    ? {
        inputTokens: a.inputTokens + b.inputTokens,
        outputTokens: a.outputTokens + b.outputTokens,
        cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
        cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
      }
    : a;

export async function POST(request: NextRequest): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return zodErrorToResponse(parsed.error);
    const { question, lang } = parsed.data;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return Response.json({ error: "ANTHROPIC_API_KEY is not configured on the server", code: "no_api_key" }, { status: 503 });

    const locale = lang === "en" ? "en-GB" : "ro-RO";
    const manual = getManual(locale);
    const outline = manualOutline(manual, MANUAL_OUTLINE[locale]);

    // 1 — which sections answer it. The outline is cached: identical for every question in this language.
    const pick = await callClaude(apiKey, {
      max_tokens: PICK_MAX_TOKENS,
      system: [{ type: "text", text: pickSystem(lang, outline), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: pickUser(question) }],
    });
    if (!pick.ok) return pick.response;
    const ids = readPick(pick.text, outline);
    if (ids.length === 0) return Response.json({ kind: "not-in-manual", usage: pick.usage });

    // 2 — the answer, from those sections' text alone.
    const byId = new Map(outline.map((e) => [e.id, e]));
    const sections: AskSection[] = ids.map((id) => ({
      id,
      number: byId.get(id)!.number,
      title: byId.get(id)!.title,
      text: sectionText(manual, id) ?? byId.get(id)!.title,
    }));
    const { system, user: content } = askPrompt(question, lang, sections);
    const answer = await callClaude(apiKey, { max_tokens: ANSWER_MAX_TOKENS, system, messages: [{ role: "user", content }] });
    if (!answer.ok) return answer.response;
    const usage = sum(pick.usage, answer.usage);
    const read = readAnswer(answer.text, sections);
    if (read.kind === "not-in-manual") return Response.json({ kind: "not-in-manual", usage });
    const shown = read.cited.length > 0 ? read.cited : ids;
    const bySection = new Map(sections.map((s) => [s.id, s]));
    return Response.json({
      kind: "answer",
      text: read.text,
      cited: shown.map((id) => ({ id, number: bySection.get(id)!.number, title: bySection.get(id)!.title, href: manualHref(id) })),
      usage,
    });
  } catch (err) {
    return unexpectedError(err, "manual-ask");
  }
}
