/**
 * POST /api/documents/[id]/tarla-plan — read a plan parcelar's locality, tarla and parcels.   (Slice #39.69)
 *
 * The import calls it once per document whose type, after the general read, is „Plan parcelar". It reads the
 * document's pages with the plan prompt (src/lib/tarla/plan-read.ts) and returns what it read: { reading }.
 * **It writes nothing.** The import's tarla step shows the reading, and only the user's „Creează" or „Leagă" writes
 * (POST /api/tarlale/from-plan) — D-12: nothing an AI read enters a list unconfirmed.
 *
 * A second paid read, made only for plans, so the general read every document pays for (`buildExtractSystemPrompt`,
 * scored by ai-score) is unchanged. Refused for any other type (422 `not_a_plan`), so no read is spent by mistake.
 * The same rate limit as every Anthropic-backed route; every answer is counted (`recordPaidRead`).
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { unexpectedError } from "@/lib/api/errors";
import { buildPageBlocks, callAnthropic, extractJson } from "@/lib/documents/ai-extract";
import { recordPaidRead } from "@/lib/ai/paid-reads";
import { EXTRACT_MODEL } from "@/lib/ai/models";
import { listDocumentPages } from "@/lib/documents/pages-queries";
import { readFileContent } from "@/lib/storage";
import { getCurrentUserIdAndAccess } from "@/lib/auth/current-role";
import { checkOcrRateLimit } from "@/lib/rate-limit/ocr";
import { buildTarlaPlanRequestBody, parseTarlaPlanReading, PLAN_PARCELAR_KEY } from "@/lib/tarla/plan-read";
import { documentTypeKey } from "@/lib/tarla/plan-queries";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "Document not found" }, { status: 404 });

  let key: string | null | undefined;
  try {
    key = await documentTypeKey(id);
  } catch (err) {
    return unexpectedError(err, "tarla-plan:type");
  }
  if (key === undefined) return Response.json({ error: "Document not found" }, { status: 404 });
  if (key !== PLAN_PARCELAR_KEY) {
    return Response.json({ error: "Documentul nu este un plan parcelar.", code: "not_a_plan" }, { status: 422 });
  }

  const { userId } = await getCurrentUserIdAndAccess();
  const rl = checkOcrRateLimit(userId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Prea multe cereri. Încercați din nou în curând.", code: "rate_limited_local" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "ANTHROPIC_API_KEY is not configured on the server", code: "no_api_key" }, { status: 500 });
  }

  let blocks: Awaited<ReturnType<typeof buildPageBlocks>>;
  try {
    const pages = await listDocumentPages(id);
    if (pages.length === 0) {
      return Response.json({ error: "Nu există pagini încărcate pentru acest document.", code: "no_pages" }, { status: 422 });
    }
    blocks = await buildPageBlocks(pages, (page) => readFileContent(page.filePath));
  } catch (err) {
    return unexpectedError(err, "tarla-plan:read-file");
  }
  if (blocks.fileBlocks.length === 0) {
    return Response.json(
      { error: "Nicio pagină a planului nu este într-un format pe care modelul îl poate citi.", code: "unsupported_file_type" },
      { status: 422 },
    );
  }

  const body = buildTarlaPlanRequestBody(blocks.fileBlocks);
  let called: Awaited<ReturnType<typeof callAnthropic>>;
  try {
    called = await callAnthropic(apiKey, body, blocks.extraHeaders);
  } catch (err) {
    return unexpectedError(err, "tarla-plan:fetch");
  }
  await recordPaidRead({ route: "tarla-plan", model: String(body.model ?? EXTRACT_MODEL), success: called.ok });

  if (!called.ok && called.kind === "http") {
    console.error("[tarla-plan] Anthropic error:", called.status, called.detail);
    return Response.json({ error: called.message, code: called.code }, { status: called.status >= 500 ? 502 : called.status });
  }
  if (!called.ok) return Response.json({ error: "Anthropic API returned no text" }, { status: 502 });

  let reading: ReturnType<typeof parseTarlaPlanReading>;
  try {
    reading = parseTarlaPlanReading(extractJson(called.textBlock));
  } catch {
    reading = null;
  }
  if (reading === null) {
    return Response.json({ error: "Răspunsul modelului nu a putut fi citit.", code: "unparsable" }, { status: 502 });
  }
  return Response.json({ reading, truncated: called.hitOutputLimit });
}
