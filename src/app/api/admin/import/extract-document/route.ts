/**
 * POST /api/admin/import/extract-document
 *
 * Phase 2 of the Slice #19.06 folder-scan feature. Accepts an image file
 * (client converts PDFs to PNG via PDF.js) plus an optional `typeKey` hint,
 * and asks Claude Sonnet 4.6 to extract all known document fields.
 *
 * Uses the same model as the existing CI extraction route, so cost per page
 * is approximately the same as extracting a single ID card (~1.25 cents).
 *
 * Response shape:
 *   {
 *     fields: Partial<DocumentExtractedFields>,
 *     lowConfidenceFields: string[],
 *     unmappedRaw: Record<string, string>,
 *   }
 */

import type { NextRequest }   from "next/server";
import { NextResponse }       from "next/server";
import { unexpectedError }    from "@/lib/api/errors";
import { EXTRACT_SYSTEM_PROMPT } from "@/lib/import/classify-prompts";
import { createServerClient } from "@/lib/supabase/server";
import { checkOcrRateLimit }  from "@/lib/rate-limit/ocr";

export const runtime = "nodejs";
export const maxDuration = 60;

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const EXTRACT_MODEL = "claude-sonnet-4-6";

export type DocumentExtractedFields = {
  title: string | null;
  nrDocument: string | null;
  dateDocument: string | null;
  institution: string | null;
  institutionId: string | null;
  emitent: string | null;
  bazaLegala: string | null;
  uatProprietate: string | null;
  uatProprietar: string | null;
  suprafata: string | null;
  nrDosarSuccesoral: string | null;
  dataDecesului: string | null;
  ultimulDomiciliu: string | null;
  nrCertificatDeces: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  subject: string | null;
  notes: string | null;
};

type ExtractionResult = {
  fields: Partial<DocumentExtractedFields>;
  lowConfidenceFields: string[];
  unmappedRaw: Record<string, string>;
};

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(cleaned);
}

export async function POST(request: NextRequest): Promise<Response> {
  // ── Rate limiting (10 OCR/AI requests / minute per user) ──────────────────
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const rl = checkOcrRateLimit(user?.id ?? "anonymous");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Prea multe cereri. Încercați din nou în curând.", code: "rate_limited_local" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server", code: "no_api_key" },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const fileField = formData.get("file");
  if (!fileField || !(fileField instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }
  if (!fileField.type.startsWith("image/")) {
    return Response.json(
      { error: `File must be an image (received: ${fileField.type})` },
      { status: 400 },
    );
  }

  const typeKeyHint = formData.get("typeKey");
  const typeHint =
    typeKeyHint && typeof typeKeyHint === "string" && typeKeyHint !== "null"
      ? typeKeyHint
      : null;

  const buffer = Buffer.from(await fileField.arrayBuffer());
  const base64 = buffer.toString("base64");
  const SUPPORTED = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
  type SupportedMime = (typeof SUPPORTED)[number];
  const mediaType: SupportedMime = (SUPPORTED as readonly string[]).includes(fileField.type)
    ? (fileField.type as SupportedMime)
    : "image/jpeg";

  const userText = typeHint
    ? `Extract fields from this Romanian document. Document type hint: ${typeHint}.`
    : "Extract fields from this Romanian document.";

  let anthropicRes: globalThis.Response;
  try {
    anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: EXTRACT_MODEL,
        max_tokens: 2048,
        system: EXTRACT_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              { type: "text", text: userText },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    return unexpectedError(err, "extract-document:fetch");
  }

  if (!anthropicRes.ok) {
    const detail = await anthropicRes.text().catch(() => "");
    let code = "unknown";
    let message = `Anthropic API error (HTTP ${anthropicRes.status})`;
    try {
      const parsed = JSON.parse(detail) as { error?: { type?: string; message?: string } };
      const t = parsed.error?.type ?? "";
      const m = parsed.error?.message ?? "";
      if (/credit balance is too low/i.test(m)) { code = "insufficient_credits"; message = m; }
      else if (anthropicRes.status === 401 || t === "authentication_error") { code = "invalid_api_key"; message = m || message; }
      else if (anthropicRes.status === 429 || t === "rate_limit_error") { code = "rate_limited"; message = m || message; }
      else if (anthropicRes.status === 529 || t === "overloaded_error") { code = "overloaded"; message = m || message; }
    } catch { /* non-JSON body */ }
    console.error("[extract-document] Anthropic error:", anthropicRes.status, detail);
    return Response.json({ error: message, code }, { status: anthropicRes.status >= 500 ? 502 : anthropicRes.status });
  }

  const anthropicJson = (await anthropicRes.json()) as {
    content?: { type: string; text?: string }[];
  };
  const textBlock = anthropicJson.content?.find((b) => b.type === "text")?.text;
  if (!textBlock) {
    return Response.json({ error: "Anthropic API returned no text" }, { status: 502 });
  }

  let parsed: ExtractionResult;
  try {
    const raw = extractJson(textBlock) as Partial<ExtractionResult>;
    parsed = {
      fields: (raw.fields ?? {}) as Partial<DocumentExtractedFields>,
      lowConfidenceFields: Array.isArray(raw.lowConfidenceFields) ? raw.lowConfidenceFields : [],
      unmappedRaw:
        raw.unmappedRaw && typeof raw.unmappedRaw === "object" ? raw.unmappedRaw : {},
    };
  } catch (err) {
    console.error("[extract-document] failed to parse model output:", textBlock, err);
    return Response.json(
      { error: "Could not parse extraction response", raw: textBlock },
      { status: 502 },
    );
  }

  return Response.json(parsed);
}
