/**
 * POST /api/admin/import/scan-folder
 *
 * Phase 1 of the Slice #19.06 folder-scan feature. Accepts a single image
 * file (the client converts PDFs to PNG via PDF.js before calling this route)
 * and asks Claude Haiku 4.5 to classify the document type and assess whether
 * structured data can be extracted from it.
 *
 * Uses the cheap Haiku model (~0.08x the cost of a CI extraction) so that
 * classifying an entire folder is affordable. Extraction (Phase 2, Sonnet)
 * only runs on files the user explicitly approves.
 *
 * Response shape:
 *   {
 *     classifiedLabel: string,
 *     suggestedTypeKey: string | null,
 *     confidence: "high" | "medium" | "low",
 *     extractable: boolean,
 *     notes: string | null,
 *   }
 */

import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { CLASSIFY_SYSTEM_PROMPT, KNOWN_TYPE_KEYS } from "@/lib/import/classify-prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const CLASSIFY_MODEL = "claude-haiku-4-5-20251001";

type ClassifyResult = {
  classifiedLabel: string;
  suggestedTypeKey: string | null;
  confidence: "high" | "medium" | "low";
  extractable: boolean;
  notes: string | null;
};

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(cleaned);
}

export async function POST(request: NextRequest): Promise<Response> {
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

  const buffer = Buffer.from(await fileField.arrayBuffer());
  const base64 = buffer.toString("base64");
  // Anthropic accepts only these four media types; normalise anything else
  // (e.g. image/bmp, image/tiff) to jpeg so the request isn't rejected.
  const SUPPORTED = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
  type SupportedMime = (typeof SUPPORTED)[number];
  const mediaType: SupportedMime = (SUPPORTED as readonly string[]).includes(fileField.type)
    ? (fileField.type as SupportedMime)
    : "image/jpeg";

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
        model: CLASSIFY_MODEL,
        max_tokens: 512,
        system: CLASSIFY_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              {
                type: "text",
                text: "Classify this Romanian document as instructed.",
              },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    return unexpectedError(err, "scan-folder:fetch");
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
    console.error("[scan-folder] Anthropic error:", anthropicRes.status, detail);
    return Response.json({ error: message, code }, { status: anthropicRes.status >= 500 ? 502 : anthropicRes.status });
  }

  const anthropicJson = (await anthropicRes.json()) as {
    content?: { type: string; text?: string }[];
  };
  const textBlock = anthropicJson.content?.find((b) => b.type === "text")?.text;
  if (!textBlock) {
    return Response.json({ error: "Anthropic API returned no text" }, { status: 502 });
  }

  let parsed: ClassifyResult;
  try {
    const raw = extractJson(textBlock) as Partial<ClassifyResult>;
    // Validate and sanitize
    const suggestedTypeKey =
      raw.suggestedTypeKey && (KNOWN_TYPE_KEYS as readonly string[]).includes(raw.suggestedTypeKey)
        ? raw.suggestedTypeKey
        : null;
    parsed = {
      classifiedLabel: raw.classifiedLabel ?? "Document necunoscut",
      suggestedTypeKey,
      confidence: raw.confidence === "high" || raw.confidence === "medium" || raw.confidence === "low"
        ? raw.confidence
        : "low",
      extractable: Boolean(raw.extractable),
      notes: raw.notes ?? null,
    };
  } catch (err) {
    console.error("[scan-folder] failed to parse model output:", textBlock, err);
    return Response.json(
      { error: "Could not parse classification response", raw: textBlock },
      { status: 502 },
    );
  }

  return Response.json(parsed);
}
