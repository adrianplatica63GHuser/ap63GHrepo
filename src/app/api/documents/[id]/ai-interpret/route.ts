/**
 * POST /api/documents/[id]/ai-interpret
 *
 * Slice #21.02.Import — server-side AI field extraction for an existing
 * document.  Unlike the import-wizard's POST /api/admin/import/extract-document
 * (which receives an image from the client), this route reads the document's
 * first uploaded page directly from storage, so no client-side PDF rasterisation
 * is needed.
 *
 * Supports:
 *   - image/* pages → sent as Anthropic image block
 *   - application/pdf pages → sent as Anthropic document block (PDF beta)
 *
 * On success:
 *   - Returns { fields } — the caller fills form fields and PATCHes
 *     ai_interpreted_at separately via PATCH /api/documents/[id].
 *
 * Rate-limited (same 10/min per user as the import-wizard routes).
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { lookupDocumentType } from "@/db/schema";
import { unexpectedError } from "@/lib/api/errors";
import { EXTRACT_SYSTEM_PROMPT, KNOWN_TYPE_KEYS } from "@/lib/import/classify-prompts";
import { createValue } from "@/lib/admin/value-lists/queries";
import { listDocumentPages } from "@/lib/documents/pages-queries";
import { readFileContent } from "@/lib/storage";
import { createServerClient } from "@/lib/supabase/server";
import { checkOcrRateLimit } from "@/lib/rate-limit/ocr";

export const runtime = "nodejs";
export const maxDuration = 60;

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const EXTRACT_MODEL = "claude-sonnet-4-6";

type Ctx = { params: Promise<{ id: string }> };

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(cleaned);
}

export async function POST(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;

  // ── Rate limiting ──────────────────────────────────────────────────────────
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

  // ── Get first page ─────────────────────────────────────────────────────────
  let pages: Awaited<ReturnType<typeof listDocumentPages>>;
  try {
    pages = await listDocumentPages(id);
  } catch (err) {
    return unexpectedError(err, "ai-interpret:list-pages");
  }

  if (pages.length === 0) {
    return Response.json(
      { error: "Nu există pagini încărcate pentru acest document.", code: "no_pages" },
      { status: 422 },
    );
  }

  const firstPage = pages[0];
  const mimeType = firstPage.mimeType ?? "application/octet-stream";

  // ── Read file from storage ─────────────────────────────────────────────────
  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFileContent(firstPage.filePath);
  } catch (err) {
    return unexpectedError(err, "ai-interpret:read-file");
  }

  const base64 = fileBuffer.toString("base64");

  // ── Build Anthropic content block based on MIME type ──────────────────────
  const SUPPORTED_IMAGES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
  type SupportedImage = (typeof SUPPORTED_IMAGES)[number];

  type ContentBlock =
    | { type: "image";    source: { type: "base64"; media_type: SupportedImage; data: string } }
    | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
    | { type: "text";     text: string };

  let fileBlock: ContentBlock;
  let extraHeaders: Record<string, string> = {};

  if ((SUPPORTED_IMAGES as readonly string[]).includes(mimeType)) {
    fileBlock = {
      type: "image",
      source: { type: "base64", media_type: mimeType as SupportedImage, data: base64 },
    };
  } else if (mimeType === "application/pdf") {
    fileBlock = {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: base64 },
    };
    extraHeaders = { "anthropic-beta": "pdfs-2024-09-25" };
  } else {
    // For unsupported types (e.g. .docx), treat as image/jpeg and let
    // the model report it cannot read the file — better than a hard 422.
    fileBlock = {
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: base64 },
    };
  }

  // ── Call Anthropic ─────────────────────────────────────────────────────────
  let anthropicRes: globalThis.Response;
  try {
    anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        ...extraHeaders,
      },
      body: JSON.stringify({
        model: EXTRACT_MODEL,
        max_tokens: 2048,
        system: EXTRACT_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              fileBlock,
              { type: "text", text: "Extract fields from this Romanian document." },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    return unexpectedError(err, "ai-interpret:fetch");
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
    console.error("[ai-interpret] Anthropic error:", anthropicRes.status, detail);
    return Response.json(
      { error: message, code },
      { status: anthropicRes.status >= 500 ? 502 : anthropicRes.status },
    );
  }

  const anthropicJson = (await anthropicRes.json()) as {
    content?: { type: string; text?: string }[];
  };
  const textBlock = anthropicJson.content?.find((b) => b.type === "text")?.text;
  if (!textBlock) {
    return Response.json({ error: "Anthropic API returned no text" }, { status: 502 });
  }

  type AiExtractResponse = {
    fields?: Record<string, string | null>;
    suggestedTypeKey?: string | null;
    classifiedLabel?: string | null;
  };

  let fields: Record<string, string | null>;
  let suggestedTypeKey: string | null = null;
  let classifiedLabel: string | null = null;
  try {
    const raw = extractJson(textBlock) as AiExtractResponse;
    fields = raw.fields ?? {};
    suggestedTypeKey =
      raw.suggestedTypeKey &&
      (KNOWN_TYPE_KEYS as readonly string[]).includes(raw.suggestedTypeKey) &&
      raw.suggestedTypeKey !== "UNCLASSIFIED"
        ? raw.suggestedTypeKey
        : null;
    classifiedLabel = raw.classifiedLabel?.trim() || null;
  } catch (err) {
    console.error("[ai-interpret] failed to parse model output:", textBlock, err);
    return Response.json(
      { error: "Could not parse extraction response", raw: textBlock },
      { status: 502 },
    );
  }

  // ── Resolve documentTypeId ──────────────────────────────────────────────────
  // 1. Match by known typeKey slug in the DB.
  // 2. Fall back to match by label name.
  // 3. Auto-create if the label is meaningful and not already present.
  let documentTypeId: string | null = null;
  try {
    if (suggestedTypeKey) {
      const [byKey] = await db
        .select({ id: lookupDocumentType.id })
        .from(lookupDocumentType)
        .where(and(eq(lookupDocumentType.key, suggestedTypeKey), isNull(lookupDocumentType.deletedAt)));
      if (byKey) documentTypeId = byKey.id;
    }

    if (!documentTypeId && classifiedLabel && classifiedLabel !== "Document necunoscut") {
      const [byName] = await db
        .select({ id: lookupDocumentType.id })
        .from(lookupDocumentType)
        .where(and(eq(lookupDocumentType.name, classifiedLabel), isNull(lookupDocumentType.deletedAt)));
      if (byName) {
        documentTypeId = byName.id;
      } else {
        // Auto-create a new document type (key auto-generated from name).
        const newRow = await createValue("document-types", { name: classifiedLabel });
        documentTypeId = newRow.id as string;
      }
    }
  } catch (err) {
    // Non-fatal: log and continue — fields are still useful even without a type.
    console.warn("[ai-interpret] documentTypeId resolution failed:", err);
  }

  return Response.json({ fields: { ...fields, documentTypeId } });
}
